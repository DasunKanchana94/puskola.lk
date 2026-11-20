import { db } from "@/lib/supabase/server";
import { Submit } from "@/components/Submit";
import { adminDelete, adminInsert, adminUpdate, moveWidget } from "@/app/admin-actions";
import { Notice } from "@/components/ui";

export const metadata = { title: "Homepage widgets" };
const back = "/admin/widgets";
const TYPES: [string, string][] = [["hero", "Featured book banner"], ["continue", "Continue reading"], ["new", "New releases"], ["free", "Free books"], ["row", "Books from one category"], ["authors", "Authors"], ["cats", "Category links"], ["audio", "Audiobooks"], ["video", "Videos"], ["podcast", "Podcasts"], ["banner", "Subscription banner"]];

export default async function Widgets({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  const supabase = await db();
  const [{ data: widgets }, { data: cats }] = await Promise.all([supabase.from("widgets").select("*").order("sort"), supabase.from("categories").select("id,name").order("sort")]);
  const list = widgets ?? [];
  const catSelect = (value?: string | null) => <select className="inp" name="category_id" aria-label="Category (for a category row)" defaultValue={value ?? ""} style={{ width: "auto" }}><option value="">No category</option>{(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
  return <>
    <h1>Homepage widgets</h1>
    <p className="muted small" style={{ margin: "6px 0 16px" }}>The homepage is built from these blocks, top to bottom. Reorder them, rename them, switch them off, or add more. A block with nothing to show hides itself.</p>
    <Notice error={error} notice={notice} />
    <div style={{ display: "grid", gap: 10 }}>
      {list.map((w, i) => <div key={w.id} className="card row">
        <div style={{ display: "grid", gap: 4 }}>
          <form action={moveWidget.bind(null, w.id, -1)}><input type="hidden" name="_back" value={back} /><Submit className="btn sm" disabled={i === 0} aria-label={`Move ${w.title} up`}>Up</Submit></form>
          <form action={moveWidget.bind(null, w.id, 1)}><input type="hidden" name="_back" value={back} /><Submit className="btn sm" disabled={i === list.length - 1} aria-label={`Move ${w.title} down`}>Down</Submit></form>
        </div>
        <form action={adminUpdate.bind(null, "widgets", w.id)} className="row" style={{ flex: 1 }}><input type="hidden" name="_back" value={back} /><input type="hidden" name="_flags" value="enabled" />
          <span className="pill">{TYPES.find((t) => t[0] === w.type)?.[1] ?? w.type}</span>
          <input className="inp" name="title" aria-label="Heading" defaultValue={w.title} required style={{ flex: 1, minWidth: 150 }} />
          {w.type === "row" && catSelect(w.category_id)}
          <label className="row small" style={{ gap: 5 }}><input type="checkbox" name="enabled" defaultChecked={w.enabled} />Shown</label>
          <Submit className="btn sm pri">Save</Submit></form>
        <form action={adminDelete.bind(null, "widgets", w.id)}><input type="hidden" name="_back" value={back} /><Submit className="btn sm ghost danger">Remove</Submit></form>
      </div>)}
    </div>
    <h2 style={{ margin: "24px 0 10px" }}>Add widget</h2>
    <form action={adminInsert.bind(null, "widgets")} className="card row"><input type="hidden" name="_back" value={back} />
      <select className="inp" name="type" aria-label="Widget type" style={{ width: "auto" }}>{TYPES.map((t) => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select>
      <input className="inp" name="title" placeholder="Heading shown on the homepage" aria-label="Heading" required style={{ flex: 1, minWidth: 180 }} />
      {catSelect()}<Submit className="btn pri">Add widget</Submit></form>
  </>;
}
