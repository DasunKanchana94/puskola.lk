import Link from "next/link";
import { db } from "@/lib/supabase/server";
import { getAuthors, getBooks, getCategories, getViewer, isFree, money, type Book } from "@/lib/data";
import { AuthorCard, BookCard, Cover, Shelf } from "@/components/ui";

type Widget = { id: string; type: string; title: string; category_id: string | null };
type Media = { id: string; kind: string; title: string; duration: string; tier: string };

function MediaRow({ items }: { items: Media[] }) {
  if (!items.length) return <p className="muted">Coming soon.</p>;
  return <div className="media">{items.map((m) => (
    <div className="mcard" key={m.id}><div className={`thumb ${m.kind === "video" ? "" : m.kind === "podcast" ? "pod" : "aud"}`}><small>{m.duration}</small></div>
      <div className="b"><b>{m.title}</b><span>{m.tier === "free" ? <span className="pill">Free</span> : <span className="pill gold">Subscription</span>}</span></div></div>
  ))}</div>;
}

export default async function Home() {
  const supabase = await db();
  const [viewer, books, cats, authors, { data: widgets }, { data: media }, { data: plans }] = await Promise.all([
    getViewer(), getBooks(), getCategories(), getAuthors(),
    supabase.from("widgets").select("id,type,title,category_id").eq("enabled", true).order("sort"),
    supabase.from("media_items").select("id,kind,title,duration,tier").eq("published", true).order("sort"),
    supabase.from("plans").select("name,price_usd,months").eq("active", true).order("sort"),
  ]);
  const colors = Object.fromEntries(cats.map((c) => [c.id, c.color]));
  const progress: Record<string, number> = {};
  if (viewer) {
    const { data } = await supabase.from("reading_progress").select("book_id,pct").eq("user_id", viewer.id);
    (data ?? []).forEach((p) => (progress[p.book_id] = p.pct));
  }
  const m = (media ?? []) as Media[];
  const head = (w: Widget, href?: string, label?: string) => <div className="sec-h"><h2>{w.title}</h2>{href && <Link href={href}>{label}</Link>}</div>;

  return <>{((widgets ?? []) as Widget[]).map((w) => {
    if (w.type === "hero") {
      const b = books.find((x) => x.featured); if (!b) return null;
      return <section className="sec hero" key={w.id}><div className="slide on"><div>
        <div className="eyebrow">{cats.find((c) => c.id === b.category_id)?.name}</div><h1>{b.title_si}</h1><p>{b.description}</p>
        <div className="row"><Link className="btn pri" href={`/read/${b.slug}`}>Read now</Link><Link className="btn" href={`/books/${b.slug}`}>View details</Link></div>
      </div><Link href={`/books/${b.slug}`}><Cover book={b} color={colors[b.category_id ?? ""]} tag={false} /></Link></div></section>;
    }
    if (w.type === "continue") {
      const mine = books.filter((b) => progress[b.id] !== undefined); if (!mine.length) return null;
      return <section className="sec" key={w.id}>{head(w, "/library", "Open my library")}<div className="shelf">{mine.map((b: Book) => <BookCard key={b.id} book={b} color={colors[b.category_id ?? ""]} pct={progress[b.id]} />)}</div></section>;
    }
    if (w.type === "new") return <section className="sec" key={w.id}>{head(w)}<Shelf books={books.filter((b) => b.is_new)} colors={colors} /></section>;
    if (w.type === "free") return <section className="sec" key={w.id}>{head(w)}<Shelf books={books.filter(isFree)} colors={colors} /></section>;
    if (w.type === "row") {
      const list = books.filter((b) => b.category_id === w.category_id); if (!list.length) return null;
      return <section className="sec" key={w.id}>{head(w, `/browse?cat=${w.category_id}`, "See all")}<Shelf books={list} colors={colors} /></section>;
    }
    if (w.type === "audio") { const l = m.filter((x) => x.kind === "audio" || x.kind === "summary"); return l.length ? <section className="sec" key={w.id}>{head(w, "/audiobooks", "All audiobooks")}<MediaRow items={l} /></section> : null; }
    if (w.type === "video") { const l = m.filter((x) => x.kind === "video"); return l.length ? <section className="sec" key={w.id}>{head(w, "/videos", "All videos")}<MediaRow items={l} /></section> : null; }
    if (w.type === "podcast") { const l = m.filter((x) => x.kind === "podcast"); return l.length ? <section className="sec" key={w.id}>{head(w, "/videos", "All episodes")}<MediaRow items={l} /></section> : null; }
    if (w.type === "banner") return viewer?.hasPlan ? null : <section className="sec banner" key={w.id}><div><h2>{w.title}</h2><p>Every book, audiobook and video. {(plans ?? []).map((p) => `${p.name} ${money(p.price_usd)}`).join(", ")}.</p></div><span className="sp" /><Link className="btn" href="/plans">See plans</Link></section>;
    if (w.type === "authors") { const l = authors.filter((a) => books.some((b) => b.authors?.slug === a.slug)).slice(0, 6); return l.length ? <section className="sec" key={w.id}>{head(w, "/authors", "All authors")}<div className="agrid">{l.map((a) => <AuthorCard key={a.id} author={a} count={books.filter((b) => b.authors?.slug === a.slug).length} />)}</div></section> : null; }
    if (w.type === "cats") return <section className="sec" key={w.id}>{head(w, "/categories", "All categories")}<div className="chips">{cats.map((c) => <Link className="chip" key={c.id} href={`/browse?cat=${c.id}`}>{c.name}</Link>)}</div></section>;
    return null;
  })}</>;
}
