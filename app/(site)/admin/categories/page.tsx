import { db } from "@/lib/supabase/server";
import { adminDelete, adminInsert, adminUpdate } from "@/app/admin-actions";
import { Notice } from "@/components/ui";

export const metadata = { title: "Categories" };
const back = "/admin/categories";

export default async function Categories({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  const supabase = await db();
  const [{ data: cats }, { data: books }] = await Promise.all([supabase.from("categories").select("*").order("sort"), supabase.from("books").select("category_id")]);
  const count = (id: string) => (books ?? []).filter((b) => b.category_id === id).length;
  return <>
    <h1>Categories</h1>
    <p className="muted small" style={{ margin: "6px 0 16px" }}>Categories group books on the Categories page and in Browse. The order number sets their position.</p>
    <Notice error={error} notice={notice} />
    <div style={{ display: "grid", gap: 10 }}>
      {(cats ?? []).map((c) => <div key={c.id} className="card row" style={{ alignItems: "end" }}>
        <form action={adminUpdate.bind(null, "categories", c.id)} className="row" style={{ flex: 1, alignItems: "end" }}><input type="hidden" name="_back" value={back} />
          <label className="small" style={{ flex: 1, minWidth: 130 }}>Name (English)<input className="inp" name="name" defaultValue={c.name} required /></label>
          <label className="small" style={{ flex: 1, minWidth: 130 }}>Name (Sinhala)<input className="inp" name="name_si" defaultValue={c.name_si} /></label>
          <label className="small">Colour<input className="inp" type="color" name="color" defaultValue={c.color} style={{ width: 60, padding: 2, height: 38 }} /></label>
          <label className="small">Order<input className="inp" type="number" name="sort" defaultValue={c.sort} style={{ width: 70 }} /></label>
          <button className="btn sm pri">Save</button><span className="pill grey">{count(c.id)} books</span></form>
        <form action={adminDelete.bind(null, "categories", c.id)}><input type="hidden" name="_back" value={back} /><button className="btn sm ghost danger" disabled={count(c.id) > 0} title={count(c.id) > 0 ? "Move its books to another category first" : undefined}>Delete</button></form>
      </div>)}
    </div>
    <h2 style={{ margin: "24px 0 10px" }}>Add category</h2>
    <form action={adminInsert.bind(null, "categories")} className="card row" style={{ alignItems: "end" }}><input type="hidden" name="_back" value={back} /><input type="hidden" name="sort" value={(cats ?? []).length + 1} />
      <label className="small" style={{ flex: 1, minWidth: 130 }}>Name (English)<input className="inp" name="name" required /></label>
      <label className="small" style={{ flex: 1, minWidth: 130 }}>Name (Sinhala)<input className="inp" name="name_si" /></label>
      <label className="small">Colour<input className="inp" type="color" name="color" defaultValue="#0c6b66" style={{ width: 60, padding: 2, height: 38 }} /></label>
      <button className="btn pri">Add category</button></form>
  </>;
}
