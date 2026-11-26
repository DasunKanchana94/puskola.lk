"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileAudio, ListMusic, Trash2, Upload } from "lucide-react";
import { browserDb } from "@/lib/supabase/client";
import { deleteTrack, saveTimings, saveTrack } from "@/app/admin-actions";

export type ChapterAudio = { id: string; n: number; title: string; track: { duration: number; timed: boolean } | null };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Reads an audio file's length in the browser before uploading it. */
const durationOf = (file: File) => new Promise<number>((resolve) => {
  const a = new Audio(); const url = URL.createObjectURL(file);
  a.preload = "metadata";
  a.onloadedmetadata = () => { resolve(Number.isFinite(a.duration) ? a.duration : 0); URL.revokeObjectURL(url); };
  a.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
  a.src = url;
});

/** Matches chosen files to chapters: by the first number in each file name, or by order when no names carry numbers. */
function matchFiles(files: File[], chapters: ChapterAudio[]) {
  const byNum = files.map((f) => ({ f, n: Number(f.name.match(/\d+/)?.[0] ?? NaN) }));
  if (byNum.every((x) => Number.isFinite(x.n))) {
    return byNum.map(({ f, n }) => ({ file: f, chapter: chapters.find((c) => c.n === n) ?? null }));
  }
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return sorted.map((f, i) => ({ file: f, chapter: chapters[i] ?? null }));
}

/** Back office: narration for each chapter of one edition, uploaded straight from the browser to storage. */
export function NarrationUpload({ editionId, chapters }: { editionId: string; chapters: ChapterAudio[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const withAudio = chapters.filter((c) => c.track).length;
  const total = chapters.reduce((s, c) => s + (c.track?.duration ?? 0), 0);

  const uploadOne = async (file: File, ch: ChapterAudio) => {
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `narration/${editionId}/${String(ch.n).padStart(3, "0")}-${Date.now()}.${ext}`;
    const [duration, up] = await Promise.all([
      durationOf(file),
      browserDb().storage.from("media").upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false }),
    ]);
    if (up.error) throw new Error(`Chapter ${ch.n}: ${up.error.message}`);
    const res = await saveTrack(editionId, ch.id, path, duration);
    if (!res.ok) throw new Error(`Chapter ${ch.n}: ${res.message}`);
  };

  const uploadMany = async (list: FileList | null) => {
    if (!list?.length) return;
    const plan = matchFiles([...list], chapters);
    const missing = plan.filter((p) => !p.chapter).map((p) => p.file.name);
    if (missing.length) return setMsg({ ok: false, text: `No chapter matches ${missing.slice(0, 3).join(", ")}. Name files with the chapter number, such as 01.mp3, 02.mp3.` });
    setMsg(null);
    try {
      for (const [i, p] of plan.entries()) { setBusy(`Uploading ${i + 1} of ${plan.length}: chapter ${p.chapter!.n}…`); await uploadOne(p.file, p.chapter!); }
      setMsg({ ok: true, text: `Uploaded narration for ${plan.length} chapter${plan.length > 1 ? "s" : ""}.` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null); router.refresh();
  };

  const run = async (label: string, job: () => Promise<{ ok: boolean; message: string } | void>) => {
    setBusy(label); setMsg(null);
    try { const r = await job(); if (r) setMsg({ ok: r.ok, text: r.message }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(null); router.refresh();
  };

  return (
    <details className="narr">
      <summary><ListMusic size={18} strokeWidth={1.75} aria-hidden /> Audiobook narration
        <span className="muted small">{withAudio ? `${withAudio} of ${chapters.length} chapters · ${clock(total)}` : "none yet"}</span></summary>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <p className="muted small">One audio file per chapter (MP3 or M4A). Choose several at once: files are matched to chapters by the number in their names, such as 01.mp3, 02.mp3. Read-along highlighting works without extra files; add a timings file for exact word highlighting.</p>
        <span className="row" style={{ gap: 8 }}>
          <label className={`btn sm pri${busy ? " disabled" : ""}`} htmlFor={`narr-${editionId}`}><Upload size={16} strokeWidth={1.75} aria-hidden />Upload chapter files</label>
          <input id={`narr-${editionId}`} type="file" accept="audio/*" multiple hidden disabled={!!busy} onChange={(e) => { const f = e.target.files; e.target.value = ""; uploadMany(f); }} />
        </span>
        {busy && <span className="small muted" role="status"><span className="spin" aria-hidden />{busy}</span>}
        {msg && <span className="small" role={msg.ok ? "status" : "alert"} style={{ color: msg.ok ? "var(--ok)" : "var(--danger)" }}>{msg.text}</span>}
        <div className="tw"><table>
          <thead><tr><th>Chapter</th><th>Narration</th><th className="num">Actions</th></tr></thead>
          <tbody>{chapters.map((c) => <tr key={c.id}>
            <td style={{ whiteSpace: "normal" }}><b>{c.n}.</b> {c.title}</td>
            <td>{c.track ? <span className="row" style={{ gap: 6 }}><FileAudio size={16} strokeWidth={1.75} aria-hidden />{clock(c.track.duration)}{c.track.timed ? <span className="pill">Word timings</span> : <span className="pill grey">Estimated read-along</span>}</span> : <span className="muted">No audio</span>}</td>
            <td className="num"><span className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
              <label className="btn sm" htmlFor={`one-${c.id}`}>{c.track ? "Replace" : "Upload"}</label>
              <input id={`one-${c.id}`} type="file" accept="audio/*" hidden disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(`Uploading chapter ${c.n}…`, () => uploadOne(f, c)); }} />
              {c.track && <>
                <label className="btn sm" htmlFor={`tim-${c.id}`} title="Upload a word timings file (JSON)">Timings</label>
                <input id={`tim-${c.id}`} type="file" accept=".json,application/json" hidden disabled={!!busy} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const t = await f.text(); run("Saving timings…", () => saveTimings(c.id, t)); } }} />
                <button className="btn sm ghost danger" aria-label={`Remove narration for chapter ${c.n}`} disabled={!!busy}
                  onClick={() => { if (window.confirm(`Remove the narration for chapter ${c.n}? The audio file will be deleted.`)) run("Removing…", () => deleteTrack(c.id)); }}><Trash2 size={16} strokeWidth={1.75} aria-hidden /></button>
              </>}
            </span></td>
          </tr>)}</tbody>
        </table></div>
      </div>
    </details>
  );
}
