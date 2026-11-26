import Link from "next/link";
import { notFound } from "next/navigation";
import { Headphones, Lock } from "lucide-react";
import { db } from "@/lib/supabase/server";
import { fileUrl, getBook, getViewer } from "@/lib/data";
import { Listener, type ListenChapter } from "@/components/Listener";

type Row = { id: string; n: number; title: string; edition_id: string; audio_tracks: Track[] | Track | null };
type Track = { file_path: string; duration_sec: number; timings: ListenChapter["timings"] };

export default async function ListenPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ed?: string; ch?: string }> }) {
  const [{ slug }, { ed, ch }] = await Promise.all([params, searchParams]);
  const [book, viewer] = await Promise.all([getBook(slug), getViewer()]);
  if (!book) notFound();
  const supabase = await db();
  const editions = [...book.book_editions].sort((a, b) => a.sort - b.sort);
  const { data: rows } = editions.length
    ? await supabase.from("chapters").select("id,n,title,edition_id,audio_tracks(file_path,duration_sec,timings)").in("edition_id", editions.map((e) => e.id)).order("n")
    : { data: [] };
  const all = ((rows ?? []) as Row[]).map((r) => ({ ...r, track: (Array.isArray(r.audio_tracks) ? r.audio_tracks[0] : r.audio_tracks) ?? null }));

  // The edition to play: the one asked for, else the first one that has narration.
  const edition = editions.find((e) => e.kind === ed && all.some((c) => c.edition_id === e.id && c.track))
    ?? editions.find((e) => all.some((c) => c.edition_id === e.id && c.track));
  const back = `/books/${book.slug}`;
  if (!edition) return <Empty title={book.title_si} back={back} text="This book has no narration yet." />;

  const entitled = edition.tier === "free" || !!viewer?.hasPlan || viewer?.role === "admin";
  if (!entitled) return <Empty title={book.title_si} back={back} locked text="Narration of this book comes with a Puskola plan." />;

  const chapters: ListenChapter[] = all.filter((c) => c.edition_id === edition.id).map((c) => ({
    id: c.id, n: c.n, title: c.title, path: c.track?.file_path ?? null, duration: c.track?.duration_sec ?? 0, timings: c.track?.timings ?? null,
  }));
  const [{ data: heads }, { data: progress }] = await Promise.all([
    supabase.from("paragraphs").select("chapter_id,idx,body").eq("kind", "h").in("chapter_id", chapters.map((c) => c.id)).order("idx"),
    viewer ? supabase.from("listen_progress").select("chapter_id,position_sec,rate").eq("user_id", viewer.id).eq("book_id", book.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const sections: Record<string, { idx: number; title: string }[]> = {};
  for (const h of heads ?? []) (sections[h.chapter_id] ??= []).push({ idx: h.idx, title: h.body });

  const asked = chapters.find((c) => c.n === Number(ch) && c.path);
  const saved = chapters.find((c) => c.id === progress?.chapter_id && c.path);
  const start = asked ?? saved ?? chapters.find((c) => c.path)!;

  return <>
    <title>{`Listen: ${book.title_en} | Puskola`}</title>
    <Listener
      book={{ id: book.id, slug: book.slug, title: book.title_si, titleEn: book.title_en, author: book.authors?.name ?? "", cover: fileUrl("covers", book.cover_path) }}
      edition={edition.kind} chapters={chapters} sections={sections} signedIn={!!viewer}
      startChapterId={start.id} startAt={!asked && saved ? Math.max(0, (progress?.position_sec ?? 0) - 3) : 0} startRate={progress?.rate ?? 1} />
  </>;
}

function Empty({ title, back, text, locked }: { title: string; back: string; text: string; locked?: boolean }) {
  return (
    <div className="lempty">
      <span className="lempty-icon">{locked ? <Lock size={28} strokeWidth={1.75} aria-hidden /> : <Headphones size={28} strokeWidth={1.75} aria-hidden />}</span>
      <h1>{title}</h1>
      <p className="muted">{text}</p>
      <div className="row" style={{ justifyContent: "center" }}>
        {locked && <Link className="btn pri" href="/plans">See plans</Link>}
        <Link className="btn" href={back}>Back to the book</Link>
      </div>
    </div>
  );
}
