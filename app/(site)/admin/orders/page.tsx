import { db } from "@/lib/supabase/server";
import { money } from "@/lib/data";

export const metadata = { title: "Orders and revenue" };
type Order = { id: string; user_id: string; amount: number; currency: string; status: string; gateway: string; gateway_ref: string | null; created_at: string; plans: { name: string } | null };

export default async function Orders() {
  const supabase = await db();
  const [{ data: orders }, { data: profiles }] = await Promise.all([supabase.from("orders").select("id,user_id,amount,currency,status,gateway,gateway_ref,created_at,plans(name)").order("created_at", { ascending: false }).limit(500), supabase.from("profiles").select("id,full_name,email")]);
  const list = (orders ?? []) as unknown as Order[];
  const who = (id: string) => { const p = (profiles ?? []).find((x) => x.id === id); return p ? p.full_name || p.email : "Reader"; };
  const paid = list.filter((o) => o.status === "paid");
  const sum = (l: Order[]) => l.reduce((s, o) => s + Number(o.amount), 0);
  const month = new Date().toISOString().slice(0, 7);
  return <>
    <h1>Orders and revenue</h1>
    <div className="tiles" style={{ marginTop: 18 }}>
      <div className="card tile"><span className="muted small">Paid orders</span><b>{paid.length}</b></div>
      <div className="card tile"><span className="muted small">Revenue, all time</span><b>{money(sum(paid))}</b></div>
      <div className="card tile"><span className="muted small">Revenue this month</span><b>{money(sum(paid.filter((o) => o.created_at.startsWith(month))))}</b></div>
      <div className="card tile"><span className="muted small">Refunded</span><b>{money(sum(list.filter((o) => o.status === "refunded")))}</b></div>
    </div>
    {list.length ? <div className="tw"><table><thead><tr><th>Date</th><th>Customer</th><th>Plan</th><th>Status</th><th>Gateway reference</th><th className="num">Amount</th></tr></thead><tbody>
      {list.map((o) => <tr key={o.id}><td>{o.created_at.slice(0, 10)}</td><td>{who(o.user_id)}</td><td>{o.plans?.name}</td>
        <td><span className={`pill ${o.status === "paid" ? "" : o.status === "pending" ? "grey" : "red"}`}>{o.status}</span></td><td className="small">{o.gateway} {o.gateway_ref ?? ""}</td><td className="num">{money(o.amount)} {o.currency}</td></tr>)}
    </tbody></table></div> : <div className="card">No orders yet. Orders are recorded automatically once the payment gateway is connected. Plans you give by hand on the Customers page do not create an order.</div>}
  </>;
}
