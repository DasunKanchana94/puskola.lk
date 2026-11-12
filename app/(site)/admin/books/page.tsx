import Link from "next/link";
import { db } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { FlagToggle } from "@/components/FlagToggle";

export const metadata = { title: "Books" };
type Row = { id: string; slug: string; title_si: string; title_en: string; published: boolean; featured: boolean; is_new: boolean; cover_path: string | null; regions: string[]; authors: { name: string } | null; categories: { name: string } | null; book_editions: { id: string; label: string; tier: string; chapters: { count: number }[] }[] };

export default async function Books({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  const { data } = await (await db()).from("books").select("id,slug,title_si,title_en,published,featured,is_new,cover_path,regions,authors(name),categories(name),book_editions(id,label,tier,chapters(count))").order("created_at", { ascending: false });
  return <>
    <div className="row"><h1>Books</h1><span className="sp" /><Link className="btn pri" href="/admin/books/new">Add book</Link></div>
    <p className="muted small" style={{ margin: "6px 0 16px" }}>Changes apply to the site immediately.</p>
    <Notice error={error} notice={notice} />
    <div className="tw"><table><thead><tr><th>Title</th><th>Category</th><th>Editions and text</th><th>Countries</th><th>Show</th><th /></tr></thead><tbody>
      {((data ?? []) as unknown as Row[]).map((b) => <tr key={b.id}>
        <td><b>{b.title_en}</b><div className="muted small">{b.title_si} · {b.authors?.name ?? "No author"}</div><div className="small">{b.cover_path ? <span className="pill">Cover</span> : <span className="pill grey">No cover image</span>}</div></td>
        <td>{b.categories?.name ?? ""}</td>
        <td>{b.book_editions.map((e) => <div key={e.id} className="small">{e.label} ({e.tier === "free" ? "free" : "subscription"}): {e.chapters?.[0]?.count ? `${e.chapters[0].count} chapters` : "no text yet"}</div>)}</td>
        <td className="small">{b.regions.length ? b.regions.join(", ") : "All countries"}</td>
        <td><div className="row"><FlagToggle id={b.id} field="published" value={b.published} label="Published" /><FlagToggle id={b.id} field="featured" value={b.featured} label="Featured" /><FlagToggle id={b.id} field="is_new" value={b.is_new} label="New" /></div></td>
        <td><div className="row"><Link className="btn sm pri" href={`/admin/books/${b.id}`}>Edit and upload</Link><Link className="btn sm" href={`/books/${b.slug}`}>View</Link></div></td>
      </tr>)}
    </tbody></table></div>
  </>;
}
