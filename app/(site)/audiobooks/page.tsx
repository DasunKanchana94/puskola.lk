import Link from "next/link";
import { Headphones, Play } from "lucide-react";
import { db } from "@/lib/supabase/server";
import { getBooks, getCategories, getViewer, isFree } from "@/lib/data";
import { Cover } from "@/components/ui";
import { MediaList, type MediaItem } from "@/components/MediaList";

export const metadata = { title: "Audiobooks" };

const length = (sec: number) => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };

export default async function Page() {
  const supabase = await db();
  const [{ data }, viewer, books, cats, { data: tracks }] = await Promise.all([
    supabase.from("media_items").select("id,kind,title,duration,tier,file_path,is_video").in("kind", ["audio", "summary"]).eq("published", true).order("sort"),
    getViewer(), getBooks(), getCategories(),
    supabase.from("audio_tracks").select("edition_id,duration_sec"),
  ]);
  const { data: progress } = viewer
    ? await supabase.from("listen_progress").select("book_id,pct,updated_at").eq("user_id", viewer.id).order("updated_at", { ascending: false })
    : { data: [] as { book_id: string; pct: number; updated_at: string }[] };
  const colors = Object.fromEntries(cats.map((c) => [c.id, c.color]));
  const narrated = books.map((b) => {
    const ids = new Set(b.book_editions.map((e) => e.id));
    const mine = (tracks ?? []).filter((t) => ids.has(t.edition_id));
    return { b, seconds: mine.reduce((s, t) => s + t.duration_sec, 0), chapters: mine.length, pct: (progress ?? []).find((p) => p.book_id === b.id)?.pct };
  }).filter((x) => x.chapters > 0);
  const going = narrated.filter((x) => x.pct !== undefined && x.pct < 99)
    .sort((a, b) => ((progress ?? []).findIndex((p) => p.book_id === a.b.id)) - ((progress ?? []).findIndex((p) => p.book_id === b.b.id)));
  const items = (data ?? []) as MediaItem[];

  return <>
    <div className="row" style={{ alignItems: "end" }}>
      <div><h1>Audiobooks</h1><p className="muted" style={{ marginTop: 6 }}>Listen chapter by chapter, with the text highlighted as it is read. Your place is saved as you go.</p></div>
    </div>

    {going.length > 0 && <section className="sec" style={{ marginTop: 28 }}>
      <div className="sec-h"><h2>Continue listening</h2></div>
      <div className="alist">{going.map(({ b, pct, seconds }) => (
        <Link key={b.id} className="arow" href={`/listen/${b.slug}`}>
          <span className="acv"><Cover book={b} color={colors[b.category_id ?? ""]} tag={false} /></span>
          <span className="ainfo"><b>{b.title_si}</b><span className="muted small">{b.authors?.name} · {length(seconds * (1 - (pct ?? 0) / 100))} left</span>
            <span className="prog"><i style={{ width: `${pct}%` }} /></span></span>
          <span className="aplay" aria-hidden><Play size={20} strokeWidth={2} /></span>
          <span className="sr-only">Continue listening</span>
        </Link>))}</div>
    </section>}

    <section className="sec" style={{ marginTop: 28 }}>
      <div className="sec-h"><h2>Narrated books</h2></div>
      {narrated.length ? <div className="grid">{narrated.map(({ b, seconds, chapters }) => (
        <Link key={b.id} className="bk" href={`/listen/${b.slug}`}>
          <span className="acover"><Cover book={b} color={colors[b.category_id ?? ""]} tag={false} /><span className="abadge"><Headphones size={14} strokeWidth={2} aria-hidden />{length(seconds)}</span></span>
          <h3>{b.title_si}</h3>
          <div className="muted">{chapters} chapters · {isFree(b) ? "Free" : "Subscription"}</div>
        </Link>))}</div>
        : <div className="empty"><Headphones size={28} strokeWidth={1.75} aria-hidden /><b>No narrated books yet</b><span>Narration is being recorded. Meanwhile, every book can be read on Puskola.</span><Link className="btn" href="/browse">Browse books</Link></div>}
    </section>

    {items.length > 0 && <section className="sec">
      <div className="sec-h"><h2>Summaries and more</h2></div>
      <MediaList items={items} canPlaySub={!!viewer?.hasPlan || viewer?.role === "admin"} signedIn={!!viewer} />
    </section>}
  </>;
}
