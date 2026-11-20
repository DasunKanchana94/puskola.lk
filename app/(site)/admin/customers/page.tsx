import { db } from "@/lib/supabase/server";
import { Submit } from "@/components/Submit";
import { countryName } from "@/lib/data";
import { grantPlan } from "@/app/admin-actions";
import { Notice } from "@/components/ui";

export const metadata = { title: "Customers" };
type Ent = { user_id: string; ends_at: string | null; starts_at: string; plans: { name: string } | null };

export default async function Customers({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; q?: string }> }) {
  const { error, notice, q } = await searchParams;
  const supabase = await db();
  let query = supabase.from("profiles").select("id,full_name,email,country,role,created_at").order("created_at", { ascending: false }).limit(200);
  const term = (q ?? "").replace(/[%,()]/g, " ").trim();
  if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  const [{ data: people }, { data: ents }, { data: plans }] = await Promise.all([query, supabase.from("entitlements").select("user_id,ends_at,starts_at,plans(name)").order("starts_at", { ascending: false }), supabase.from("plans").select("id,name").order("sort")]);
  const now = new Date().toISOString();
  const active = (id: string) => ((ents ?? []) as unknown as Ent[]).find((e) => e.user_id === id && (!e.ends_at || e.ends_at > now));
  return <>
    <h1>Customers</h1>
    <p className="muted small" style={{ margin: "6px 0 16px" }}>Everyone with an account. You can give a plan by hand, for example for a gift or a bank transfer.</p>
    <Notice error={error} notice={notice} />
    <form className="row" style={{ marginBottom: 14 }}><input className="inp" name="q" defaultValue={q} placeholder="Search by name or email" aria-label="Search customers" style={{ maxWidth: 320 }} /><Submit className="btn">Search</Submit></form>
    <div className="tw"><table><thead><tr><th>Reader</th><th>Country</th><th>Joined</th><th>Plan</th><th>Change plan</th></tr></thead><tbody>
      {(people ?? []).map((p) => { const e = active(p.id); return <tr key={p.id}>
        <td><b>{p.full_name || "No name"}</b>{p.role === "admin" && <> <span className="pill gold">Admin</span></>}<div className="muted small">{p.email}</div></td>
        <td>{countryName(p.country)}</td><td>{p.created_at.slice(0, 10)}</td>
        <td>{e ? <><span className="pill">{e.plans?.name}</span><div className="muted small">{e.ends_at ? `until ${e.ends_at.slice(0, 10)}` : "no end date"}</div></> : <span className="pill grey">Free reader</span>}</td>
        <td><form action={grantPlan.bind(null, p.id)} className="row"><input type="hidden" name="_back" value="/admin/customers" />
          <select className="inp" name="plan_id" aria-label={`Plan for ${p.email}`} style={{ width: "auto" }}>{(plans ?? []).map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}{e && <option value="none">Remove plan</option>}</select>
          <Submit className="btn sm">Apply</Submit></form></td>
      </tr>; })}
    </tbody></table></div>
  </>;
}
