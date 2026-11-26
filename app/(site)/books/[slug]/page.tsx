import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Globe2, Headphones, Layers, Lock, PenLine, Tag } from "lucide-react";
import { db } from "@/lib/supabase/server";
import { getBook, getCategories, getCountry, getViewer, countryName } from "@/lib/data";
import { Cover } from "@/components/ui";

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [book, cats, viewer, country] = await Promise.all([getBook(slug), getCategories(), getViewer(), getCountry()]);
  if (!book) notFound();
  if (book.regions.length && !book.regions.includes(country)) return <div className="empty"><b>{book.title_en} is not available in {countryName(country)}.</b><Link className="btn" href="/browse">Browse books available in your country</Link></div>;
  const cat = cats.find((c) => c.id === book.category_id);
  const editions = [...book.book_editions].sort((a, b) => a.sort - b.sort);
  const supabase = await db();
  const [{ data: counts }, { data: tracks }] = editions.length
    ? await Promise.all([
      supabase.from("chapters").select("edition_id").in("edition_id", editions.map((e) => e.id)),
      supabase.from("audio_tracks").select("edition_id,duration_sec").in("edition_id", editions.map((e) => e.id)),
    ])
    : [{ data: [] as { edition_id: string }[] }, { data: [] as { edition_id: string; duration_sec: number }[] }];
  const narrated = editions.find((e) => (tracks ?? []).some((t) => t.edition_id === e.id));
  const listenMins = Math.round((tracks ?? []).filter((t) => t.edition_id === narrated?.id).reduce((s, t) => s + t.duration_sec, 0) / 60);
  const chaptersOf = (id: string) => (counts ?? []).filter((c) => c.edition_id === id).length;
  const canRead = (tier: string) => tier === "free" || !!viewer?.hasPlan || viewer?.role === "admin";
  const first = editions.find((e) => chaptersOf(e.id) > 0) ?? editions[0];
  const anyFree = editions.some((e) => e.tier === "free");

  return <div className="bookp">
    <title>{`${book.title_en} (${book.title_si}) | Puskola`}</title>
    <div><Cover book={book} color={cat?.color} /></div>
    <div>
      <div className="row" style={{ gap: 8 }}>
        {cat && <Link className="pill grey" href={`/browse?cat=${cat.id}`} style={{ textDecoration: "none" }}>{cat.name}</Link>}
        {anyFree ? <span className="pill">Free to read</span> : <span className="pill gold">Subscription</span>}
        {book.is_new && <span className="pill gold">New</span>}
      </div>
      <h1 style={{ marginTop: 12 }}>{book.title_si}</h1>
      <p className="muted" style={{ fontSize: 18, marginTop: 4 }}>{book.title_en}</p>
      <div className="facts">
        {book.authors && <span><PenLine size={16} strokeWidth={1.75} aria-hidden /><Link href={`/authors/${book.authors.slug}`}>{book.authors.name}</Link></span>}
        <span><Globe2 size={16} strokeWidth={1.75} aria-hidden />{book.language}</span>
        {first && chaptersOf(first.id) > 0 && <span><Layers size={16} strokeWidth={1.75} aria-hidden />{chaptersOf(first.id)} chapters</span>}
        {narrated && <span><Headphones size={16} strokeWidth={1.75} aria-hidden />{listenMins >= 60 ? `${Math.floor(listenMins / 60)} h ${listenMins % 60} min` : `${listenMins} min`} audiobook</span>}
        {editions.length > 1 && <span><Tag size={16} strokeWidth={1.75} aria-hidden />{editions.length} editions</span>}
      </div>

      {first && <div className="cta">
        {chaptersOf(first.id) === 0 ? <span className="btn lg disabled" aria-disabled="true">Text coming soon</span>
          : canRead(first.tier) ? <Link className="btn pri lg" href={`/read/${book.slug}?ed=${first.kind}`}><BookOpen size={19} strokeWidth={1.75} aria-hidden />Start reading</Link>
          : <Link className="btn pri lg" href="/plans"><Lock size={18} strokeWidth={1.75} aria-hidden />Subscribe to read</Link>}
        {narrated && (canRead(narrated.tier)
          ? <Link className="btn lg" href={`/listen/${book.slug}?ed=${narrated.kind}`}><Headphones size={19} strokeWidth={1.75} aria-hidden />Listen</Link>
          : null)}
        {!viewer && !narrated && <Link className="btn lg" href="/login">Sign in to save your place</Link>}
      </div>}

      {book.description && <p className="desc">{book.description}</p>}

      {editions.length > 1 && <>
        <h2 style={{ margin: "30px 0 12px" }}>Editions</h2>
        <div className="mlist">{editions.map((e) => {
          const n = chaptersOf(e.id);
          return <div className="mrow" key={e.id}>
            <div><b>{e.label}</b><div className="small row" style={{ gap: 8, marginTop: 2 }}>
              {e.tier === "free" ? <span className="pill">Free</span> : <span className="pill gold">Subscription</span>}
              <span className="muted">{n ? `${n} chapters` : "Text coming soon"}</span></div></div>
            <span className="sp" />
            {n === 0 ? null : canRead(e.tier) ? <Link className="btn" href={`/read/${book.slug}?ed=${e.kind}`}>Read this edition</Link> : <Link className="btn" href="/plans">Subscribe to read</Link>}
          </div>;
        })}</div>
      </>}
    </div>
  </div>;
}
