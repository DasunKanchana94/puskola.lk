import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { getViewer, money } from "@/lib/data";
import { updateProfile, signOut } from "@/app/actions";
import { Notice } from "@/components/ui";

export const metadata = { title: "Profile and plan" };

export default async function Account({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  const { notice } = await searchParams;
  const { data: orders } = await (await db()).from("orders").select("id,amount,status,created_at,plans(name)").eq("user_id", viewer.id).order("created_at", { ascending: false });
  return <>
    <h1>{viewer.name}</h1>
    <div className="chips" style={{ margin: "14px 0 22px" }}><Link className="chip" href="/library">My library</Link><Link className="chip on" href="/account">Profile and plan</Link></div>
    <Notice notice={notice} />
    <div className="two">
      <div className="card"><h2>Profile</h2>
        <form action={updateProfile} style={{ display: "grid", gap: 12, marginTop: 12, maxWidth: 380 }}>
          <label>Name<input className="inp" name="name" id="pf-name" defaultValue={viewer.name} required /></label>
          <label>Email<input className="inp" id="pf-email" value={viewer.email} disabled readOnly /></label>
          <div className="row"><button className="btn pri">Save profile</button></div>
        </form>
        <form action={signOut} style={{ marginTop: 12 }}><button className="btn ghost">Sign out</button></form>
      </div>
      <div className="card"><h2>Subscription</h2>
        <p style={{ margin: "12px 0" }}>{viewer.hasPlan ? <><span className="pill">{viewer.planName}</span> {viewer.until ? `Active until ${viewer.until.slice(0, 10)}` : "Never expires"}</> : "Free member"}</p>
        <Link className="btn" href="/plans">{viewer.hasPlan ? "See plans" : "See plans"}</Link>
        <h3 style={{ marginTop: 18 }}>Payments</h3>
        {(orders ?? []).length ? (orders ?? []).map((o) => <div className="row small" style={{ marginTop: 6 }} key={o.id}><span>{o.created_at.slice(0, 10)}</span><span>{(o.plans as unknown as { name: string } | null)?.name}</span><span className="pill grey">{o.status}</span><span className="sp" /><b>{money(o.amount)}</b></div>) : <p className="muted small">No payments yet.</p>}
      </div>
    </div>
  </>;
}
