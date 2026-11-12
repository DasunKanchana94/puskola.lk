import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook, getCategories, getCountry, getViewer, countryName } from "@/lib/data";
import { Cover } from "@/components/ui";

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [book, cats, viewer, country] = await Promise.all([getBook(slug), getCategories(), getViewer(), getCountry()]);
  if (!book) notFound();
  if (book.regions.length && !book.regions.includes(country)) return <div className="card"><b>{book.title_en}</b> is not available in {countryName(country)}. <Link href="/browse">Browse books available in your country</Link></div>;
  const cat = cats.find((c) => c.id === book.category_id);
  const editions = [...book.book_editions].sort((a, b) => a.sort - b.sort);
  return <div className="bookp">
    <title>{`${book.title_en} (${book.title_si}) | Puskola`}</title>
    <div><Cover book={book} color={cat?.color} /></div>
    <div>
      <div className="row">{cat && <span className="pill grey">{cat.name}</span>}</div>
      <h1 style={{ marginTop: 10 }}>{book.title_si}</h1>
      <p className="muted" style={{ fontSize: 17 }}>{book.title_en}{book.authors && <> · <Link href={`/authors/${book.authors.slug}`}>{book.authors.name}</Link></>}</p>
      <p style={{ maxWidth: "62ch", marginTop: 14 }}>{book.description}</p>
      <h2 style={{ margin: "24px 0 10px" }}>Editions</h2>
      <div className="mlist">{editions.map((e) => {
        const ok = e.tier === "free" || viewer?.hasPlan || viewer?.role === "admin";
        return <div className="mrow" key={e.id}><div><b>{e.label}</b><div className="small">{e.tier === "free" ? <span className="pill">Free</span> : <span className="pill gold">Subscription</span>}</div></div><span className="sp" />
          {ok ? <Link className="btn pri" href={`/read/${book.slug}?ed=${e.kind}`}>Read now</Link> : <Link className="btn" href="/plans">Subscribe to read</Link>}</div>;
      })}</div>
    </div>
  </div>;
}
