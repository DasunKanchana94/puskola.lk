"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { saveProgress } from "@/app/actions";
import { deleteBookmark, deleteHighlight, saveHighlight, toggleBookmark, type Bookmark, type Highlight } from "@/app/reader-actions";

type Props = {
  book: { id: string; slug: string; title: string; titleEn: string };
  editions: { kind: string; label: string; locked: boolean }[]; edition: string;
  chapters: { id: string; n: number; title: string }[];
  chapter: { id: string; n: number; title: string; subtitle: string };
  paragraphs: { idx: number; kind: string; body: string }[];
  /** Every chapter of every edition, so bookmarks and notes can link back to their place. */
  places: Record<string, { n: number; ed: string }>;
  bookmarks: Bookmark[]; highlights: Highlight[];
  signedIn: boolean; startPara: number;
  /** Open on the last page (used when turning back from the next chapter). */
  startAtEnd?: boolean;
  /** Section headings of each chapter in this edition, for the contents panel. */
  sections: Record<string, { idx: number; title: string }[]>;
};
type View = "spread" | "page" | "scroll";
type Geo = { pw: number; ph: number; g: number; cols: number };
type Prefs = { theme: "light" | "sepia" | "dark"; size: number; font: "serif" | "sans"; lh: number; width: number; rate: number; vol: number; view: View; toc: boolean };
type Sound = "off" | "rain" | "stream" | "drone";
type Sel = { p: number; s: number; e: number; text: string };
type Pop = { x: number; y: number; below: boolean } & ({ kind: "sel"; sel: Sel; noting: boolean } | { kind: "mark"; mark: Highlight });
type ChatMsg = { role: "user" | "assistant"; content: string; failed?: boolean };

const KEY = "puskola-reader";
const DEFAULTS: Prefs = { theme: "light", size: 19, font: "serif", lh: 1.9, width: 680, rate: 1, vol: 0.25, view: "spread", toc: false };
const LANGS: [string, string, string][] = [["English", "English", "en"], ["Tamil", "Tamil", "ta"], ["Hindi", "Hindi", "hi"], ["Japanese", "Japanese", "ja"], ["Chinese", "Chinese", "zh"]];
const SWATCH = ["#ffd640", "#78dc96", "#78beff", "#ff96aa"];
const QUICK = ["Summarise this chapter in 5 points", "Who are the main people in this chapter?", "මේ පරිච්ඡේදයේ අමාරු වචන පැහැදිලි කරන්න"];

/** Calm background sound, generated in the browser so there is nothing to download. */
function makeMusic() {
  let ctx: AudioContext | null = null, gain: GainNode | null = null, nodes: AudioScheduledSourceNode[] = [];
  const stop = () => { nodes.forEach((n) => { try { n.stop(); } catch {} }); nodes = []; try { gain?.disconnect(); } catch {} gain = null; };
  return {
    stop,
    vol(v: number) { if (gain) gain.gain.value = v; },
    start(kind: Sound, vol: number) {
      stop(); if (kind === "off") return true;
      try {
        const C = ctx ?? (ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());
        C.resume(); const g = (gain = C.createGain()); g.gain.value = vol; g.connect(C.destination);
        if (kind === "drone") {
          [110, 164.81, 220, 277.18].forEach((f, i) => {
            const o = C.createOscillator(), og = C.createGain(), l = C.createOscillator(), lg = C.createGain();
            o.frequency.value = f; og.gain.value = 0.16; l.frequency.value = 0.05 + i * 0.03; lg.gain.value = 0.09;
            l.connect(lg); lg.connect(og.gain); o.connect(og); og.connect(g); o.start(); l.start(); nodes.push(o, l);
          });
        } else {
          const len = C.sampleRate * 4, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0); let last = 0;
          for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === "stream") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w * 0.5; }
          const s = C.createBufferSource(); s.buffer = buf; s.loop = true; const f = C.createBiquadFilter();
          if (kind === "rain") { f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 0.4; } else { f.type = "lowpass"; f.frequency.value = 700; }
          s.connect(f); f.connect(g); s.start(); nodes.push(s);
        }
        return true;
      } catch { return false; }
    },
  };
}

/** Splits long text so each spoken piece is short; some browsers cut off long utterances. */
function pieces(text: string) {
  const out: string[] = []; let cur = "";
  for (const part of text.split(/(?<=[.!?।။。])\s+/)) {
    if ((cur + " " + part).length > 180 && cur) { out.push(cur); cur = part; } else cur = cur ? cur + " " + part : part;
  }
  if (cur) out.push(cur);
  return out;
}

/** A row of option buttons in the reader menus. */
function Seg<T extends string | number>({ opts, cur, set }: { opts: [T, string][]; cur: T; set: (v: T) => void }) {
  return <div className="seg">{opts.map((o) => <button key={String(o[0])} type="button" className={`rb${o[0] === cur ? " on" : ""}`} aria-pressed={o[0] === cur} onClick={() => set(o[0])}>{o[1]}</button>)}</div>;
}

export function Reader({ book, editions, edition, chapters, chapter, paragraphs, places, bookmarks: bm0, highlights: hl0, signedIn, startPara, startAtEnd, sections }: Props) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [menu, setMenu] = useState<"look" | "music" | null>(null);
  const [panel, setPanel] = useState<"notes" | "ai" | null>(null);
  const [focus, setFocus] = useState(false);
  const [sound, setSound] = useState<Sound>("off");
  const [pct, setPct] = useState(0);
  const [bms, setBms] = useState(bm0);
  const [marks, setMarks] = useState(hl0);
  const [pop, setPop] = useState<Pop | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [lang, setLang] = useState("");
  const [tr, setTr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [asking, setAsking] = useState(false);
  const [q, setQ] = useState("");
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [spread, setSpread] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, startLoading] = useTransition();
  const stage = useRef<HTMLDivElement>(null);
  /** Where to open once the pages have been laid out: a paragraph, or the end of the chapter. */
  const pending = useRef<{ para?: number; end?: boolean } | null>(null);
  /** The paragraph at the top of the current page, kept so a change of text size stays at the same place. */
  const anchor = useRef<number | null>(null);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const turnRef = useRef<(d: number) => void>(() => {});

  const scroller = useRef<HTMLDivElement>(null), chatBox = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const music = useRef<ReturnType<typeof makeMusic> | null>(null);
  const speakToken = useRef(0);

  const index = chapters.findIndex((c) => c.id === chapter.id);
  const trKey = (i: number, l = lang) => `${chapter.id}|${l}|${i}`;
  const say = useCallback((m: string) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 4200); }, []);
  const update = (p: Partial<Prefs>) => setPrefs((old) => { const next = { ...old, ...p }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} return next; });
  const paged = prefs.view !== "scroll";
  const spreads = geo ? Math.max(1, Math.ceil(pages / geo.cols)) : 1;
  const go = (ed: string, n: number, p = 0, end = false) => {
    window.dispatchEvent(new Event("puskola:busy"));
    startLoading(() => router.push(`/read/${book.slug}?ed=${ed}&ch=${n}${p ? `&p=${p}` : ""}${end ? "&end=1" : ""}`));
  };
  const paraEl = (i: number) => scroller.current?.querySelector<HTMLElement>(`[data-i="${i}"]`) ?? null;
  /** The first paragraph the reader can see now. */
  const topPara = () => {
    const el = scroller.current; if (!el) return 0;
    const box = el.getBoundingClientRect();
    const all = [...el.querySelectorAll<HTMLElement>("[data-i]")];
    const first = paged
      ? all.find((p) => { const r = p.getBoundingClientRect(); return r.right > box.left + 2 && r.left < box.right - 2; })
      : all.find((p) => p.getBoundingClientRect().bottom > box.top + 50);
    return Number(first?.dataset.i ?? 0);
  };
  /** Which spread an element starts on, in book view. */
  const spreadOf = (target: HTMLElement) => {
    const el = scroller.current; if (!el || !geo) return 0;
    const x = target.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    return Math.max(0, Math.floor(Math.floor((x + 2) / (geo.pw + geo.g)) / geo.cols));
  };
  const reveal = (target: HTMLElement | null) => {
    if (!target) return;
    if (paged) setSpread(spreadOf(target)); else target.scrollIntoView({ block: "center" });
  };
  const flash = (i: number) => { const el = paraEl(i); if (!el) return; reveal(el); el.classList.add("speaking"); setTimeout(() => el.classList.remove("speaking"), 1600); };

  const stopSpeaking = useCallback(() => { speakToken.current++; try { window.speechSynthesis?.cancel(); } catch {} setSpeaking(null); }, []);

  // Saved preferences live in the browser, so they can only be read after the first render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setPrefs((p) => ({ ...p, ...JSON.parse(s) })); } catch {} }, []);
  useEffect(() => () => { music.current?.stop(); try { window.speechSynthesis?.cancel(); } catch {} }, []);

  // A new chapter: go to the saved place, stop any reading aloud, and record progress.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    stopSpeaking(); setPop(null);
    const el = scroller.current, target = startPara ? paraEl(startPara) : null;
    if (el) { el.scrollTop = !paged && target ? target.offsetTop - 20 : 0; el.scrollLeft = 0; }
    if (target) { target.classList.add("speaking"); setTimeout(() => target.classList.remove("speaking"), 1600); }
    setPct(Math.round((index / chapters.length) * 100));
    if (signedIn) saveProgress(book.id, chapter.id, startPara, Math.round((index / chapters.length) * 100));
  }, [chapter.id, startPara, startAtEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- book view: measure the page size and count the pages ----- */
  // Runs before the page count below, so a new chapter opens at the right page.
  useLayoutEffect(() => {
    if (!paged) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpread(0);
    pending.current = startAtEnd ? { end: true } : startPara ? { para: startPara } : null;
    anchor.current = null;
  }, [chapter.id, startPara, startAtEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const layout = () => {
    const st = stage.current;
    if (!paged || !st) return;
    const narrow = st.clientWidth < 640;
    const g = narrow ? 32 : 56, side = narrow ? 8 : 52;
    const W = st.clientWidth - side * 2, H = st.clientHeight - (narrow ? 16 : 40);
    const cols = prefs.view === "spread" && W >= 900 ? 2 : 1;
    const max = cols === 2 ? Math.min(prefs.width * 0.82, 600) : prefs.width;
    const pw = Math.floor(Math.max(220, Math.min(max, (W - g * cols) / cols)));
    const ph = Math.floor(Math.max(240, H - (narrow ? 66 : 86)));
    setGeo((old) => (old && old.pw === pw && old.ph === ph && old.g === g && old.cols === cols ? old : { pw, ph, g, cols }));
  };
  useLayoutEffect(() => {
    layout();
    const st = stage.current; if (!st) return;
    const ro = new ResizeObserver(() => layout()); ro.observe(st);
    return () => ro.disconnect();
  }, [prefs.view, prefs.width]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count pages after anything that changes how the text flows.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!paged || !geo || !el) return;
    const count = () => {
      const n = Math.max(1, Math.round((el.scrollWidth + geo.g) / (geo.pw + geo.g)));
      setPages(n);
      const total = Math.max(1, Math.ceil(n / geo.cols));
      const want = pending.current;
      if (want?.end) { setSpread(total - 1); pending.current = null; }
      else if (want?.para !== undefined) { const t = paraEl(want.para); el.scrollLeft = 0; if (t) setSpread(Math.min(total - 1, spreadOf(t))); pending.current = null; }
      else {
        const t = anchor.current !== null ? paraEl(anchor.current) : null;
        setSpread((s) => Math.min(t ? spreadOf(t) : s, total - 1));
      }
    };
    count();
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) count(); });
    return () => { alive = false; };
  }, [geo, paged, prefs.size, prefs.lh, prefs.font, paragraphs, tr, lang, chapter.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the current spread, and remember the place.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!paged || !geo || !el) return;
    el.scrollLeft = spread * geo.cols * (geo.pw + geo.g);
    anchor.current = topPara();
    const overall = Math.round(((index + (spreads > 1 ? spread / (spreads - 1) : 1)) / chapters.length) * 100);
    setPct(overall);
    setPop(null);
    if (!signedIn) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveProgress(book.id, chapter.id, topPara(), overall), 1200);
  }, [spread, geo, pages]); // eslint-disable-line react-hooks/exhaustive-deps

  const turn = (d: number) => {
    if (!paged) return;
    const n = spread + d;
    if (n < 0) { if (index > 0) go(edition, chapters[index - 1].n, 0, true); return; }
    if (n >= spreads) { if (index < chapters.length - 1) go(edition, chapters[index + 1].n); return; }
    setSpread(n);
  };
  useEffect(() => { turnRef.current = turn; });

  const onScroll = () => {
    const el = scroller.current; if (!el || paged) return;
    const frac = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    const overall = Math.round(((index + frac) / chapters.length) * 100);
    setPct(overall); if (pop) setPop(null);
    if (!signedIn) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveProgress(book.id, chapter.id, topPara(), overall), 1200);
  };

  /* ----- selecting text ----- */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onSelect = () => {
      const s = window.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return;
      const rg = s.getRangeAt(0);
      const pe = (n: Node) => (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest<HTMLElement>(".rtext p[data-i]") ?? null;
      const a = pe(rg.startContainer), b = pe(rg.endContainer);
      if (!a || a !== b) return;
      const text = rg.toString(); if (!text.trim()) return;
      const pre = document.createRange(); pre.selectNodeContents(a); pre.setEnd(rg.startContainer, rg.startOffset);
      const start = pre.toString().length, r = rg.getBoundingClientRect(), below = r.top < 70;
      setNote("");
      setPop({ kind: "sel", noting: false, sel: { p: Number(a.dataset.i), s: start, e: start + text.length, text }, x: Math.max(165, Math.min(window.innerWidth - 165, r.left + r.width / 2)), y: below ? r.bottom + 8 : r.top - 8, below });
    };
    const handler = () => { clearTimeout(t); t = setTimeout(onSelect, 280); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setFocus(false); setPop(null); setMenu(null); return; }
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) { e.preventDefault(); turnRef.current(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) { e.preventDefault(); turnRef.current(-1); }
    };
    document.addEventListener("selectionchange", handler); document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("selectionchange", handler); document.removeEventListener("keydown", onKey); };
  }, []);

  const addMark = async (color: number, noteText = "") => {
    if (pop?.kind !== "sel") return;
    if (!signedIn) return say("Sign in to save highlights and notes.");
    const s = pop.sel; window.getSelection()?.removeAllRanges(); setPop(null);
    const res = await saveHighlight({ chapter_id: chapter.id, para_idx: s.p, start_off: s.s, end_off: s.e, color, note: noteText, quote: s.text });
    if (res.error || !res.row) return say(res.error ?? "The highlight could not be saved. Try again.");
    setMarks((m) => [...m.filter((x) => !res.removed.includes(x.id)), res.row!]);
  };
  const removeMark = (id: string) => { setMarks((m) => m.filter((x) => x.id !== id)); setPop(null); deleteHighlight(id); };

  const bookmark = async () => {
    if (!signedIn) return say("Sign in to save bookmarks.");
    const p = topPara(), body = paragraphs.find((x) => x.idx === p)?.body ?? "";
    const res = await toggleBookmark(chapter.id, p, body.slice(0, 80));
    if (res.error) return say(res.error);
    if (res.removedId) { setBms((b) => b.filter((x) => x.id !== res.removedId)); say("Bookmark removed."); }
    else if (res.added) { setBms((b) => [...b, res.added!]); say("Bookmark added."); }
  };
  const jump = (chapterId: string, p: number) => {
    if (chapterId === chapter.id) return flash(p);
    const place = places[chapterId]; if (place) go(place.ed, place.n, p);
  };

  /* ----- read aloud ----- */
  const speakLines = (lines: { i: number | null; text: string }[]) => {
    const synth = window.speechSynthesis;
    if (!synth) return say("This browser cannot read aloud.");
    const code = LANGS.find((l) => l[0] === lang)?.[2] ?? "si";
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(code));
    if (!voice && synth.getVoices().length) return say(`This device has no ${lang || "Sinhala"} voice installed, so read aloud cannot play here. Try Microsoft Edge, or Chrome on Android.`);
    synth.cancel(); const token = ++speakToken.current;
    const queue = lines.flatMap((l) => pieces(l.text).map((text) => ({ i: l.i, text })));
    const next = (k: number) => {
      if (token !== speakToken.current) return;
      if (k >= queue.length) return setSpeaking(null);
      const u = new SpeechSynthesisUtterance(queue[k].text);
      if (voice) u.voice = voice; u.lang = voice?.lang ?? code; u.rate = prefs.rate;
      u.onend = () => next(k + 1); u.onerror = () => { if (token === speakToken.current) setSpeaking(null); };
      const i = queue[k].i;
      if (i !== null) { setSpeaking(i); if (k === 0 || queue[k - 1].i !== i) reveal(paraEl(i)); } else setSpeaking(-1);
      synth.speak(u);
    };
    next(0);
  };
  const aloud = () => {
    if (speaking !== null) return stopSpeaking();
    const from = topPara();
    const lines = paragraphs.filter((p) => p.kind !== "h" && p.idx >= from).slice(0, 40).map((p) => ({ i: p.idx, text: lang ? tr[trKey(p.idx)] ?? "" : p.body })).filter((l) => l.text);
    if (lines.length) speakLines(lines);
  };

  /* ----- translation ----- */
  const translateMore = async (l = lang) => {
    if (!l || busy) return;
    if (!signedIn) return say("Sign in to translate the text.");
    const idxs = paragraphs.filter((p) => p.kind === "p" && !tr[trKey(p.idx, l)]).slice(0, 6).map((p) => p.idx);
    if (!idxs.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chapterId: chapter.id, lang: l, idxs }) });
      const data = await res.json();
      if (!res.ok) say(data.error ?? "That section could not be translated. Try again.");
      else setTr((old) => ({ ...old, ...Object.fromEntries(Object.entries(data.items as Record<string, string>).map(([i, t]) => [trKey(Number(i), l), t])) }));
    } catch { say("That section could not be translated. Check your connection and try again."); }
    setBusy(false);
  };
  const untranslated = lang ? paragraphs.filter((p) => p.kind === "p" && !tr[trKey(p.idx)]).length : 0;

  /* ----- reading assistant ----- */
  const ask = async (question: string) => {
    const text = question.trim(); if (!text || asking) return;
    setPanel("ai"); setPop(null);
    const history = [...chat.filter((m) => !m.failed), { role: "user" as const, content: text }];
    setChat([...chat, { role: "user", content: text }]); setAsking(true);
    let reply: ChatMsg;
    if (!signedIn) reply = { role: "assistant", content: "Sign in to use the reading assistant.", failed: true };
    else try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chapterId: chapter.id, around: topPara(), book: book.titleEn, messages: history }) });
      const data = await res.json();
      reply = res.ok ? { role: "assistant", content: data.text || "No answer came back. Try asking again." } : { role: "assistant", content: data.error ?? "The assistant could not answer just now. Try again.", failed: true };
    } catch { reply = { role: "assistant", content: "The assistant could not be reached. Check your connection and try again.", failed: true }; }
    // A failed turn is shown but left out of the history sent with the next question.
    setChat((c) => [...(reply.failed ? c.map((m, i) => (i === c.length - 1 ? { ...m, failed: true } : m)) : c), reply]);
    setAsking(false);
  };
  useEffect(() => { chatBox.current?.scrollTo(0, 1e6); }, [chat, asking, panel]);

  const chooseSound = (v: Sound) => { music.current ??= makeMusic(); if (music.current.start(v, prefs.vol)) setSound(v); else say("Sound could not start in this browser."); };
  const setVolume = (v: number) => { update({ vol: v }); music.current?.vol(v); };
  const mine = (id: string) => !!places[id];
  const where = (id: string) => { const p = places[id]; return p ? `Chapter ${p.n}${editions.length > 1 ? ` · ${editions.find((e) => e.kind === p.ed)?.label ?? p.ed}` : ""}` : ""; };

  const renderPara = (p: Props["paragraphs"][number]) => {
    const cls = [bms.some((b) => b.chapter_id === chapter.id && b.para_idx === p.idx) ? "bm" : "", speaking === p.idx ? "speaking" : ""];
    if (lang) { const t = tr[trKey(p.idx)]; return <p key={p.idx} data-i={p.idx} className={[...cls, t ? "" : "orig"].join(" ")}>{t ?? p.body}</p>; }
    const ms = marks.filter((m) => m.chapter_id === chapter.id && m.para_idx === p.idx).sort((a, b) => a.start_off - b.start_off);
    const out: React.ReactNode[] = []; let pos = 0;
    for (const m of ms) {
      if (m.start_off < pos || m.end_off > p.body.length) continue;
      out.push(p.body.slice(pos, m.start_off), <mark key={m.id} className={`hl c${m.color}${m.note ? " note" : ""}`} title={m.note || undefined}
        onClick={(e) => { if (!window.getSelection()?.isCollapsed) return; const r = e.currentTarget.getBoundingClientRect(), below = r.top < 70; setPop({ kind: "mark", mark: m, x: Math.max(165, Math.min(window.innerWidth - 165, r.left + r.width / 2)), y: below ? r.bottom + 8 : r.top - 8, below }); }}>{p.body.slice(m.start_off, m.end_off)}</mark>);
      pos = m.end_off;
    }
    out.push(p.body.slice(pos));
    return <p key={p.idx} data-i={p.idx} className={cls.join(" ")}>{out}</p>;
  };

  const style = { display: "flex", "--rs": prefs.size + "px", "--rl": prefs.lh, "--rw": prefs.width + "px", "--rf": prefs.font === "sans" ? '"Noto Sans Sinhala","Figtree",sans-serif' : "var(--read)" } as React.CSSProperties;
  const myBms = bms.filter((b) => mine(b.chapter_id)), myMarks = marks.filter((m) => mine(m.chapter_id));

  return (
    <div id="reader" data-rt={prefs.theme} className={focus ? "focus" : ""} style={style} onClick={(e) => { const t = e.target as HTMLElement; if (menu && !t.closest(".menu,[data-menu]")) setMenu(null); if (pop && !t.closest(".pop,mark") && window.getSelection()?.isCollapsed) setPop(null); }}>
      <div className="rbar">
        <Link className="rb" href={`/books/${book.slug}`}>Back</Link>
        <button className={`rb${prefs.toc ? " on" : ""}`} aria-expanded={prefs.toc} aria-controls="rtoc" onClick={() => update({ toc: !prefs.toc })}>පටුන</button>
        <span className="t">{book.title}</span>
        {editions.length > 1 && <select className="rb" aria-label="Edition" value={edition} onChange={(e) => go(e.target.value, chapter.n)}>
          {editions.map((e) => <option key={e.kind} value={e.kind} disabled={e.locked}>{e.label}{e.locked ? " (subscribers)" : ""}</option>)}
        </select>}
        <select className="rb" aria-label="Translate the text" value={lang} onChange={(e) => { stopSpeaking(); setLang(e.target.value); setPop(null); if (e.target.value) translateMore(e.target.value); }}>
          <option value="">Original language</option>{LANGS.map((l) => <option key={l[0]} value={l[0]}>Translate: {l[1]}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button className={`rb${speaking !== null ? " on" : ""}`} onClick={aloud}>{speaking !== null ? "Stop reading" : "Read aloud"}</button>
        <button className={`rb${menu === "music" || sound !== "off" ? " on" : ""}`} data-menu onClick={() => setMenu(menu === "music" ? null : "music")}>Music</button>
        <button className={`rb${menu === "look" ? " on" : ""}`} data-menu aria-label="Text and theme" onClick={() => setMenu(menu === "look" ? null : "look")}>Aa</button>
        <button className="rb" onClick={bookmark}>Bookmark</button>
        <button className={`rb${panel === "notes" ? " on" : ""}`} onClick={() => setPanel(panel === "notes" ? null : "notes")}>Notes</button>
        <button className={`rb${panel === "ai" ? " on" : ""}`} onClick={() => setPanel(panel === "ai" ? null : "ai")}>Ask AI</button>
        <button className="rb" onClick={() => { setFocus(true); setMenu(null); setPanel(null); }}>Focus</button>
      </div>
      <div className="rprog"><i style={{ width: pct + "%" }} /></div>

      {menu === "look" && <div className="menu on" style={{ top: 52, right: 12 }}>
        <label>Layout<Seg<View> opts={[["spread", "Two pages"], ["page", "One page"], ["scroll", "Scroll"]]} cur={prefs.view} set={(v) => update({ view: v })} /></label>
        <label>Text size<div className="seg"><button className="rb" aria-label="Smaller text" onClick={() => update({ size: Math.max(14, prefs.size - 2) })}>A−</button><button className="rb" aria-label="Larger text" onClick={() => update({ size: Math.min(30, prefs.size + 2) })}>A+</button></div></label>
        <label>Theme<Seg opts={[["light", "White"], ["sepia", "Sepia"], ["dark", "Dark"]]} cur={prefs.theme} set={(v) => update({ theme: v })} /></label>
        <label>Font<Seg opts={[["serif", "Serif"], ["sans", "Sans"]]} cur={prefs.font} set={(v) => update({ font: v })} /></label>
        <label>Line spacing<Seg opts={[[1.6, "Tight"], [1.9, "Normal"], [2.3, "Loose"]]} cur={prefs.lh} set={(v) => update({ lh: v })} /></label>
        <label>Page width<Seg opts={[[560, "Narrow"], [680, "Medium"], [860, "Wide"]]} cur={prefs.width} set={(v) => update({ width: v })} /></label>
      </div>}
      {menu === "music" && <div className="menu on" style={{ top: 52, right: 12 }}>
        <label>Calm focus sound<Seg<Sound> opts={[["off", "Off"], ["rain", "Rain"], ["stream", "Stream"], ["drone", "Calm drone"]]} cur={sound} set={chooseSound} /></label>
        <label>Volume<input type="range" min="0" max="0.6" step="0.02" value={prefs.vol} onChange={(e) => setVolume(Number(e.target.value))} /></label>
        <label>Read-aloud speed<Seg opts={[[0.8, "0.8x"], [1, "1x"], [1.25, "1.25x"], [1.5, "1.5x"]]} cur={prefs.rate} set={(v) => update({ rate: v })} /></label>
      </div>}

      <div className="rbody">
        <nav id="rtoc" className={`rtoc${prefs.toc ? " on" : ""}`} aria-label="Contents">
          <h3>පටුන<span style={{ flex: 1 }} /><button className="rb" onClick={() => update({ toc: false })} aria-label="Close the contents">✕</button></h3>
          <ol>{chapters.map((c) => {
            const here = c.id === chapter.id, secs = sections[c.id] ?? [];
            return <li key={c.id} className={here ? "here" : ""}>
              <button className="tc" aria-current={here ? "page" : undefined} onClick={() => { if (!here) go(edition, c.n); else reveal(scroller.current?.querySelector("h1") ?? null); if (window.innerWidth < 900) update({ toc: false }); }}>{c.title}</button>
              {here && secs.length > 0 && <ol>{secs.map((x) => <li key={x.idx}><button className="ts" onClick={() => { flash(x.idx); if (window.innerWidth < 900) update({ toc: false }); }}>{x.title}</button></li>)}</ol>}
            </li>;
          })}</ol>
        </nav>

        <div ref={stage} className={`rstage${paged ? " paged" : ""}`}
          onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, t: Date.now() }; }}
          onTouchEnd={(e) => { const s0 = touch.current, t = e.changedTouches[0]; touch.current = null; if (!s0 || !paged || !window.getSelection()?.isCollapsed) return;
            const dx = t.clientX - s0.x, dy = t.clientY - s0.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s0.t < 700) turn(dx < 0 ? 1 : -1); }}>
          {paged && <button className="turn prev" aria-label="Previous page" onClick={() => turn(-1)} disabled={spread === 0 && index === 0}>‹</button>}
          <div className={`book${paged && geo?.cols === 2 ? " spread" : ""}`} style={paged && geo ? { width: geo.cols * geo.pw + geo.cols * geo.g, paddingInline: geo.g / 2 } : undefined}>
            {paged && geo && <div className="rhead"><span>{book.title}</span>{geo.cols === 2 && <span>{chapter.title}</span>}</div>}
            <div className="rscroll" ref={scroller} onScroll={onScroll}
              style={paged && geo ? { width: geo.cols * geo.pw + (geo.cols - 1) * geo.g, height: geo.ph } : undefined}>
              <div className="rtext" style={paged && geo ? { height: geo.ph, columnCount: geo.cols, columnGap: geo.g } : undefined}>
                <h1>{chapter.title}</h1>
                <div className="sub">{chapter.subtitle || `Chapter ${chapter.n}`}{lang ? ` · AI translation to ${lang}` : ""}</div>
                {paragraphs.map((p) => p.kind === "v" ? <div className={`verse${speaking === p.idx ? " speaking" : ""}`} data-i={p.idx} key={p.idx} style={{ whiteSpace: "pre-line" }}>{p.body}</div>
                  : p.kind === "h" ? <h2 key={p.idx} data-i={p.idx} className="rsec">{p.body}</h2> : renderPara(p))}
                {untranslated > 0 && <p style={{ textAlign: "center" }}><button className="rb" disabled={busy} onClick={() => translateMore()}>{busy ? "Translating…" : "Translate the next section"}</button></p>}
                {!paged && <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 40 }}>
                  {index > 0 ? <button className="rb" onClick={() => go(edition, chapters[index - 1].n)}>Previous chapter</button> : <span />}
                  {index < chapters.length - 1 && <button className="rb" onClick={() => go(edition, chapters[index + 1].n)}>Next chapter</button>}
                </div>}
                {paged && index === chapters.length - 1 && <p className="theend">නිමි</p>}
              </div>
            </div>
            {paged && geo && <div className="pnums">
              {Array.from({ length: geo.cols }, (_, k) => { const n = spread * geo.cols + k + 1; return <span key={k}>{n <= pages ? n : ""}</span>; })}
            </div>}
          </div>
          {paged && <button className="turn next" aria-label="Next page" onClick={() => turn(1)} disabled={spread >= spreads - 1 && index >= chapters.length - 1}>›</button>}
          {loading && <div className="rbusy" role="status"><span className="spin" aria-hidden />Loading the chapter…</div>}
        </div>

        <aside className={`rpanel${panel ? " on" : ""}`} aria-label={panel === "ai" ? "Reading assistant" : "Bookmarks and notes"}>
          {panel === "notes" && <>
            <h3>Bookmarks, highlights, notes<span style={{ flex: 1 }} /><button className="rb" onClick={() => setPanel(null)}>Close</button></h3>
            <div className="pb">
              {!signedIn && <span className="small"><Link href={`/login?next=/read/${book.slug}`}>Sign in</Link> to save bookmarks, highlights and notes.</span>}
              <b className="small">Bookmarks</b>
              {myBms.length ? myBms.map((b) => <div key={b.id} className="ritem" role="button" tabIndex={0} onClick={() => jump(b.chapter_id, b.para_idx)} onKeyDown={(e) => e.key === "Enter" && jump(b.chapter_id, b.para_idx)}>
                <q>{b.snippet}…</q><span style={{ color: "var(--rmut)" }}>{where(b.chapter_id)}</span>
                <button className="rb" style={{ float: "right", padding: "1px 7px" }} onClick={(e) => { e.stopPropagation(); setBms((l) => l.filter((x) => x.id !== b.id)); deleteBookmark(b.id); }}>Remove</button></div>)
                : <span className="small" style={{ color: "var(--rmut)" }}>Press Bookmark to save your place.</span>}
              <b className="small" style={{ marginTop: 8 }}>Highlights and notes</b>
              {myMarks.length ? myMarks.map((m) => <div key={m.id} className="ritem" role="button" tabIndex={0} onClick={() => jump(m.chapter_id, m.para_idx)} onKeyDown={(e) => e.key === "Enter" && jump(m.chapter_id, m.para_idx)}>
                <q><mark className={`hl c${m.color}`}>{m.quote.slice(0, 140)}</mark></q>{m.note && <div>Note: {m.note}</div>}<span style={{ color: "var(--rmut)" }}>{where(m.chapter_id)}</span>
                <button className="rb" style={{ float: "right", padding: "1px 7px" }} onClick={(e) => { e.stopPropagation(); removeMark(m.id); }}>Remove</button></div>)
                : <span className="small" style={{ color: "var(--rmut)" }}>Select any text to highlight it or add a note.</span>}
            </div>
          </>}
          {panel === "ai" && <>
            <h3>Reading assistant<span style={{ flex: 1 }} /><button className="rb" onClick={() => setPanel(null)}>Close</button></h3>
            <div className="pb" ref={chatBox} aria-live="polite">
              {chat.length ? chat.map((m, i) => <div key={i} className={`msg ${m.role === "user" ? "u" : "a"}`}>{m.content}</div>) : <>
                <span className="small" style={{ color: "var(--rmut)" }}>Ask about anything in this chapter, in Sinhala or English. Select text first to ask about that passage.</span>
                {QUICK.map((x) => <button key={x} className="rb" style={{ textAlign: "left", whiteSpace: "normal" }} onClick={() => ask(x)}>{x}</button>)}</>}
              {asking && <div className="msg a">Thinking…</div>}
            </div>
            <form className="chatin" data-local onSubmit={(e) => { e.preventDefault(); ask(q); setQ(""); }}>
              <textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this chapter" aria-label="Ask the reading assistant" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); setQ(""); } }} />
              <button className="rb on" disabled={asking || !q.trim()}>Send</button>
            </form>
          </>}
        </aside>
      </div>

      <button className="rb exitfocus" onClick={() => setFocus(false)}>Exit focus mode</button>

      {pop && <div className="pop" style={{ display: "flex", left: pop.x, top: pop.y, transform: `translate(-50%, ${pop.below ? "0" : "-100%"})` }} onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault(); }}>
        {pop.kind === "mark" ? <>{pop.mark.note && <span style={{ padding: "4px 8px", maxWidth: 220 }}>{pop.mark.note}</span>}<button onClick={() => removeMark(pop.mark.id)}>Remove highlight</button></>
          : pop.noting ? <form style={{ display: "flex", gap: 4 }} data-local onSubmit={(e) => { e.preventDefault(); addMark(1, note.trim()); }}>
            <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a note" aria-label="Note" maxLength={1000} style={{ border: 0, borderRadius: 7, padding: "7px 9px", width: 200, color: "#111", background: "#fff" }} /><button>Save</button></form>
          : <>
            {!lang && <>{SWATCH.map((c, i) => <button key={c} className="sw" style={{ background: c }} aria-label={`Highlight colour ${i + 1}`} onClick={() => addMark(i + 1)} />)}
              <button onClick={() => (signedIn ? setPop({ ...pop, noting: true }) : say("Sign in to save highlights and notes."))}>Note</button></>}
            <button onClick={() => ask(`Explain this passage in simple words:\n"${pop.sel.text}"`)}>Explain</button>
            <button onClick={() => ask(`What does this mean? Give the meaning in simple Sinhala and in English, and explain any old or difficult words:\n"${pop.sel.text}"`)}>Meaning</button>
            <button onClick={() => { const t = pop.sel.text; setPop(null); speakLines([{ i: null, text: t }]); }}>Listen</button>
          </>}
      </div>}

      {toast && <div role="status" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 80, background: "#14201e", color: "#fff", padding: "10px 16px", borderRadius: 10, maxWidth: "min(92vw, 460px)", fontSize: 14, boxShadow: "0 6px 24px rgba(0,0,0,.35)" }}>{toast}</div>}
    </div>
  );
}
