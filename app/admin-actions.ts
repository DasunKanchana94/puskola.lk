"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/server";

type Kind = "s" | "n" | "b" | "a" | "nullable";
/** Tables the back office may edit, and the fields it may set on each. Database rules also restrict writes to admins. */
const TABLES: Record<string, Record<string, Kind>> = {
  categories: { id: "s", name: "s", name_si: "s", color: "s", sort: "n" },
  authors: { slug: "s", name: "s", name_si: "s", era: "s", bio: "s", photo_path: "nullable" },
  books: { slug: "s", title_si: "s", title_en: "s", author_id: "nullable", category_id: "nullable", language: "s", description: "s", cover_path: "nullable", published: "b", featured: "b", is_new: "b", regions: "a" },
  book_editions: { book_id: "s", kind: "s", label: "s", tier: "s", sort: "n" },
  widgets: { type: "s", title: "s", category_id: "nullable", enabled: "b", sort: "n" },
  media_items: { kind: "s", title: "s", book_id: "nullable", duration: "s", tier: "s", file_path: "nullable", published: "b", sort: "n", is_video: "b" },
  plans: { name: "s", price_usd: "n", active: "b" },
};

async function admin() {
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") redirect("/");
  return supabase;
}

function read(table: string, form: FormData) {
  const row: Record<string, unknown> = {};
  const flags = String(form.get("_flags") ?? "").split(",").filter(Boolean);
  for (const [field, kind] of Object.entries(TABLES[table])) {
    if (kind === "b") { if (flags.includes(field)) row[field] = form.get(field) === "on"; continue; }
    if (kind === "a") { if (flags.includes(field)) row[field] = form.getAll(field).map(String); continue; }
    if (!form.has(field)) continue;
    const v = String(form.get(field) ?? "").trim();
    row[field] = kind === "n" ? Number(v) || 0 : kind === "nullable" ? v || null : v;
  }
  return row;
}
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
function done(form: FormData, fallback: string, error?: string, notice = "Saved."): never {
  revalidatePath("/", "layout");
  const back = String(form.get("_back") ?? fallback);
  redirect(back + (back.includes("?") ? "&" : "?") + (error ? "error=" + encodeURIComponent(error) : "notice=" + encodeURIComponent(notice)));
}

export async function adminUpdate(table: string, id: string, form: FormData) {
  if (!TABLES[table]) return;
  const supabase = await admin();
  const { error } = await supabase.from(table).update(read(table, form)).eq("id", id);
  done(form, "/admin", error?.message);
}

export async function adminInsert(table: string, form: FormData) {
  if (!TABLES[table]) return;
  const supabase = await admin();
  const row = read(table, form);
  if ("slug" in TABLES[table] && !row.slug) row.slug = slugify(String(row.title_en ?? row.name ?? "")) || "item-" + Date.now();
  if (table === "categories" && !row.id) row.id = slugify(String(row.name ?? "")) || "cat-" + Date.now();
  if (table === "widgets" || table === "media_items") {
    const { data } = await supabase.from(table).select("sort").order("sort", { ascending: false }).limit(1);
    row.sort = (data?.[0]?.sort ?? 0) + 1;
  }
  const { data, error } = await supabase.from(table).insert(row).select("id").single();
  if (!error && table === "books" && data) {
    await supabase.from("book_editions").insert({ book_id: data.id, kind: "original", label: "Original text", tier: String(form.get("tier") ?? "sub"), sort: 1 });
    revalidatePath("/", "layout");
    redirect(`/admin/books/${data.id}?notice=` + encodeURIComponent("Book created. Add its cover and text below."));
  }
  done(form, "/admin", error?.message, "Added.");
}

export async function adminDelete(table: string, id: string, form: FormData) {
  if (!TABLES[table]) return;
  const supabase = await admin();
  const { error } = await supabase.from(table).delete().eq("id", id);
  done(form, "/admin", error?.message, "Removed.");
}

/** Moves a homepage widget up or down by swapping its position with its neighbour. */
export async function moveWidget(id: string, dir: number, form: FormData) {
  const supabase = await admin();
  const { data } = await supabase.from("widgets").select("id,sort").order("sort");
  const list = data ?? [], i = list.findIndex((w) => w.id === id), j = i + dir;
  if (i >= 0 && j >= 0 && j < list.length) {
    await supabase.from("widgets").update({ sort: list[j].sort }).eq("id", list[i].id);
    await supabase.from("widgets").update({ sort: list[i].sort }).eq("id", list[j].id);
  }
  done(form, "/admin/widgets", undefined, "Order changed.");
}

/** Records the storage path of a file the browser has just uploaded. */
export async function setFilePath(table: "books" | "authors" | "media_items", id: string, path: string, isVideo = false) {
  const supabase = await admin();
  const field = table === "books" ? "cover_path" : table === "authors" ? "photo_path" : "file_path";
  await supabase.from(table).update(table === "media_items" ? { file_path: path, is_video: isVideo } : { [field]: path }).eq("id", id);
  revalidatePath("/", "layout");
}

/** A block of text: paragraph, verse, heading, or a picture (t is its file path, cap its caption). */
type Block = { k: "p" | "v" | "h" | "img"; t: string; cap?: string };
type Chapter = { n: number; title: string; subtitle?: string; blocks: Block[] };

/** Plain text: a line starting with "# " begins a chapter; blank lines separate paragraphs; lines starting with ">" are verse. */
function parseText(text: string, fallbackTitle: string): Chapter[] {
  const chapters: Chapter[] = [];
  let cur: Chapter | null = null;
  for (const part of text.replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = part.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines[0].startsWith("# ")) { cur = { n: chapters.length + 1, title: lines[0].slice(2).trim(), blocks: [] }; chapters.push(cur); lines.shift(); if (!lines.length) continue; }
    if (!cur) { cur = { n: 1, title: fallbackTitle, blocks: [] }; chapters.push(cur); }
    if (lines[0].startsWith("## ") && !cur.blocks.length) { cur.subtitle = lines.shift()!.slice(3).trim(); if (!lines.length) continue; }
    if (lines.every((l) => l.startsWith(">"))) cur.blocks.push({ k: "v", t: lines.map((l) => l.slice(1).trim()).join("\n") });
    else cur.blocks.push({ k: "p", t: lines.join(" ") });
  }
  return chapters.filter((c) => c.blocks.length);
}

type AuthorInfo = { name?: string; name_si?: string; era?: string; bio?: string };

/** Reads the author from a book file: either "author": "Name" or "author": { name, name_si, era, bio }. */
function authorOf(meta: Record<string, unknown>): AuthorInfo | null {
  const a = meta.author ?? meta.author_name;
  const info: AuthorInfo = typeof a === "string" ? { name: a } : a && typeof a === "object" ? (a as AuthorInfo) : {};
  if (!info.name_si && typeof meta.author_si === "string") info.name_si = meta.author_si;
  info.name = info.name?.trim(); info.name_si = info.name_si?.trim();
  return info.name || info.name_si ? info : null;
}

/** Finds the author by English name, Sinhala name or slug; adds a new author if there is no match. Returns the author and whether it was new. */
async function findOrCreateAuthor(supabase: Awaited<ReturnType<typeof admin>>, info: AuthorInfo) {
  const norm = (x?: string | null) => (x ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const slug = slugify(info.name ?? "") || "author-" + Date.now();
  const { data: all } = await supabase.from("authors").select("id,name,name_si,slug");
  const hit = (all ?? []).find((a) => (info.name && norm(a.name) === norm(info.name)) || (info.name_si && norm(a.name_si) === norm(info.name_si)) || a.slug === slug);
  if (hit) return { id: hit.id as string, name: (hit.name || hit.name_si) as string, created: false };
  const row = { slug, name: info.name || info.name_si!, name_si: info.name_si ?? "", era: info.era ?? "", bio: info.bio ?? "" };
  const { data, error } = await supabase.from("authors").insert(row).select("id").single();
  if (error || !data) throw new Error(`The author ${row.name} could not be added: ${error?.message}`);
  return { id: data.id as string, name: row.name, created: true };
}

/** Saves chapters for an edition, replacing any text it had. Links the book to the author named in the file, adding the author if new. */
async function saveText(supabase: Awaited<ReturnType<typeof admin>>, editionId: string, chapters: Chapter[], author: AuthorInfo | null) {
  let authorNote = "";
  if (author) {
    const { data: ed } = await supabase.from("book_editions").select("book_id").eq("id", editionId).maybeSingle();
    const a = await findOrCreateAuthor(supabase, author);
    if (ed) await supabase.from("books").update({ author_id: a.id }).eq("id", ed.book_id);
    authorNote = a.created ? ` Added the new author ${a.name} and linked the book.` : ` Linked the book to ${a.name}.`;
  }
  await supabase.from("chapters").delete().eq("edition_id", editionId);
  const { data: rows, error } = await supabase.from("chapters")
    .insert(chapters.map((ch) => ({ edition_id: editionId, n: ch.n, title: ch.title, subtitle: ch.subtitle ?? "" }))).select("id,n");
  if (error || !rows) throw new Error(`The chapters could not be saved: ${error?.message}`);
  const idOf = Object.fromEntries(rows.map((r) => [r.n, r.id]));
  const paras = chapters.flatMap((ch) => ch.blocks.map((b, idx) => ({
    chapter_id: idOf[ch.n], idx, kind: b.k,
    // A picture keeps its file path on the first line and its caption, if any, on the next.
    body: b.k === "img" ? [b.t, b.cap ?? ""].filter(Boolean).join("\n") : b.t,
  })));
  for (let i = 0; i < paras.length; i += 1000) {
    const { error: e2 } = await supabase.from("paragraphs").insert(paras.slice(i, i + 1000));
    if (e2) throw new Error(`The text could not be saved: ${e2.message}`);
  }
  const pics = paras.filter((p) => p.kind === "img").length;
  return `Imported ${chapters.length} chapters and ${paras.length} paragraphs${pics ? `, including ${pics} pictures` : ""}.${authorNote}`;
}

/**
 * Imports an edition's text from a file the browser has already put in storage (book-files/imports/...).
 * The file is a .json from the restoration pipeline (pictures already uploaded and their paths filled in) or a plain .txt.
 * Reading it from storage keeps big books and books with pictures clear of upload size limits.
 */
export async function importFromStorage(editionId: string, path: string, title: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await admin();
  if (!path.startsWith("imports/")) return { ok: false, message: "That file is not an import file." };
  const { data: blob, error } = await supabase.storage.from("book-files").download(path);
  await supabase.storage.from("book-files").remove([path]);
  if (error || !blob) return { ok: false, message: `The file could not be read: ${error?.message}` };
  const raw = await blob.text();
  let chapters: Chapter[]; let author: AuthorInfo | null = null;
  if (path.endsWith(".json")) {
    let meta: Record<string, unknown>;
    try { meta = JSON.parse(raw); } catch { return { ok: false, message: "That file is not valid JSON." }; }
    chapters = meta.chapters as Chapter[];
    if (!Array.isArray(chapters)) return { ok: false, message: "The JSON file has no chapters list." };
    author = authorOf(meta);
  } else chapters = parseText(raw, title || "Text");
  if (!chapters.length) return { ok: false, message: "No text was found in that file." };
  try {
    const message = await saveText(supabase, editionId, chapters, author);
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

/** Gives a reader a plan by hand (for example a gift or a bank-transfer payment). */
export async function grantPlan(userId: string, form: FormData) {
  const supabase = await admin();
  const planId = String(form.get("plan_id") ?? "");
  if (planId === "none") {
    const { error } = await supabase.from("entitlements").delete().eq("user_id", userId);
    done(form, "/admin/customers", error?.message, "Plan removed.");
  }
  const { data: plan } = await supabase.from("plans").select("months").eq("id", planId).maybeSingle();
  if (!plan) done(form, "/admin/customers", "Choose a plan.");
  const ends = plan!.months ? new Date(Date.now() + plan!.months * 30.44 * 864e5).toISOString() : null;
  const { error } = await supabase.from("entitlements").insert({ user_id: userId, plan_id: planId, ends_at: ends });
  done(form, "/admin/customers", error?.message, "Plan granted.");
}
