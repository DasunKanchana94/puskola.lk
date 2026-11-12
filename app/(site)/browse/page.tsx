import Link from "next/link";
import { getBooks, getCategories } from "@/lib/data";
import { BookCard } from "@/components/ui";

export const metadata = { title: "Browse Sinhala books" };

export default async function Browse({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const { cat, q } = await searchParams;
  const [books, cats] = await Promise.all([getBooks({ category: cat, q }), getCategories()]);
  const colors = Object.fromEntries(cats.map((c) => [c.id, c.color]));
  return <>
    <h1>Browse</h1>
    <div className="chips" style={{ margin: "16px 0 22px" }}>
      <Link className={`chip${!cat ? " on" : ""}`} href="/browse">All</Link>
      {cats.map((c) => <Link key={c.id} className={`chip${cat === c.id ? " on" : ""}`} href={`/browse?cat=${c.id}`}>{c.name}</Link>)}
    </div>
    {q && <p className="muted" style={{ marginBottom: 14 }}>Results for &quot;{q}&quot;</p>}
    {books.length ? <div className="grid">{books.map((b) => <BookCard key={b.id} book={b} color={colors[b.category_id ?? ""]} />)}</div>
      : <div className="card">No books match. Clear the filter or try another search.</div>}
  </>;
}
