import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { getBook, getViewer } from "@/lib/data";
import { Reader } from "@/components/Reader";

export default async function ReadPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ed?: string; ch?: string }> }) {
  const [{ slug }, { ed, ch }] = await Promise.all([params, searchParams]);
  const [book, viewer] = await Promise.all([getBook(slug), getViewer()]);
  if (!book) notFound();
  const supabase = await db();
  const editions = [...book.book_editions].sort((a, b) => a.sort - b.sort);
  const edition = editions.find((e) => e.kind === ed) ?? editions[0];
  if (!edition) notFound();
  const { data: chapters } = await supabase.from("chapters").select("id,n,title,subtitle").eq("edition_id", edition.id).order("n");
  const list = chapters ?? [];
  let start = Number(ch) || 0;
  if (!start && viewer) {
    const { data: p } = await supabase.from("reading_progress").select("chapter_id").eq("user_id", viewer.id).eq("book_id", book.id).maybeSingle();
    start = list.find((c) => c.id === p?.chapter_id)?.n ?? 0;
  }
  const chapter = list.find((c) => c.n === start) ?? list[0];
  const { data: paragraphs } = chapter ? await supabase.from("paragraphs").select("idx,kind,body").eq("chapter_id", chapter.id).order("idx") : { data: [] };
  const locked = edition.tier === "sub" && !viewer?.hasPlan && viewer?.role !== "admin";

  if (!chapter || !(paragraphs ?? []).length) {
    return <main style={{ maxWidth: 520, margin: "80px auto", padding: "0 20px" }}>
      <title>{`${book.title_en} | Puskola`}</title>
      <h1>{book.title_si}</h1>
      <p style={{ margin: "14px 0" }}>{locked ? `The ${edition.label} edition is for subscribers.` : "The text of this edition has not been added yet."}</p>
      <div className="row">{locked && <Link className="btn pri" href="/plans">See plans</Link>}<Link className="btn" href={`/books/${book.slug}`}>Back to the book</Link></div>
    </main>;
  }
  return <>
    <title>{`${chapter.title} | ${book.title_en} | Puskola`}</title>
    <Reader book={{ id: book.id, slug: book.slug, title: book.title_si }} editions={editions.map((e) => ({ kind: e.kind, label: e.label }))} edition={edition.kind}
      chapters={list.map((c) => ({ n: c.n, title: c.title }))} chapter={chapter} paragraphs={paragraphs ?? []} signedIn={!!viewer} />
  </>;
}
