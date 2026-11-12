import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { fileUrl, getBooks, getCategories, type Author } from "@/lib/data";
import { BookCard, initials } from "@/components/ui";

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data } = await (await db()).from("authors").select("*").eq("slug", slug).maybeSingle();
  const author = data as Author | null;
  if (!author) notFound();
  const [books, cats] = await Promise.all([getBooks({ authorId: author.id }), getCategories()]);
  const colors = Object.fromEntries(cats.map((c) => [c.id, c.color]));
  const photo = fileUrl("authors", author.photo_path);
  return <>
    <title>{`${author.name} | Puskola`}</title>
    <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img className="avatar big" src={photo} alt="" /> : <span className="avatar big">{initials(author.name)}</span>}
      <div style={{ flex: 1, minWidth: 240 }}><h1>{author.name}</h1><p className="muted" style={{ fontSize: 17 }}>{author.name_si} · {author.era}</p><p style={{ maxWidth: "65ch", marginTop: 10 }}>{author.bio}</p></div>
    </div>
    <section className="sec" style={{ marginTop: 30 }}><div className="sec-h"><h2>Books ({books.length})</h2></div>
      {books.length ? <div className="grid">{books.map((b) => <BookCard key={b.id} book={b} color={colors[b.category_id ?? ""]} />)}</div> : <p className="muted">No books by this author are available in your country yet.</p>}
    </section>
  </>;
}
