import { COUNTRIES } from "@/lib/data";

type Opt = { id: string; name: string };
export type BookValues = { title_si?: string; title_en?: string; slug?: string; author_id?: string | null; category_id?: string | null; language?: string; description?: string; regions?: string[] };

/** The shared fields of the add-book and edit-book forms. */
export function BookFields({ book, authors, categories, withSlug }: { book: BookValues; authors: Opt[]; categories: Opt[]; withSlug?: boolean }) {
  return <>
    <label>Title (Sinhala)<input className="inp" name="title_si" id="bk-si" required defaultValue={book.title_si} /></label>
    <label>Title (English)<input className="inp" name="title_en" id="bk-en" required defaultValue={book.title_en} /></label>
    {withSlug && <label>Web address name<input className="inp" name="slug" id="bk-slug" required pattern="[a-z0-9-]+" defaultValue={book.slug} /><span className="muted small" style={{ fontWeight: 400 }}>Lowercase letters, numbers and hyphens. Changing it changes the book&apos;s link.</span></label>}
    <label>Author<select className="inp" name="author_id" id="bk-au" defaultValue={book.author_id ?? ""}><option value="">No author</option>{authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>Category<select className="inp" name="category_id" id="bk-cat" defaultValue={book.category_id ?? ""}><option value="">No category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Language<input className="inp" name="language" id="bk-lang" defaultValue={book.language ?? "Sinhala"} /></label>
    <label>Description<textarea className="inp" name="description" id="bk-desc" rows={4} defaultValue={book.description} /></label>
    <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
      <legend className="small" style={{ fontWeight: 700 }}>Countries where this book is offered</legend>
      <p className="muted small" style={{ marginBottom: 8 }}>Leave every box empty to offer it everywhere.</p>
      <input type="hidden" name="_flags" value="regions" />
      <div className="row">{COUNTRIES.map((c) => <label key={c[0]} className="row small" style={{ gap: 5, fontWeight: 500 }}><input type="checkbox" name="regions" value={c[0]} defaultChecked={book.regions?.includes(c[0])} />{c[1]}</label>)}</div>
    </fieldset>
  </>;
}
