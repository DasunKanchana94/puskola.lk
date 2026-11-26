import Link from "next/link";
import { Submit } from "@/components/Submit";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { fileUrl } from "@/lib/data";
import { adminDelete, adminInsert, adminUpdate } from "@/app/admin-actions";
import { TextImport } from "@/components/TextImport";
import { NarrationUpload, type ChapterAudio } from "@/components/NarrationUpload";
import { BookFields } from "@/components/BookFields";
import { FileUpload } from "@/components/FileUpload";
import { Notice } from "@/components/ui";

export const metadata = { title: "Edit book" };
type Edition = { id: string; kind: string; label: string; tier: string; sort: number; chapters: { count: number }[] };

export default async function EditBook({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const [{ id }, { error, notice }] = await Promise.all([params, searchParams]);
  const supabase = await db();
  const [{ data: book }, { data: authors }, { data: cats }] = await Promise.all([
    supabase.from("books").select("*,book_editions(id,kind,label,tier,sort,chapters(count))").eq("id", id).maybeSingle(),
    supabase.from("authors").select("id,name").order("name"), supabase.from("categories").select("id,name").order("sort"),
  ]);
  if (!book) notFound();
  const back = `/admin/books/${id}`, cover = fileUrl("covers", book.cover_path);
  const editions = ([...book.book_editions] as Edition[]).sort((a, b) => a.sort - b.sort);
  const { data: chs } = editions.length
    ? await supabase.from("chapters").select("id,n,title,edition_id,audio_tracks(duration_sec,timings)").in("edition_id", editions.map((e) => e.id)).order("n")
    : { data: [] };
  type Ch = { id: string; n: number; title: string; edition_id: string; audio_tracks: { duration_sec: number; timings: unknown }[] | { duration_sec: number; timings: unknown } | null };
  const audioOf = (edId: string): ChapterAudio[] => ((chs ?? []) as Ch[]).filter((c) => c.edition_id === edId).map((c) => {
    const t = Array.isArray(c.audio_tracks) ? c.audio_tracks[0] : c.audio_tracks;
    return { id: c.id, n: c.n, title: c.title, track: t ? { duration: t.duration_sec, timed: !!t.timings } : null };
  });
  return <>
    <div className="row"><h1>{book.title_en}</h1><span className="sp" /><Link className="btn sm" href={`/books/${book.slug}`}>View on site</Link><Link className="btn sm" href="/admin/books">All books</Link></div>
    <div style={{ marginTop: 14 }}><Notice error={error} notice={notice} /></div>
    <div className="two" style={{ alignItems: "start" }}>
      <form action={adminUpdate.bind(null, "books", id)} className="card" style={{ display: "grid", gap: 12 }}>
        <h2>Details</h2><input type="hidden" name="_back" value={back} />
        <BookFields book={book} authors={authors ?? []} categories={cats ?? []} withSlug />
        <div><Submit className="btn pri">Save details</Submit></div>
      </form>
      <div style={{ display: "grid", gap: 16 }}>
        <div className="card"><h2>Cover image</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={cover} alt="Current cover" style={{ width: 120, borderRadius: 6, margin: "12px 0", display: "block" }} /> : <p className="muted small" style={{ margin: "10px 0" }}>No cover yet. A plain cover is shown until you upload one.</p>}
          <FileUpload bucket="covers" table="books" id={id} accept="image/*" label={cover ? "Replace cover" : "Upload cover"} maxMb={5} />
          <p className="muted small" style={{ marginTop: 8 }}>JPG or PNG, up to 5 MB. Portrait shape works best.</p>
        </div>
        <div className="card"><h2>Editions and text</h2>
          <p className="muted small" style={{ margin: "6px 0 12px" }}>Each edition is one version of the text, such as classical and modern Sinhala. Access is set per edition.</p>
          {editions.map((e) => <div key={e.id} style={{ borderTop: "1px solid var(--line)", padding: "12px 0", display: "grid", gap: 8 }}>
            <form action={adminUpdate.bind(null, "book_editions", e.id)} className="row"><input type="hidden" name="_back" value={back} />
              <input className="inp" style={{ flex: 1, minWidth: 140 }} name="label" aria-label="Edition name" defaultValue={e.label} required />
              <select className="inp" style={{ width: "auto" }} name="tier" aria-label="Access" defaultValue={e.tier}><option value="free">Free</option><option value="sub">Subscription</option></select>
              <Submit className="btn sm">Save</Submit></form>
            <div className="small">{e.chapters?.[0]?.count ? <span className="pill">{e.chapters[0].count} chapters loaded</span> : <span className="pill grey">No text yet</span>}</div>
            <TextImport editionId={e.id} bookId={id} title={book.title_si} hasText={!!e.chapters?.[0]?.count} />
            {!!e.chapters?.[0]?.count && <NarrationUpload editionId={e.id} chapters={audioOf(e.id)} />}
            {editions.length > 1 && <form action={adminDelete.bind(null, "book_editions", e.id)}><input type="hidden" name="_back" value={back} /><Submit className="btn sm ghost danger">Delete this edition and its text</Submit></form>}
          </div>)}
          <form action={adminInsert.bind(null, "book_editions")} className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <input type="hidden" name="_back" value={back} /><input type="hidden" name="book_id" value={id} /><input type="hidden" name="sort" value={editions.length + 1} />
            <input className="inp" style={{ flex: 1, minWidth: 120 }} name="label" placeholder="New edition name" aria-label="New edition name" required />
            <input className="inp" style={{ width: 120 }} name="kind" placeholder="short-code" aria-label="Short code, such as modern" pattern="[a-z0-9-]+" required />
            <select className="inp" style={{ width: "auto" }} name="tier" aria-label="Access" defaultValue="sub"><option value="free">Free</option><option value="sub">Subscription</option></select>
            <Submit className="btn sm">Add edition</Submit></form>
          <p className="muted small" style={{ marginTop: 10 }}>Text files: .txt or the .json made by the restoration work, up to 4 MB. In a .txt file, start each chapter with a line beginning &quot;# &quot;, leave a blank line between paragraphs, and begin verse lines with &quot;&gt;&quot;. PDF and Word files are not converted yet.</p>
        </div>
        <form action={adminDelete.bind(null, "books", id)} className="card"><input type="hidden" name="_back" value="/admin/books" /><h2>Delete book</h2><p className="muted small" style={{ margin: "6px 0 10px" }}>Removes the book, its editions, its text and readers&apos; bookmarks in it. This cannot be undone.</p><Submit className="btn danger">Delete {book.title_en}</Submit></form>
      </div>
    </div>
  </>;
}
