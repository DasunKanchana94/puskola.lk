"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Sparkles, Square } from "lucide-react";
import { browserDb } from "@/lib/supabase/client";
import { saveTimings, saveTrack } from "@/app/admin-actions";
import type { ChapterAudio } from "@/components/NarrationUpload";

const VOICES: [string, string][] = [["si-LK-ThiliniNeural", "Thilini (female)"], ["si-LK-SameeraNeural", "Sameera (male)"]];
const RATE = 24000; // samples per second of the PCM Azure returns
const PAUSE = 0.55; // seconds of silence between paragraphs
type WordTime = [number, number, number, number];

/** Turns one paragraph into speech; returns its PCM samples and the time of every word inside it. */
async function speak(sdk: typeof import("microsoft-cognitiveservices-speech-sdk"), cfg: import("microsoft-cognitiveservices-speech-sdk").SpeechConfig, text: string) {
  const synth = new sdk.SpeechSynthesizer(cfg, null as unknown as import("microsoft-cognitiveservices-speech-sdk").AudioConfig);
  const words: [number, number, number, number][] = [];
  synth.wordBoundary = (_s, e) => {
    if (e.boundaryType !== sdk.SpeechSynthesisBoundaryType.Word) return;
    words.push([e.audioOffset / 1e7, (e.audioOffset + e.duration) / 1e7, e.textOffset, e.textOffset + e.wordLength]); // offsets and durations are in 100 ns ticks
  };
  const result = await new Promise<import("microsoft-cognitiveservices-speech-sdk").SpeechSynthesisResult>((ok, fail) =>
    synth.speakTextAsync(text, (r) => { synth.close(); ok(r); }, (err) => { synth.close(); fail(new Error(err)); }));
  if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) throw new Error(result.errorDetails || "The voice service stopped unexpectedly.");
  return { pcm: new Int16Array(result.audioData), words };
}

/**
 * Back office: creates narration for every chapter with an Azure Sinhala voice, in the browser.
 * Each chapter becomes one MP3 with exact paragraph and word timings for read-along.
 */
export function NarrationGenerate({ editionId, chapters }: { editionId: string; chapters: ChapterAudio[] }) {
  const router = useRouter();
  const [voice, setVoice] = useState(VOICES[0][0]);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [status, setStatus] = useState<{ busy: boolean; text: string; ok?: boolean; pct?: number }>({ busy: false, text: "" });
  const stop = useRef(false);

  const run = async () => {
    stop.current = false;
    const todo = chapters.filter((c) => !onlyMissing || !c.track);
    if (!todo.length) return setStatus({ busy: false, ok: true, text: "Every chapter already has narration. Untick “only chapters without audio” to redo them." });
    setStatus({ busy: true, text: "Connecting to the voice service…", pct: 0 });
    try {
      const [sdk, { Mp3Encoder }] = await Promise.all([import("microsoft-cognitiveservices-speech-sdk"), import("@breezystack/lamejs")]);
      let auth = { token: "", region: "", at: 0 };
      const config = async () => {
        if (Date.now() - auth.at > 8 * 60 * 1000) {
          const r = await fetch("/api/speech-token", { method: "POST" }); const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? "Could not reach the voice service.");
          auth = { token: j.token, region: j.region, at: Date.now() };
        }
        const cfg = sdk.SpeechConfig.fromAuthorizationToken(auth.token, auth.region);
        cfg.speechSynthesisVoiceName = voice;
        cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm;
        cfg.setProperty(sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary, "true");
        return cfg;
      };
      const db = browserDb();
      let chars = 0;
      for (const [ci, ch] of todo.entries()) {
        const { data } = await db.from("paragraphs").select("idx,kind,body").eq("chapter_id", ch.id).order("idx");
        const paras = (data ?? []).filter((p) => p.kind !== "img" && p.body.trim());
        const chunks: Int16Array[] = []; let at = 0;
        const timings: { p: [number, number, number][]; w: Record<string, WordTime[]> } = { p: [], w: {} };
        for (const [pi, p] of paras.entries()) {
          if (stop.current) throw new Error("Stopped. Chapters finished so far are saved.");
          setStatus({ busy: true, text: `Chapter ${ch.n} of ${chapters.length}: paragraph ${pi + 1} of ${paras.length}`, pct: Math.round(((ci + pi / paras.length) / todo.length) * 100) });
          // Verse lines read better with a pause at each line end.
          const text = p.kind === "v" ? p.body.replace(/\n+/g, ",\n") : p.body;
          let out: Awaited<ReturnType<typeof speak>> | null = null;
          for (let attempt = 0; attempt < 3 && !out; attempt++) {
            try { out = await speak(sdk, await config(), text); }
            catch (e) { if (attempt === 2) throw e; await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); auth.at = 0; }
          }
          const start = at / RATE, len = out!.pcm.length / RATE;
          chunks.push(out!.pcm); at += out!.pcm.length;
          timings.p.push([p.idx, start, start + len]);
          // Offsets come back for the text sent; verse commas add one character before each line break.
          const shift = (o: number) => (p.kind === "v" ? o - (text.slice(0, o).match(/,\n/g)?.length ?? 0) : o);
          timings.w[p.idx] = out!.words.map(([s, e, a, b]) => [start + s, start + e, shift(a), shift(b)]);
          const gap = new Int16Array(Math.round((p.kind === "h" ? PAUSE * 1.6 : PAUSE) * RATE));
          chunks.push(gap); at += gap.length;
          chars += p.body.length;
        }
        setStatus({ busy: true, text: `Chapter ${ch.n}: making the MP3 and uploading…`, pct: Math.round(((ci + 1) / todo.length) * 100) });
        const enc = new Mp3Encoder(1, RATE, 64); const mp3: Uint8Array[] = [];
        for (const c of chunks) for (let i = 0; i < c.length; i += 1152 * 20) { const part = enc.encodeBuffer(c.subarray(i, i + 1152 * 20)); if (part.length) mp3.push(part); }
        const tail = enc.flush(); if (tail.length) mp3.push(tail);
        const path = `narration/${editionId}/${String(ch.n).padStart(3, "0")}-${Date.now()}.mp3`;
        const up = await db.storage.from("media").upload(path, new Blob(mp3 as BlobPart[], { type: "audio/mpeg" }), { contentType: "audio/mpeg", upsert: false });
        if (up.error) throw new Error(`Chapter ${ch.n} could not be uploaded: ${up.error.message}`);
        const saved = await saveTrack(editionId, ch.id, path, at / RATE);
        if (!saved.ok) throw new Error(saved.message);
        const t = await saveTimings(ch.id, JSON.stringify(timings));
        if (!t.ok) throw new Error(t.message);
        router.refresh();
      }
      setStatus({ busy: false, ok: true, text: `Narration ready for ${todo.length} chapter${todo.length > 1 ? "s" : ""}, about ${chars.toLocaleString()} characters.`, pct: 100 });
    } catch (e) {
      setStatus({ busy: false, ok: false, text: (e as Error).message });
    }
    router.refresh();
  };

  return (
    <div className="gen card" style={{ display: "grid", gap: 10, boxShadow: "none" }}>
      <b className="row" style={{ gap: 8 }}><Sparkles size={18} strokeWidth={1.75} aria-hidden />Generate narration with an AI voice</b>
      <p className="muted small">Reads every chapter aloud with a natural Sinhala voice and saves exact word timings for read-along. Keep this page open while it works.</p>
      <div className="row" style={{ gap: 10 }}>
        <label className="row small" style={{ gap: 6 }}>Voice
          <select className="inp" style={{ width: "auto" }} value={voice} onChange={(e) => setVoice(e.target.value)} disabled={status.busy}>{VOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} disabled={status.busy} />Only chapters without audio</label>
        <span className="sp" />
        {status.busy
          ? <button className="btn sm danger" onClick={() => { stop.current = true; }}><Square size={14} strokeWidth={2} aria-hidden />Stop</button>
          : <button className="btn sm pri" onClick={run}><Sparkles size={16} strokeWidth={1.75} aria-hidden />Generate</button>}
      </div>
      {status.pct !== undefined && status.busy && <div className="prog" role="progressbar" aria-valuenow={status.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Narration progress"><i style={{ width: `${status.pct}%` }} /></div>}
      {status.text && <span className="small" role={status.ok === false ? "alert" : "status"} style={{ color: status.ok === false ? "var(--danger)" : status.ok ? "var(--ok)" : "var(--muted)" }}>{status.busy && <span className="spin" aria-hidden />}{status.text}</span>}
    </div>
  );
}
