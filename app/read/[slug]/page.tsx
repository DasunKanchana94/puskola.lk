import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { getBook, getViewer } from "@/lib/data";
import { Reader } from "@/components/Reader";
import type { Bookmark, Highlight } from "@/app/reader-actions";

export default async function ReadPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ed?: string; ch?: string; p?: string }> }) {
  const [{ slug }, { ed, ch, p }] = await Promise.all([params, searchParams]);
  const [book, viewer] = await Promise.all([getBook(slug), getViewer()]);
  if (!book) notFound();
  const supabase = await db();
  const entitled = !!viewer?.hasPlan || viewer?.role === "admin";
  const editions = [...book.book_editions].sort((a, b) => a.sort - b.sort);
  const { data: allChapters } = await supabase.from("chapters").select("id,n,title,subtitle,edition_id").in("edition_id", editions.map((e) => e.id)).order("n");
  const every = allChapters ?? [];

  let progress: { chapter_id: string | null; para_idx: number } | null = null;
  if (viewer && !ch) {
    const { data } = await supabase.from("reading_progress").select("chapter_id,para_idx").eq("user_id", viewer.id).eq("book_id", book.id).maybeSingle();
    progress = data;
  }
  const saved = every.find((c) => c.id === progress?.chapter_id);
  const edition = editions.find((e) => e.kind === ed) ?? editions.find((e) => e.id === saved?.edition_id) ?? editions.find((e) => e.tier === "free" || entitled) ?? editions[0];
  if (!edition) notFound();
  const list = every.filter((c) => c.edition_id === edition.id);
  const chapter = list.find((c) => c.n === Number(ch)) ?? (saved?.edition_id === edition.id ? saved : undefined) ?? list[0];
  const startPara = ch ? Number(p) || 0 : saved && chapter?.id === saved.id ? progress?.para_idx ?? 0 : 0;
  const { data: paragraphs } = chapter ? await supabase.from("paragraphs").select("idx,kind,body").eq("chapter_id", chapter.id).order("idx") : { data: [] };
  const locked = edition.tier === "sub" && !entitled;

  if (!chapter || !(paragraphs ?? []).length) {
    return <main style={{ maxWidth: 520, margin: "80px auto", padding: "0 20px" }}>
      <title>{`${book.title_en} | Puskola`}</title>
      <h1>{book.title_si}</h1>
      <p style={{ margin: "14px 0" }}>{locked ? `The ${edition.label} edition is for subscribers.` : "The text of this edition has not been added yet."}</p>
      <div className="row">{locked && <Link className="btn pri" href="/plans">See plans</Link>}{locked && editions.some((e) => e.tier === "free") && <Link className="btn" href={`/read/${book.slug}?ed=${editions.find((e) => e.tier === "free")!.kind}`}>Read the free edition</Link>}<Link className="btn" href={`/books/${book.slug}`}>Back to the book</Link></div>
    </main>;
  }

  let bookmarks: Bookmark[] = [], highlights: Highlight[] = [];
  if (viewer) {
    const ids = every.map((c) => c.id);
    const [b, h] = await Promise.all([
      supabase.from("bookmarks").select("id,chapter_id,para_idx,snippet").eq("user_id", viewer.id).in("chapter_id", ids).order("created_at"),
      supabase.from("highlights").select("id,chapter_id,para_idx,start_off,end_off,color,note,quote").eq("user_id", viewer.id).in("chapter_id", ids).order("created_at"),
    ]);
    bookmarks = b.data ?? []; highlights = h.data ?? [];
  }
  const kindOf = Object.fromEntries(editions.map((e) => [e.id, e.kind]));
  const places = Object.fromEntries(every.map((c) => [c.id, { n: c.n, ed: kindOf[c.edition_id] }]));

  return <>
    <title>{`${chapter.title} | ${book.title_en} | Puskola`}</title>
    <Reader book={{ id: book.id, slug: book.slug, title: book.title_si, titleEn: book.title_en }}
      editions={editions.map((e) => ({ kind: e.kind, label: e.label, locked: e.tier === "sub" && !entitled }))} edition={edition.kind}
      chapters={list.map((c) => ({ id: c.id, n: c.n, title: c.title }))} chapter={chapter} paragraphs={paragraphs ?? []}
      places={places} bookmarks={bookmarks} highlights={highlights} signedIn={!!viewer} startPara={startPara} />
  </>;
}
