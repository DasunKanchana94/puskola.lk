import { getAuthors, getBooks } from "@/lib/data";
import { AuthorCard } from "@/components/ui";

export const metadata = { title: "Authors" };

export default async function Authors() {
  const [authors, books] = await Promise.all([getAuthors(), getBooks()]);
  return <>
    <h1>Authors</h1>
    <div className="agrid" style={{ marginTop: 22 }}>{authors.map((a) => <AuthorCard key={a.id} author={a} count={books.filter((b) => b.authors?.slug === a.slug).length} />)}</div>
  </>;
}
