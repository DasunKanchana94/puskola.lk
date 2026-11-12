import { db } from "@/lib/supabase/server";
import { money } from "@/lib/data";

export const metadata = { title: "Dashboard" };
type Order = { id: string; amount: number; created_at: string; status: string; plans: { name: string } | null; profiles?: never; user_id: string };

export default async function Dashboard() {
  const supabase = await db();
  const [{ data: orders }, { data: profiles }, { data: ents }, { data: plans }, { count: books }] = await Promise.all([
    supabase.from("orders").select("id,amount,created_at,status,user_id,plans(name)").eq("status", "paid").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,email"),
    supabase.from("entitlements").select("user_id,ends_at"),
    supabase.from("plans").select("name").order("sort"),
    supabase.from("books").select("id", { count: "exact", head: true }),
  ]);
  const paid = (orders ?? []) as unknown as Order[];
  const now = new Date(), nowIso = now.toISOString();
  const months = [...Array(6)].map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 15); return { key: d.toISOString().slice(0, 7), label: d.toLocaleString("en", { month: "short" }) }; });
  const rev = months.map((m) => paid.filter((o) => o.created_at.startsWith(m.key)).reduce((s, o) => s + Number(o.amount), 0));
  const max = Math.max(...rev, 1);
  const subscribers = new Set((ents ?? []).filter((e) => !e.ends_at || e.ends_at > nowIso).map((e) => e.user_id)).size;
  const total = paid.reduce((s, o) => s + Number(o.amount), 0);
  const name = (id: string) => { const p = (profiles ?? []).find((x) => x.id === id); return p ? p.full_name || p.email : "Reader"; };
  const mix = (plans ?? []).map((p) => [p.name, paid.filter((o) => o.plans?.name === p.name).length] as const);
  const top = Math.max(...mix.map((m) => m[1]), 1);
  return <>
    <h1>Dashboard</h1>
    <div className="tiles" style={{ marginTop: 18 }}>
      <div className="card tile"><span className="muted small">Revenue this month</span><b>{money(rev[5])}</b></div>
      <div className="card tile"><span className="muted small">Revenue, all time</span><b>{money(total)}</b></div>
      <div className="card tile"><span className="muted small">Active subscribers</span><b>{subscribers}</b></div>
      <div className="card tile"><span className="muted small">Registered readers</span><b>{(profiles ?? []).length}</b></div>
      <div className="card tile"><span className="muted small">Books</span><b>{books ?? 0}</b></div>
    </div>
    <div className="two">
      <div className="card"><h2>Revenue by month (USD)</h2>
        <svg viewBox="0 0 420 190" role="img" aria-label="Revenue by month" style={{ width: "100%", marginTop: 10 }}>
          {rev.map((v, i) => { const h = (v / max) * 130; return <g key={i}><rect className="bar" x={20 + i * 66} y={150 - h} width="42" height={h} rx="5" /><text className="axis" x={41 + i * 66} y={144 - h} textAnchor="middle">{money(v)}</text><text className="axis" x={41 + i * 66} y="168" textAnchor="middle">{months[i].label}</text></g>; })}
          <line x1="10" y1="150" x2="410" y2="150" stroke="var(--line)" />
        </svg>
      </div>
      <div className="card"><h2>Plan mix (paid orders)</h2>{mix.map((m) => <div key={m[0]} style={{ marginTop: 14 }}><div className="row small"><b>{m[0]}</b><span className="sp" />{m[1]}</div><div className="prog" style={{ height: 8 }}><i style={{ width: `${(m[1] / top) * 100}%` }} /></div></div>)}</div>
    </div>
    <h2 style={{ margin: "22px 0 10px" }}>Recent orders</h2>
    {paid.length ? <div className="tw"><table><thead><tr><th>Date</th><th>Customer</th><th>Plan</th><th className="num">Amount</th></tr></thead><tbody>
      {paid.slice(0, 8).map((o) => <tr key={o.id}><td>{o.created_at.slice(0, 10)}</td><td>{name(o.user_id)}</td><td>{o.plans?.name}</td><td className="num">{money(o.amount)}</td></tr>)}
    </tbody></table></div> : <div className="card">No paid orders yet. They appear here once the payment gateway is connected.</div>}
  </>;
}
