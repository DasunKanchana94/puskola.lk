import { db } from "@/lib/supabase/server";
import { Submit } from "@/components/Submit";
import { fileUrl } from "@/lib/data";
import { adminDelete, adminInsert, adminUpdate } from "@/app/admin-actions";
import { FileUpload } from "@/components/FileUpload";
import { Notice, initials } from "@/components/ui";

export const metadata = { title: "Authors" };
const back = "/admin/authors";

function Fields({ a }: { a?: { name: string; name_si: string; era: string; bio: string } }) {
  return <>
    <div className="row"><label className="small" style={{ flex: 1, minWidth: 150 }}>Name (English)<input className="inp" name="name" defaultValue={a?.name} required /></label>
      <label className="small" style={{ flex: 1, minWidth: 150 }}>Name (Sinhala)<input className="inp" name="name_si" defaultValue={a?.name_si} /></label>
      <label className="small" style={{ flex: 1, minWidth: 150 }}>Period<input className="inp" name="era" defaultValue={a?.era} placeholder="For example 12th century" /></label></div>
    <label className="small">About the author<textarea className="inp" name="bio" rows={3} defaultValue={a?.bio} /></label>
  </>;
}

export default async function Authors({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  const supabase = await db();
  const [{ data: authors }, { data: books }] = await Promise.all([supabase.from("authors").select("*").order("name"), supabase.from("books").select("author_id")]);
  const count = (id: string) => (books ?? []).filter((b) => b.author_id === id).length;
  return <>
    <h1>Authors</h1>
    <p className="muted small" style={{ margin: "6px 0 16px" }}>Each author has a profile page listing their books.</p>
    <Notice error={error} notice={notice} />
    <div style={{ display: "grid", gap: 12 }}>
      {(authors ?? []).map((a) => { const photo = fileUrl("authors", a.photo_path); return <div key={a.id} className="card" style={{ display: "grid", gap: 10 }}>
        <div className="row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img className="avatar" src={photo} alt="" /> : <span className="avatar">{initials(a.name)}</span>}
          <b>{a.name}</b><span className="pill grey">{count(a.id)} books</span><span className="sp" />
          <FileUpload bucket="authors" table="authors" id={a.id} accept="image/*" label={photo ? "Replace photo" : "Upload photo"} maxMb={5} />
        </div>
        <form action={adminUpdate.bind(null, "authors", a.id)} style={{ display: "grid", gap: 10 }}><input type="hidden" name="_back" value={back} /><Fields a={a} /><div><Submit className="btn sm pri">Save</Submit></div></form>
        <form action={adminDelete.bind(null, "authors", a.id)}><input type="hidden" name="_back" value={back} /><Submit className="btn sm ghost danger">Delete author</Submit></form>
      </div>; })}
    </div>
    <h2 style={{ margin: "24px 0 10px" }}>Add author</h2>
    <form action={adminInsert.bind(null, "authors")} className="card" style={{ display: "grid", gap: 10 }}><input type="hidden" name="_back" value={back} /><Fields /><div><Submit className="btn pri">Add author</Submit></div></form>
  </>;
}
