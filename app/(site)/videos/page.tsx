import { db } from "@/lib/supabase/server";

export const metadata = { title: "Videos and podcasts" };

export default async function Page() {
  const { data } = await (await db()).from("media_items").select("id,kind,title,duration,tier").in("kind", "video,podcast".split(",")).eq("published", true).order("sort");
  return <>
    <h1>Videos and podcasts</h1>
    {(data ?? []).length ? <div className="mlist" style={{ marginTop: 22 }}>{(data ?? []).map((m) => (
      <div className="mrow" key={m.id}><div><b>{m.title}</b><div className="muted small">{m.kind} · {m.duration}</div></div><span className="sp" />{m.tier === "free" ? <span className="pill">Free</span> : <span className="pill gold">Subscription</span>}</div>
    ))}</div> : <div className="card" style={{ marginTop: 22 }}>Nothing has been published here yet. Check back soon.</div>}
  </>;
}
