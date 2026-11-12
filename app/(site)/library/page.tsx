import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { getBooks, getCategories, getViewer } from "@/lib/data";
import { BookCard } from "@/components/ui";

export const metadata = { title: "My library" };

export default async function Library() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/library");
  const [books, cats, { data: prog }] = await Promise.all([getBooks(), getCategories(), (await db()).from("reading_progress").select("book_id,pct").eq("user_id", viewer.id).order("updated_at", { ascending: false })]);
  const colors = Object.fromEntries(cats.map((c) => [c.id, c.color]));
  const mine = (prog ?? []).map((p) => ({ book: books.find((b) => b.id === p.book_id), pct: p.pct })).filter((x) => x.book);
  return <>
    <h1>{viewer.name}</h1>
    <div className="chips" style={{ margin: "14px 0 22px" }}><Link className="chip on" href="/library">My library</Link><Link className="chip" href="/account">Profile and plan</Link></div>
    <section className="sec"><div className="sec-h"><h2>Continue reading</h2></div>
      {mine.length ? <div className="shelf">{mine.map((x) => <BookCard key={x.book!.id} book={x.book!} color={colors[x.book!.category_id ?? ""]} pct={x.pct} />)}</div> : <p className="muted">Books you open will appear here.</p>}
    </section>
    <section className="sec"><div className="sec-h"><h2>Lists, highlights and notes</h2></div><p className="muted">These arrive with the next update to the reader.</p></section>
  </>;
}
