"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/server";
import { COUNTRIES } from "@/lib/data";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function signIn(form: FormData) {
  const supabase = await db();
  const { error } = await supabase.auth.signInWithPassword({ email: text(form, "email"), password: text(form, "password") });
  if (error) redirect("/login?error=" + encodeURIComponent("That email and password do not match. Check them and try again."));
  redirect(text(form, "next") || "/");
}

export async function signUp(form: FormData) {
  const supabase = await db();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const country = (await cookies()).get("country")?.value ?? "XX";
  const password = text(form, "password");
  if (password.length < 8) redirect("/login?mode=signup&error=" + encodeURIComponent("Use a password of at least 8 characters."));
  const { data, error } = await supabase.auth.signUp({
    email: text(form, "email"), password,
    options: { data: { full_name: text(form, "name"), country }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect("/login?mode=signup&error=" + encodeURIComponent(error.message));
  if (!data.session) redirect("/login?notice=" + encodeURIComponent("Check your email and open the link we sent to finish creating your account."));
  redirect("/");
}

/** Emails a link that signs the reader in and takes them to the page for choosing a new password. */
export async function requestPasswordReset(form: FormData) {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const email = text(form, "email");
  if (!email.includes("@")) redirect("/login?mode=forgot&error=" + encodeURIComponent("Enter the email address you signed up with."));
  await (await db()).auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  // Same message whether or not the address has an account, so the form cannot be used to check who is a member.
  redirect("/login?notice=" + encodeURIComponent("If that email has an account, a link to set a new password is on its way. Open it on this device."));
}

/** Sets a new password for the signed-in reader (reached from the reset email). */
export async function setNewPassword(form: FormData) {
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?mode=forgot&error=" + encodeURIComponent("That link has expired. Ask for a new one."));
  const password = text(form, "password");
  if (password.length < 8) redirect("/reset-password?error=" + encodeURIComponent("Use a password of at least 8 characters."));
  if (password !== text(form, "confirm")) redirect("/reset-password?error=" + encodeURIComponent("The two passwords do not match. Type them again."));
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=" + encodeURIComponent(error.message));
  redirect("/account?notice=" + encodeURIComponent("Your new password is saved."));
}

export async function signOut() {
  await (await db()).auth.signOut();
  redirect("/");
}

export async function setCountry(code: string) {
  if (!COUNTRIES.some((c) => c[0] === code)) return;
  (await cookies()).set("country", code, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ country: code }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function setTheme(theme: string) {
  (await cookies()).set("theme", theme === "dark" ? "dark" : "light", { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function updateProfile(form: FormData) {
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("profiles").update({ full_name: text(form, "name") }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/account?notice=" + encodeURIComponent("Profile saved."));
}

export async function saveProgress(bookId: string, chapterId: string, paraIdx: number, pct: number) {
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("reading_progress").upsert({ user_id: user.id, book_id: bookId, chapter_id: chapterId, para_idx: paraIdx, pct, updated_at: new Date().toISOString() });
}

/* ---------- back office ---------- */
async function requireAdmin() {
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") redirect("/");
  return supabase;
}

export async function setBookFlag(bookId: string, field: "published" | "featured" | "is_new", value: boolean) {
  const supabase = await requireAdmin();
  await supabase.from("books").update({ [field]: value }).eq("id", bookId);
  revalidatePath("/", "layout");
}

type ImportFile = { book_slug: string; edition_kind: string; chapters: { n: number; title: string; subtitle?: string; blocks: { k: "p" | "v" | "h"; t: string }[] }[] };

/** Loads one edition of a book from a JSON file made by the restoration pipeline. Replaces that edition's existing text. */
export async function importEdition(form: FormData) {
  const supabase = await requireAdmin();
  const fail = (m: string) => redirect("/admin?error=" + encodeURIComponent(m));
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) fail("Choose a book JSON file first.");
  let data: ImportFile;
  try { data = JSON.parse(await (file as File).text()); } catch { return fail("That file is not valid JSON."); }
  if (!data.book_slug || !data.edition_kind || !Array.isArray(data.chapters)) return fail("The file is missing book_slug, edition_kind or chapters.");
  const { data: book } = await supabase.from("books").select("id").eq("slug", data.book_slug).maybeSingle();
  if (!book) return fail(`No book with the slug "${data.book_slug}" exists yet. Create the book first.`);
  const { data: edition } = await supabase.from("book_editions").select("id").eq("book_id", book.id).eq("kind", data.edition_kind).maybeSingle();
  if (!edition) return fail(`The book has no "${data.edition_kind}" edition.`);
  await supabase.from("chapters").delete().eq("edition_id", edition.id);
  let paragraphs = 0;
  for (const ch of data.chapters) {
    const { data: row, error } = await supabase.from("chapters").insert({ edition_id: edition.id, n: ch.n, title: ch.title, subtitle: ch.subtitle ?? "" }).select("id").single();
    if (error || !row) return fail(`Chapter ${ch.n} could not be saved: ${error?.message}`);
    const rows = ch.blocks.map((b, idx) => ({ chapter_id: row.id, idx, kind: b.k, body: b.t }));
    for (let i = 0; i < rows.length; i += 400) {
      const { error: e2 } = await supabase.from("paragraphs").insert(rows.slice(i, i + 400));
      if (e2) return fail(`Chapter ${ch.n} text could not be saved: ${e2.message}`);
    }
    paragraphs += rows.length;
  }
  revalidatePath("/", "layout");
  redirect("/admin?notice=" + encodeURIComponent(`Imported ${data.chapters.length} chapters and ${paragraphs} paragraphs into ${data.book_slug} (${data.edition_kind}).`));
}
