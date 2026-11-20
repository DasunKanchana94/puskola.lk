import Link from "next/link";
import { Submit } from "@/components/Submit";
import { db } from "@/lib/supabase/server";
import { adminInsert } from "@/app/admin-actions";
import { BookFields } from "@/components/BookFields";
import { Notice } from "@/components/ui";

export const metadata = { title: "Add book" };

export default async function NewBook({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await db();
  const [{ data: authors }, { data: cats }] = await Promise.all([supabase.from("authors").select("id,name").order("name"), supabase.from("categories").select("id,name").order("sort")]);
  return <>
    <h1>Add book</h1>
    <p className="muted small" style={{ margin: "6px 0 16px" }}>Save the details first. The cover and the text are added on the next screen. The book stays hidden until you tick Published.</p>
    <Notice error={error} />
    <form action={adminInsert.bind(null, "books")} className="card" style={{ display: "grid", gap: 12, maxWidth: 640 }}>
      <input type="hidden" name="_back" value="/admin/books/new" />
      <BookFields book={{}} authors={authors ?? []} categories={cats ?? []} />
      <label>Access<select className="inp" name="tier" id="bk-tier" defaultValue="sub"><option value="sub">Subscription</option><option value="free">Free</option></select></label>
      <div className="row"><Submit className="btn pri">Create book</Submit><Link className="btn ghost" href="/admin/books">Cancel</Link></div>
    </form>
  </>;
}
