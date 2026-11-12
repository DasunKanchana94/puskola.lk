import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data";
import { importEdition } from "@/app/actions";
import { Notice } from "@/components/ui";
import { FlagToggle } from "@/components/FlagToggle";

export const metadata = { title: "Back office" };

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (viewer.role !== "admin") redirect("/");
  const { error, notice } = await searchParams;
  const supabase = await db();
  const [{ data: books }, { count: readers }, { count: paid }] = await Promise.all([
    supabase.from("books").select("id,slug,title_si,title_en,published,featured,is_new,book_editions(id,kind,label,tier,chapters(count))").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
  ]);
  type Row = { id: string; slug: string; title_si: string; title_en: string; published: boolean; featured: boolean; is_new: boolean; book_editions: { id: string; kind: string; label: string; tier: string; chapters: { count: number }[] }[] };
  return <>
    <h1>Back office</h1>
    <p className="muted small" style={{ margin: "6px 0 18px" }}>First version: books and text import. Widgets, media, customers, orders and pricing follow.</p>
    <Notice error={error} notice={notice} />
    <div className="tiles"><div className="card tile"><span className="muted small">Registered readers</span><b>{readers ?? 0}</b></div><div className="card tile"><span className="muted small">Paid orders</span><b>{paid ?? 0}</b></div><div className="card tile"><span className="muted small">Books</span><b>{(books ?? []).length}</b></div></div>
    <h2 style={{ margin: "8px 0 10px" }}>Books</h2>
    <div className="tw"><table><thead><tr><th>Title</th><th>Editions and text</th><th>Show</th><th /></tr></thead><tbody>
      {((books ?? []) as unknown as Row[]).map((b) => <tr key={b.id}>
        <td><b>{b.title_en}</b><div className="muted small">{b.title_si} · {b.slug}</div></td>
        <td>{b.book_editions.map((e) => <div key={e.id} className="small">{e.label} ({e.kind}, {e.tier}): {e.chapters?.[0]?.count ? `${e.chapters[0].count} chapters` : "no text yet"}</div>)}</td>
        <td><div className="row"><FlagToggle id={b.id} field="published" value={b.published} label="Published" /><FlagToggle id={b.id} field="featured" value={b.featured} label="Featured" /><FlagToggle id={b.id} field="is_new" value={b.is_new} label="New" /></div></td>
        <td><Link className="btn sm" href={`/books/${b.slug}`}>View</Link></td>
      </tr>)}
    </tbody></table></div>
    <h2 style={{ margin: "26px 0 10px" }}>Import book text</h2>
    <form action={importEdition} className="card" style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <label>Book JSON file<input className="inp" type="file" name="file" id="imp-file" accept=".json,application/json" required /></label>
      <p className="small muted">One file per edition, made by the restoration pipeline. Importing replaces that edition&apos;s existing text.</p>
      <div><button className="btn pri">Import text</button></div>
    </form>
  </>;
}
