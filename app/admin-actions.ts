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

type Block = { k: "p" | "v" | "h"; t: string };
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

/** Loads the text of one edition from a .json file (restoration pipeline) or a .txt file. Replaces the edition's existing text. */
export async function importText(editionId: string, form: FormData) {
  const supabase = await admin();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) done(form, "/admin/books", "Choose a text file first.");
  const raw = await (file as File).text();
  let chapters: Chapter[];
  if ((file as File).name.toLowerCase().endsWith(".json")) {
    try { chapters = JSON.parse(raw).chapters; } catch { return done(form, "/admin/books", "That file is not valid JSON."); }
    if (!Array.isArray(chapters)) return done(form, "/admin/books", "The JSON file has no chapters list.");
  } else chapters = parseText(raw, String(form.get("title") ?? "Text"));
  if (!chapters.length) return done(form, "/admin/books", "No text was found in that file.");
  await supabase.from("chapters").delete().eq("edition_id", editionId);
  let count = 0;
  for (const ch of chapters) {
    const { data: row, error } = await supabase.from("chapters").insert({ edition_id: editionId, n: ch.n, title: ch.title, subtitle: ch.subtitle ?? "" }).select("id").single();
    if (error || !row) return done(form, "/admin/books", `Chapter ${ch.n} could not be saved: ${error?.message}`);
    const rows = ch.blocks.map((b, idx) => ({ chapter_id: row.id, idx, kind: b.k, body: b.t }));
    for (let i = 0; i < rows.length; i += 400) {
      const { error: e2 } = await supabase.from("paragraphs").insert(rows.slice(i, i + 400));
      if (e2) return done(form, "/admin/books", `Chapter ${ch.n} text could not be saved: ${e2.message}`);
    }
    count += rows.length;
  }
  done(form, "/admin/books", undefined, `Imported ${chapters.length} chapters and ${count} paragraphs.`);
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
