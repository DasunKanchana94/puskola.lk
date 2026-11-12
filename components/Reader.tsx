"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveProgress } from "@/app/actions";

type Props = {
  book: { id: string; slug: string; title: string };
  editions: { kind: string; label: string }[]; edition: string;
  chapters: { n: number; title: string }[];
  chapter: { id: string; n: number; title: string; subtitle: string };
  paragraphs: { idx: number; kind: string; body: string }[];
  signedIn: boolean;
};
type Prefs = { theme: "light" | "sepia" | "dark"; size: number };
const KEY = "puskola-reader";

export function Reader({ book, editions, edition, chapters, chapter, paragraphs, signedIn }: Props) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>({ theme: "light", size: 19 });
  const [menu, setMenu] = useState(false);
  const [pct, setPct] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setPrefs((p) => ({ ...p, ...JSON.parse(s) })); } catch {} }, []);
  const update = (p: Partial<Prefs>) => setPrefs((old) => { const next = { ...old, ...p }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} return next; });
  const go = (ed: string, n: number) => router.push(`/read/${book.slug}?ed=${ed}&ch=${n}`);
  const index = chapters.findIndex((c) => c.n === chapter.n);

  const onScroll = () => {
    const el = scroller.current; if (!el) return;
    const frac = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    const overall = Math.round(((index + frac) / chapters.length) * 100);
    setPct(overall);
    if (!signedIn) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const top = el.getBoundingClientRect().top + 50;
      const first = [...el.querySelectorAll<HTMLElement>("[data-i]")].find((p) => p.getBoundingClientRect().bottom > top);
      saveProgress(book.id, chapter.id, Number(first?.dataset.i ?? 0), overall);
    }, 1200);
  };
  useEffect(() => { scroller.current?.scrollTo(0, 0); if (signedIn) saveProgress(book.id, chapter.id, 0, Math.round((index / chapters.length) * 100)); }, [chapter.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div id="reader" data-rt={prefs.theme} style={{ display: "flex", ["--rs" as string]: prefs.size + "px" }}>
      <div className="rbar">
        <Link className="rb" href={`/books/${book.slug}`}>Back</Link>
        <span className="t">{book.title}</span>
        <select className="rb" id="r-ch" aria-label="Chapter" value={chapter.n} onChange={(e) => go(edition, Number(e.target.value))}>
          {chapters.map((c) => <option key={c.n} value={c.n}>Ch. {c.n} {c.title}</option>)}
        </select>
        {editions.length > 1 && <select className="rb" id="r-ed" aria-label="Edition" value={edition} onChange={(e) => go(e.target.value, chapter.n)}>
          {editions.map((e) => <option key={e.kind} value={e.kind}>{e.label}</option>)}
        </select>}
        <span style={{ flex: 1 }} />
        <button className={`rb${menu ? " on" : ""}`} aria-label="Text and theme" onClick={() => setMenu(!menu)}>Aa</button>
      </div>
      <div className="rprog"><i style={{ width: pct + "%" }} /></div>
      {menu && <div className="menu on" style={{ top: 52, right: 12 }}>
        <label>Text size<div className="seg"><button className="rb" aria-label="Smaller text" onClick={() => update({ size: Math.max(14, prefs.size - 2) })}>A−</button><button className="rb" aria-label="Larger text" onClick={() => update({ size: Math.min(30, prefs.size + 2) })}>A+</button></div></label>
        <label>Theme<div className="seg">{(["light", "sepia", "dark"] as const).map((t) => <button key={t} className={`rb${prefs.theme === t ? " on" : ""}`} onClick={() => update({ theme: t })}>{t === "light" ? "White" : t === "sepia" ? "Sepia" : "Dark"}</button>)}</div></label>
      </div>}
      <div className="rbody"><div className="rscroll" ref={scroller} onScroll={onScroll}><div className="rtext">
        <h1>{chapter.title}</h1>
        <div className="sub">Chapter {chapter.n}{chapter.subtitle ? ` · ${chapter.subtitle}` : ""}</div>
        {paragraphs.map((p) => p.kind === "v" ? <div className="verse" key={p.idx} style={{ whiteSpace: "pre-line" }}>{p.body}</div>
          : p.kind === "h" ? <h2 key={p.idx} style={{ textAlign: "center", margin: "1.4em 0 .6em", fontFamily: "inherit" }}>{p.body}</h2>
          : <p key={p.idx} data-i={p.idx}>{p.body}</p>)}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 40 }}>
          {index > 0 ? <button className="rb" onClick={() => go(edition, chapters[index - 1].n)}>Previous chapter</button> : <span />}
          {index < chapters.length - 1 && <button className="rb" onClick={() => go(edition, chapters[index + 1].n)}>Next chapter</button>}
        </div>
      </div></div></div>
    </div>
  );
}
