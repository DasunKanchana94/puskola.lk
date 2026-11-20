import { db } from "@/lib/supabase/server";
import { Submit } from "@/components/Submit";
import { adminDelete, adminInsert, adminUpdate } from "@/app/admin-actions";
import { FileUpload } from "@/components/FileUpload";
import { Notice } from "@/components/ui";

export const metadata = { title: "Audio, video, podcasts" };
const back = "/admin/media";
const KINDS: [string, string][] = [["audio", "Audiobook"], ["summary", "Audio summary"], ["video", "Video"], ["podcast", "Podcast"]];

export default async function Media({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  const supabase = await db();
  const [{ data: items }, { data: books }] = await Promise.all([supabase.from("media_items").select("*").order("sort"), supabase.from("books").select("id,title_en").order("title_en")]);
  const fields = (m?: { kind: string; title: string; book_id: string | null; duration: string; tier: string }) => <>
    <select className="inp" name="kind" aria-label="Type" defaultValue={m?.kind ?? "audio"} style={{ width: "auto" }}>{KINDS.map((k) => <option key={k[0]} value={k[0]}>{k[1]}</option>)}</select>
    <input className="inp" name="title" aria-label="Title" placeholder="Title" defaultValue={m?.title} required style={{ flex: 1, minWidth: 170 }} />
    <select className="inp" name="book_id" aria-label="Related book" defaultValue={m?.book_id ?? ""} style={{ width: "auto", maxWidth: 180 }}><option value="">No related book</option>{(books ?? []).map((b) => <option key={b.id} value={b.id}>{b.title_en}</option>)}</select>
    <input className="inp" name="duration" aria-label="Length" placeholder="Length, e.g. 42 min" defaultValue={m?.duration} style={{ width: 150 }} />
    <select className="inp" name="tier" aria-label="Access" defaultValue={m?.tier ?? "sub"} style={{ width: "auto" }}><option value="sub">Subscription</option><option value="free">Free</option></select>
  </>;
  return <>
    <h1>Audio, video, podcasts</h1>
    <p className="muted small" style={{ margin: "6px 0 16px" }}>Add an item, upload its file, then tick Published. MP3, M4A or MP4, up to 50 MB per file on the current storage plan.</p>
    <Notice error={error} notice={notice} />
    <form action={adminInsert.bind(null, "media_items")} className="card row" style={{ marginBottom: 18 }}><input type="hidden" name="_back" value={back} />{fields()}<Submit className="btn pri">Add item</Submit></form>
    {(items ?? []).length ? <div style={{ display: "grid", gap: 10 }}>{(items ?? []).map((m) => <div key={m.id} className="card" style={{ display: "grid", gap: 10 }}>
      <form action={adminUpdate.bind(null, "media_items", m.id)} className="row"><input type="hidden" name="_back" value={back} /><input type="hidden" name="_flags" value="published" />{fields(m)}
        <label className="row small" style={{ gap: 5 }}><input type="checkbox" name="published" defaultChecked={m.published} />Published</label><Submit className="btn sm pri">Save</Submit></form>
      <div className="row">{m.file_path ? <span className="pill">File uploaded</span> : <span className="pill red">No file yet</span>}
        <FileUpload bucket="media" table="media_items" id={m.id} accept="audio/*,video/*" label={m.file_path ? "Replace file" : "Upload file"} maxMb={50} /><span className="sp" />
        <form action={adminDelete.bind(null, "media_items", m.id)}><input type="hidden" name="_back" value={back} /><Submit className="btn sm ghost danger">Delete</Submit></form></div>
    </div>)}</div> : <div className="card">No audio or video yet. Add the first item above.</div>}
  </>;
}
