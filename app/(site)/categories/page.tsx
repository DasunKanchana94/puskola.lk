import Link from "next/link";
import { getBooks, getCategories } from "@/lib/data";

export const metadata = { title: "Categories" };

export default async function Categories() {
  const [books, cats] = await Promise.all([getBooks(), getCategories()]);
  return <>
    <h1>Categories</h1>
    <p className="muted" style={{ margin: "8px 0 22px" }}>Pick a category to see its books.</p>
    <div className="agrid">{cats.map((c) => {
      const n = books.filter((b) => b.category_id === c.id).length;
      return <Link key={c.id} className="card catc" href={`/browse?cat=${c.id}`} style={{ borderLeftColor: c.color }}><h2>{c.name}</h2><span className="muted small">{c.name_si} · {n} {n === 1 ? "book" : "books"}</span></Link>;
    })}</div>
  </>;
}
