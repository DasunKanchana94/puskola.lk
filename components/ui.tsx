import Link from "next/link";
import { type Book, type Author, fileUrl, isFree } from "@/lib/data";

export function Cover({ book, color, tag = true }: { book: Book; color?: string; tag?: boolean }) {
  const url = fileUrl("covers", book.cover_path);
  const badge = !tag ? null : book.is_new ? <span className="pill gold tag">New</span> : isFree(book) ? <span className="pill tag">Free</span> : null;
  if (url) return <span className="cv">{badge}{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`Cover of ${book.title_en}`} /></span>;
  return <span className="cv gen" style={{ background: color ?? "#7a1f14" }}>{badge}<b>{book.title_si}</b><span>{book.authors?.name}</span></span>;
}

export function BookCard({ book, color, pct }: { book: Book; color?: string; pct?: number }) {
  return (
    <Link className="bk" href={`/books/${book.slug}`}>
      <Cover book={book} color={color} />
      <h3>{book.title_si}</h3>
      <div className="muted">{book.title_en}</div>
      {pct !== undefined && <div className="prog"><i style={{ width: `${pct}%` }} /></div>}
    </Link>
  );
}

export function Shelf({ books, colors }: { books: Book[]; colors: Record<string, string> }) {
  if (!books.length) return <p className="muted">Nothing here yet.</p>;
  return <div className="shelf">{books.map((b) => <BookCard key={b.id} book={b} color={colors[b.category_id ?? ""]} />)}</div>;
}

export const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("");

export function AuthorCard({ author, count }: { author: Author; count: number }) {
  const photo = fileUrl("authors", author.photo_path);
  return (
    <Link className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12, alignItems: "center" }} href={`/authors/${author.slug}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img className="avatar" src={photo} alt="" /> : <span className="avatar">{initials(author.name)}</span>}
      <span><b>{author.name}</b><span className="muted small" style={{ display: "block" }}>{author.era} · {count} {count === 1 ? "book" : "books"}</span></span>
    </Link>
  );
}

export function Notice({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return <div className="card" role="status" style={{ marginBottom: 16, borderColor: error ? "var(--danger)" : "var(--accent)" }}>{error ?? notice}</div>;
}
