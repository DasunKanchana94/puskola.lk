import { db } from "@/lib/supabase/server";

export const metadata = { title: "Payment gateway" };

export default async function Payments() {
  const { count } = await (await db()).from("orders").select("id", { count: "exact", head: true });
  return <>
    <h1>Payment gateway</h1>
    <div className="card" style={{ marginTop: 18, maxWidth: 680, display: "grid", gap: 10 }}>
      <div className="row"><b>PayHere</b><span className="pill red">Not connected</span></div>
      <p>Card payments are not switched on yet. Readers see &quot;Payment opens soon&quot; on the Plans page, and you can give plans by hand on the Customers page.</p>
      <p className="muted small">To connect: finish the PayHere merchant application for DK Trade International (Pvt) Ltd. The merchant details are then stored as protected settings on the hosting side, never in the site code, in an email or in a chat. A test purchase in the PayHere sandbox comes first, then live payments.</p>
      <p className="muted small">Orders recorded so far: {count ?? 0}</p>
    </div>
  </>;
}
