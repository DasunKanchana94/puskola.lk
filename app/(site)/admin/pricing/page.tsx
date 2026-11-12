import { db } from "@/lib/supabase/server";
import { adminUpdate } from "@/app/admin-actions";
import { Notice } from "@/components/ui";

export const metadata = { title: "Plans and pricing" };

export default async function Pricing({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  const { data: plans } = await (await db()).from("plans").select("*").order("sort");
  return <>
    <h1>Plans and pricing</h1>
    <p className="muted small" style={{ margin: "6px 0 16px" }}>Prices are in US dollars and are one-time payments. A new price applies to new purchases only. Untick On sale to hide a plan from the Plans page.</p>
    <Notice error={error} notice={notice} />
    <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
      {(plans ?? []).map((p) => <form key={p.id} action={adminUpdate.bind(null, "plans", p.id)} className="card row" style={{ alignItems: "end" }}>
        <input type="hidden" name="_back" value="/admin/pricing" /><input type="hidden" name="_flags" value="active" />
        <label className="small" style={{ flex: 1, minWidth: 150 }}>Plan name<input className="inp" name="name" defaultValue={p.name} required /></label>
        <label className="small">Price (USD)<input className="inp" type="number" name="price_usd" min="0" step="0.01" defaultValue={p.price_usd} required style={{ width: 110 }} /></label>
        <span className="pill grey">{p.months ? `${p.months} months` : "Lifetime"}</span>
        <label className="row small" style={{ gap: 5 }}><input type="checkbox" name="active" defaultChecked={p.active} />On sale</label>
        <button className="btn sm pri">Save</button></form>)}
    </div>
  </>;
}
