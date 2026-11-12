import { db } from "@/lib/supabase/server";
import { getViewer, money } from "@/lib/data";

export const metadata = { title: "Plans" };
const FEATURES = ["Every subscription book", "Audiobooks, summaries and videos", "Reading lists, highlights and notes", "AI reading assistant and translation"];

export default async function Plans() {
  const [{ data: plans }, viewer] = await Promise.all([(await db()).from("plans").select("*").eq("active", true).order("sort"), getViewer()]);
  return <>
    <h1>Choose your plan</h1>
    <p className="muted" style={{ margin: "8px 0 24px" }}>One payment. No automatic renewal. Free books stay free for everyone.</p>
    <div className="plans">{(plans ?? []).map((p) => (
      <div className={`plan${p.id === "1y" ? " best" : ""}`} key={p.id}>
        {p.id === "1y" && <span className="pill gold">Most popular</span>}
        <h2>{p.name}</h2>
        <div className="price">{money(p.price_usd)} <small>{p.months ? `for ${p.months} months` : "once, forever"}</small></div>
        <ul>{FEATURES.map((f) => <li key={f}>{f}</li>)}</ul><span className="sp" />
        <button className={`btn ${p.id === "1y" ? "pri" : ""}`} disabled title="Online payment opens soon">{viewer?.planName === p.name ? "Your current plan" : "Payment opens soon"}</button>
      </div>))}
    </div>
    <p className="small muted" style={{ marginTop: 18 }}>Online payment is being connected. Plans cannot be bought yet.</p>
  </>;
}
