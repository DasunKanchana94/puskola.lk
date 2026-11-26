"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookOpenText, Gauge, ImageIcon, ListMusic, LocateFixed, Moon, Pause, Play,
  RotateCcw, RotateCw, SkipBack, SkipForward, Volume2, VolumeX, X,
} from "lucide-react";
import { browserDb } from "@/lib/supabase/client";
import { saveListenProgress } from "@/app/actions";

type WordTime = [number, number, number, number]; // start, end, char start, char end
export type ListenChapter = {
  id: string; n: number; title: string; path: string | null; duration: number;
  timings: { p: [number, number, number][]; w?: Record<string, WordTime[]> } | null;
};
type Para = { idx: number; kind: string; body: string };
type Props = {
  book: { id: string; slug: string; title: string; titleEn: string; author: string; cover: string | null };
  edition: string; chapters: ListenChapter[]; sections: Record<string, { idx: number; title: string }[]>;
  signedIn: boolean; startChapterId: string; startAt: number; startRate: number;
};

const SPEEDS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const SLEEP: [string, number | "end"][] = [["5 minutes", 5], ["15 minutes", 15], ["30 minutes", 30], ["45 minutes", 45], ["1 hour", 60], ["End of chapter", "end"]];
const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};
const spoken = (s: number) => { const m = Math.floor(s / 60), sec = Math.floor(s % 60); return `${m} minute${m === 1 ? "" : "s"} ${sec} second${sec === 1 ? "" : "s"}`; };
const words = (text: string) => { const out: [number, number][] = []; const re = /\S+/g; let m; while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]); return out; };

/**
 * Timings for read-along. With a timings file, exact; otherwise estimated by spreading the chapter's length
 * over its paragraphs in proportion to their text, and over words by character position.
 */
function buildTimeline(paras: Para[], ch: ListenChapter) {
  const spoken = paras.filter((p) => p.kind !== "img");
  if (ch.timings?.p?.length) {
    const p = ch.timings.p.map(([i, s, e]) => ({ idx: i, start: s, end: e }));
    return { exact: true, paras: p, wordsOf: (idx: number, body: string): WordTime[] => ch.timings?.w?.[idx] ?? estimateWords(body, p.find((x) => x.idx === idx)) };
  }
  const weight = (p: Para) => p.body.length + 12; // a short pause between paragraphs
  const total = spoken.reduce((s, p) => s + weight(p), 0) || 1;
  let at = 0; const d = ch.duration || 1;
  const p = spoken.map((x) => { const start = (at / total) * d; at += weight(x); return { idx: x.idx, start, end: (at / total) * d }; });
  return { exact: false, paras: p, wordsOf: (idx: number, body: string) => estimateWords(body, p.find((x) => x.idx === idx)) };
}
function estimateWords(body: string, span?: { start: number; end: number }): WordTime[] {
  if (!span) return [];
  const w = words(body), len = body.length || 1, d = span.end - span.start;
  return w.map(([a, b]) => [span.start + (a / len) * d, span.start + (b / len) * d, a, b]);
}

export function Listener({ book, edition, chapters, sections, signedIn, startChapterId, startAt, startRate }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const textBox = useRef<HTMLDivElement>(null);
  const playable = useMemo(() => chapters.filter((c) => c.path), [chapters]);
  const [chId, setChId] = useState(startChapterId);
  const ch = chapters.find((c) => c.id === chId)!;
  const pos = playable.findIndex((c) => c.id === chId);
  const [paras, setParas] = useState<Para[]>([]);
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(ch.duration);
  const [buffered, setBuffered] = useState(0);
  const [rate, setRate] = useState(startRate || 1);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<"text" | "cover">("text");
  const [follow, setFollow] = useState(true);
  const [panel, setPanel] = useState(false);
  const [menu, setMenu] = useState<"speed" | "sleep" | null>(null);
  const [sleep, setSleep] = useState<{ until: number } | { end: true } | null>(null);
  const [now, setNow] = useState(0);
  const [announce, setAnnounce] = useState("");
  const pendingSeek = useRef<number>(startAt);
  const autoplay = useRef(false);
  const lastSave = useRef(0);

  const timeline = useMemo(() => buildTimeline(paras, ch), [paras, ch]);
  const before = useMemo(() => playable.slice(0, Math.max(0, pos)).reduce((s, c) => s + c.duration, 0), [playable, pos]);
  const total = useMemo(() => playable.reduce((s, c) => s + c.duration, 0), [playable]);

  // Remember mode, speed and volume on this device (read once from storage after mounting).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const m = localStorage.getItem("listen:mode"); if (m === "cover" || m === "text") setMode(m);
      const v = Number(localStorage.getItem("listen:vol")); if (v > 0 && v <= 1) setVol(v);
      if (!signedIn) {
        const g = JSON.parse(localStorage.getItem(`listen:${book.id}`) ?? "null") as { ch: string; t: number; rate: number } | null;
        if (g && chapters.some((c) => c.id === g.ch && c.path) && g.ch === startChapterId && !startAt) { pendingSeek.current = Math.max(0, g.t - 3); setRate(g.rate || 1); }
        else if (g && chapters.some((c) => c.id === g.ch && c.path) && startChapterId === playable[0]?.id) { setChId(g.ch); pendingSeek.current = Math.max(0, g.t - 3); setRate(g.rate || 1); }
      }
    } catch { /* storage unavailable: defaults are fine */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- load a chapter: its text for read-along and a short-lived link to its audio ----- */
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setErr(null); setSrc(null); setParas([]); setT(0); setDur(ch.duration); setBuffered(0);
    const db = browserDb();
    Promise.all([
      db.from("paragraphs").select("idx,kind,body").eq("chapter_id", ch.id).order("idx"),
      db.storage.from("media").createSignedUrl(ch.path!, 60 * 60 * 4),
    ]).then(([text, link]) => {
      if (!alive) return;
      setParas((text.data ?? []) as Para[]);
      if (link.error || !link.data) { setErr("This chapter's audio could not be opened. Check your connection and try again."); setLoading(false); return; }
      setSrc(link.data.signedUrl);
    });
    const url = new URL(location.href); url.searchParams.set("ch", String(ch.n)); url.searchParams.set("ed", edition); history.replaceState(null, "", url);
    return () => { alive = false; };
  }, [ch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (audio.current) { audio.current.playbackRate = rate; audio.current.defaultPlaybackRate = rate; } }, [rate, src]);
  useEffect(() => { if (audio.current) { audio.current.volume = vol; audio.current.muted = muted; } try { localStorage.setItem("listen:vol", String(vol)); } catch {} }, [vol, muted, src]);
  useEffect(() => {
    try { localStorage.setItem("listen:mode", mode); } catch {}
    if (mode === "cover" && textBox.current) textBox.current.scrollTop = 0;
  }, [mode]);

  /* ----- save the place ----- */
  const save = useCallback((force = false) => {
    const a = audio.current; if (!a) return;
    const now = Date.now(); if (!force && now - lastSave.current < 15000) return;
    lastSave.current = now;
    const pct = total ? ((before + a.currentTime) / total) * 100 : 0;
    if (signedIn) saveListenProgress(book.id, ch.id, a.currentTime, rate, pct).catch(() => {});
    else try { localStorage.setItem(`listen:${book.id}`, JSON.stringify({ ch: ch.id, t: a.currentTime, rate })); } catch {}
  }, [signedIn, book.id, ch.id, rate, before, total]);
  useEffect(() => {
    const onHide = () => save(true);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("pagehide", onHide); document.removeEventListener("visibilitychange", onHide); };
  }, [save]);

  /* ----- transport ----- */
  const toggle = useCallback(() => { const a = audio.current; if (!a || !src) return; if (a.paused) a.play().catch(() => setErr("Tap play to start the narration.")); else a.pause(); }, [src]);
  const seek = useCallback((to: number) => { const a = audio.current; if (!a) return; a.currentTime = Math.max(0, Math.min(to, (a.duration || dur) - 0.2)); setT(a.currentTime); setFollow(true); }, [dur]);
  const skip = useCallback((d: number) => { const a = audio.current; if (a) seek(a.currentTime + d); }, [seek]);
  const goChapter = useCallback((id: string, at = 0, play = true) => {
    save(true);
    if (id === chId) { seek(at); if (play) audio.current?.play().catch(() => {}); return; }
    pendingSeek.current = at; autoplay.current = play || !audio.current?.paused;
    setChId(id); setFollow(true);
    const c = chapters.find((x) => x.id === id); if (c) setAnnounce(`Now playing chapter ${c.n}: ${c.title}`);
  }, [chId, chapters, save, seek]);
  const step = useCallback((d: number) => { const next = playable[pos + d]; if (next) goChapter(next.id, 0, true); else if (d < 0) seek(0); }, [playable, pos, goChapter, seek]);

  /* ----- sleep timer ----- */
  useEffect(() => {
    if (!sleep || !("until" in sleep)) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= sleep.until) { audio.current?.pause(); setSleep(null); setAnnounce("Sleep timer ended. Narration paused."); }
    }, 1000);
    return () => clearInterval(id);
  }, [sleep]);

  /* ----- keyboard ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,select,[contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " || e.key === "k") { if (el.closest("button,a") && e.key === " ") return; e.preventDefault(); toggle(); }
      else if (e.key === "ArrowLeft" || e.key === "j") { e.preventDefault(); skip(-15); }
      else if (e.key === "ArrowRight" || e.key === "l") { e.preventDefault(); skip(30); }
      else if (e.key === "m") setMuted((x) => !x);
      else if (e.key === "]") setRate((r) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(r) + 1)] ?? r);
      else if (e.key === "[") setRate((r) => SPEEDS[Math.max(0, SPEEDS.indexOf(r) - 1)] ?? r);
      else if (e.key === "Escape") { setMenu(null); setPanel(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, skip]);

  /* ----- lock screen and headset controls ----- */
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${ch.n}. ${ch.title}`, artist: book.author, album: book.title,
      artwork: book.cover ? [{ src: book.cover, sizes: "512x512", type: book.cover.endsWith(".png") ? "image/png" : "image/jpeg" }] : [],
    });
    const ms = navigator.mediaSession;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => { try { ms.setActionHandler(a, h); } catch {} };
    set("play", () => audio.current?.play()); set("pause", () => audio.current?.pause());
    set("seekbackward", (d) => skip(-(d.seekOffset ?? 15))); set("seekforward", (d) => skip(d.seekOffset ?? 30));
    set("seekto", (d) => { if (d.seekTime !== undefined) seek(d.seekTime); });
    set("previoustrack", pos > 0 ? () => step(-1) : null); set("nexttrack", pos < playable.length - 1 ? () => step(1) : null);
  }, [ch, book, skip, seek, step, pos, playable.length]);

  /* ----- read-along position ----- */
  const active = useMemo(() => {
    const p = timeline.paras.find((x) => t >= x.start && t < x.end) ?? (t > 0 ? [...timeline.paras].reverse().find((x) => t >= x.start) : undefined);
    if (!p) return { idx: -1, word: -1 };
    const body = paras.find((x) => x.idx === p.idx)?.body ?? "";
    const ws = timeline.wordsOf(p.idx, body);
    let word = -1; for (let i = 0; i < ws.length; i++) { if (t >= ws[i][0]) word = i; else break; }
    return { idx: p.idx, word };
  }, [t, timeline, paras]);
  const section = useMemo(() => [...(sections[ch.id] ?? [])].reverse().find((s) => s.idx <= active.idx)?.title ?? "", [sections, ch.id, active.idx]);

  // Smooth updates while playing (timeupdate alone fires only about 4 times a second).
  useEffect(() => {
    if (!playing) return;
    let raf = 0; const tick = () => { if (audio.current) setT(audio.current.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Keep the spoken paragraph in view, unless the listener has scrolled away to look around.
  useEffect(() => {
    if (!follow || mode !== "text" || active.idx < 0) return;
    const el = textBox.current?.querySelector<HTMLElement>(`[data-i="${active.idx}"]`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [active.idx, follow, mode]);

  const startOf = (idx: number) => timeline.paras.find((x) => x.idx === idx)?.start;
  const sleepLeft = sleep && "until" in sleep ? Math.max(0, (sleep.until - now) / 1000) : 0;
  const nowText = paras.find((p) => p.idx === active.idx)?.body ?? "";

  const renderPara = (p: Para) => {
    if (p.kind === "img") return null;
    const on = p.idx === active.idx;
    const Tag = p.kind === "h" ? "h2" : "p";
    const cls = `${p.kind === "v" ? "lverse " : ""}${on ? "on" : ""}`;
    const start = startOf(p.idx);
    if (!on) return <Tag key={p.idx} data-i={p.idx} className={cls} onClick={() => start !== undefined && seek(start)}>{p.body}</Tag>;
    const ws = timeline.wordsOf(p.idx, p.body);
    const parts: React.ReactNode[] = []; let at = 0;
    ws.forEach(([s, , a, b], i) => {
      if (a > at) parts.push(p.body.slice(at, a));
      parts.push(<span key={i} className={i === active.word ? "w now" : i < active.word ? "w past" : "w"} onClick={(e) => { e.stopPropagation(); seek(s); }}>{p.body.slice(a, b)}</span>);
      at = b;
    });
    if (at < p.body.length) parts.push(p.body.slice(at));
    return <Tag key={p.idx} data-i={p.idx} className={cls} aria-current="true">{parts}</Tag>;
  };

  return (
    <div id="listen" className={mode}>
      <header className="lbar">
        <Link className="iconb" href={`/books/${book.slug}`} aria-label="Back to the book"><ArrowLeft size={20} strokeWidth={1.75} aria-hidden /></Link>
        <div className="ltitle"><b>{book.title}</b><span>{ch.n}. {ch.title}</span></div>
        <div className="seg lmode" role="group" aria-label="View">
          <button className={mode === "text" ? "on" : ""} aria-pressed={mode === "text"} onClick={() => setMode("text")}><BookOpenText size={17} strokeWidth={1.75} aria-hidden /><span>Read along</span></button>
          <button className={mode === "cover" ? "on" : ""} aria-pressed={mode === "cover"} onClick={() => setMode("cover")}><ImageIcon size={17} strokeWidth={1.75} aria-hidden /><span>Cover</span></button>
        </div>
        <button className="btn sm" aria-expanded={panel} aria-controls="lchapters" onClick={() => setPanel((x) => !x)}><ListMusic size={17} strokeWidth={1.75} aria-hidden /><span className="hide-sm">Chapters</span></button>
      </header>

      <div className="lbody">
        <main className="lmain" ref={textBox} onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)} aria-label="Narration">
          {mode === "cover" ? (
            <div className="lcover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {book.cover ? <img src={book.cover} alt={`Cover of ${book.titleEn}`} className={playing ? "breathe" : ""} />
                : <div className="lcover-gen"><b>{book.title}</b><span>{book.author}</span></div>}
              <h1>{book.title}</h1>
              <p className="muted">{book.author}</p>
              <p className="lchap">{ch.n}. {ch.title}{section && <><br /><span className="muted">{section}</span></>}</p>
              {nowText && <blockquote className="lnow" aria-hidden>{nowText}</blockquote>}
            </div>
          ) : (
            <article className="ltext">
              <h1>{ch.title}</h1>
              {!timeline.exact && paras.length > 0 && <p className="lnote">Highlighting follows the narration approximately. Tap any line to jump there.</p>}
              {loading && !paras.length ? <div className="lskel" aria-hidden>{Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" style={{ height: 16, width: `${92 - (i % 3) * 14}%` }} />)}</div> : paras.map(renderPara)}
            </article>
          )}
          {!follow && mode === "text" && <button className="btn sm pri lfollow" onClick={() => setFollow(true)}><LocateFixed size={16} strokeWidth={1.75} aria-hidden />Back to the narration</button>}
        </main>

        <aside id="lchapters" className={`lpanel${panel ? " on" : ""}`} aria-label="Chapters" hidden={!panel}>
          <h2>Chapters<span className="sp" /><button className="iconb" aria-label="Close chapters" onClick={() => setPanel(false)}><X size={18} strokeWidth={1.75} aria-hidden /></button></h2>
          <p className="muted small" style={{ padding: "0 16px 8px" }}>{playable.length} chapters · {clock(total)} in total</p>
          <ol>{chapters.map((c) => {
            const here = c.id === chId, secs = sections[c.id] ?? [];
            return <li key={c.id} className={here ? "here" : ""}>
              <button disabled={!c.path} aria-current={here ? "true" : undefined} onClick={() => { goChapter(c.id); if (innerWidth < 900) setPanel(false); }}>
                <span className="cn">{here && playing ? <span className="eq" aria-hidden><i /><i /><i /></span> : c.n}</span>
                <span className="ct">{c.title}</span>
                <span className="cd">{c.path ? clock(c.duration) : "No audio"}</span>
              </button>
              {here && secs.length > 0 && <ol className="secs">{secs.map((s) => <li key={s.idx}><button onClick={() => { const at = startOf(s.idx); if (at !== undefined) { seek(at); audio.current?.play().catch(() => {}); } }}>{s.title}</button></li>)}</ol>}
            </li>;
          })}</ol>
        </aside>
      </div>

      <footer className="lplayer">
        <div className="lseek">
          <span className="tnum">{clock(t)}</span>
          <div className="range-wrap" style={{ ["--p" as string]: `${dur ? (t / dur) * 100 : 0}%`, ["--b" as string]: `${dur ? (buffered / dur) * 100 : 0}%` }}>
            <input type="range" min={0} max={Math.max(1, dur)} step={0.1} value={Math.min(t, dur || 0)} aria-label="Position in chapter"
              aria-valuetext={`${spoken(t)} of ${spoken(dur)}`} onChange={(e) => seek(Number(e.target.value))} />
          </div>
          <span className="tnum">-{clock(Math.max(0, dur - t))}</span>
        </div>
        <div className="lctl">
          <div className="lside">
            <div className="pop-wrap">
              <button className="btn sm" aria-haspopup="true" aria-expanded={menu === "speed"} onClick={() => setMenu(menu === "speed" ? null : "speed")} aria-label={`Playback speed ${rate} times`}>
                <Gauge size={17} strokeWidth={1.75} aria-hidden /><span className="tnum">{rate}×</span></button>
              {menu === "speed" && <div className="lmenu" role="menu" aria-label="Playback speed">{SPEEDS.map((s) =>
                <button key={s} role="menuitemradio" aria-checked={s === rate} className={s === rate ? "on" : ""} onClick={() => { setRate(s); setMenu(null); }}>{s}×{s === 1 && " normal"}</button>)}</div>}
            </div>
            <div className="pop-wrap">
              <button className={`btn sm${sleep ? " active" : ""}`} aria-haspopup="true" aria-expanded={menu === "sleep"} onClick={() => setMenu(menu === "sleep" ? null : "sleep")}
                aria-label={sleep ? ("end" in sleep ? "Sleep timer: end of chapter" : `Sleep timer: ${Math.ceil(sleepLeft / 60)} minutes left`) : "Sleep timer"}>
                <Moon size={17} strokeWidth={1.75} aria-hidden /><span className="tnum hide-sm">{sleep ? ("end" in sleep ? "Chapter end" : clock(sleepLeft)) : "Sleep"}</span></button>
              {menu === "sleep" && <div className="lmenu" role="menu" aria-label="Sleep timer">
                {SLEEP.map(([label, v]) => <button key={label} role="menuitem" onClick={() => { setSleep(v === "end" ? { end: true } : { until: Date.now() + v * 60000 }); setNow(Date.now()); setMenu(null); setAnnounce(`Sleep timer set: ${label}`); }}>{label}</button>)}
                {sleep && <button role="menuitem" className="danger" onClick={() => { setSleep(null); setMenu(null); }}>Turn off</button>}
              </div>}
            </div>
          </div>

          <div className="lmain-ctl">
            <button className="lb" onClick={() => step(-1)} aria-label="Previous chapter" disabled={pos <= 0 && t < 3}><SkipBack size={22} strokeWidth={1.75} aria-hidden /></button>
            <button className="lb" onClick={() => skip(-15)} aria-label="Back 15 seconds"><RotateCcw size={22} strokeWidth={1.75} aria-hidden /><small>15</small></button>
            <button className="lplay" onClick={toggle} aria-label={playing ? "Pause" : "Play"} disabled={!src} aria-busy={loading || undefined}>
              {loading && !err ? <span className="spin" aria-hidden /> : playing ? <Pause size={28} strokeWidth={2} aria-hidden /> : <Play size={28} strokeWidth={2} aria-hidden style={{ marginLeft: 3 }} />}
            </button>
            <button className="lb" onClick={() => skip(30)} aria-label="Forward 30 seconds"><RotateCw size={22} strokeWidth={1.75} aria-hidden /><small>30</small></button>
            <button className="lb" onClick={() => step(1)} aria-label="Next chapter" disabled={pos >= playable.length - 1}><SkipForward size={22} strokeWidth={1.75} aria-hidden /></button>
          </div>

          <div className="lside right">
            <button className="lb sm" onClick={() => setMuted((x) => !x)} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}>
              {muted || vol === 0 ? <VolumeX size={19} strokeWidth={1.75} aria-hidden /> : <Volume2 size={19} strokeWidth={1.75} aria-hidden />}</button>
            <input className="lvol" type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol} aria-label="Volume" onChange={(e) => { setVol(Number(e.target.value)); setMuted(false); }} />
            <span className="muted small hide-sm tnum" title="Whole book">{total ? Math.round(((before + t) / total) * 100) : 0}% of book</span>
          </div>
        </div>
        {err && <p className="lerr" role="alert">{err}</p>}
        <div className="sr-only" aria-live="polite">{announce}</div>
      </footer>

      {menu && <div className="lscrim" onClick={() => setMenu(null)} aria-hidden />}

      {src && <audio ref={audio} src={src} preload="auto"
        onLoadedMetadata={(e) => {
          const a = e.currentTarget; setDur(a.duration || ch.duration); setLoading(false);
          if (pendingSeek.current) { a.currentTime = Math.min(pendingSeek.current, Math.max(0, a.duration - 1)); setT(a.currentTime); pendingSeek.current = 0; }
          a.playbackRate = rate;
          if (autoplay.current) { autoplay.current = false; a.play().catch(() => {}); }
        }}
        onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); save(); try { navigator.mediaSession?.setPositionState?.({ duration: e.currentTarget.duration || 0, position: e.currentTarget.currentTime, playbackRate: rate }); } catch {} }}
        onProgress={(e) => { const b = e.currentTarget.buffered; if (b.length) setBuffered(b.end(b.length - 1)); }}
        onPlay={() => { setPlaying(true); setErr(null); }} onPause={() => { setPlaying(false); save(true); }}
        onWaiting={() => setLoading(true)} onPlaying={() => setLoading(false)}
        onEnded={() => {
          setPlaying(false); save(true);
          if (sleep && "end" in sleep) { setSleep(null); setAnnounce("Sleep timer: chapter finished. Narration paused."); return; }
          if (pos < playable.length - 1) goChapter(playable[pos + 1].id, 0, true); else setAnnounce("You have reached the end of the book.");
        }}
        onError={() => { setLoading(false); setErr("This chapter's audio could not be played. Try again, or choose another chapter."); }} />}
    </div>
  );
}
