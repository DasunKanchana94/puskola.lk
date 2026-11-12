import { cookies } from "next/headers";
import { db, SUPABASE_URL } from "./supabase/server";

export type Category = { id: string; name: string; name_si: string; color: string; sort: number };
export type Author = { id: string; slug: string; name: string; name_si: string; era: string; bio: string; photo_path: string | null };
export type Edition = { id: string; kind: string; label: string; tier: "free" | "sub"; sort: number };
export type Book = {
  id: string; slug: string; title_si: string; title_en: string; description: string; language: string;
  cover_path: string | null; category_id: string | null; published: boolean; featured: boolean; is_new: boolean;
  regions: string[]; reads: number; authors: Pick<Author, "slug" | "name"> | null; book_editions: Edition[];
};
export type Viewer = { id: string; email: string; name: string; role: string; hasPlan: boolean; planName: string | null; until: string | null } | null;

export const COUNTRIES: [string, string][] = [
  ["LK", "Sri Lanka"], ["IN", "India"], ["MY", "Malaysia"], ["SG", "Singapore"], ["AE", "United Arab Emirates"],
  ["AU", "Australia"], ["GB", "United Kingdom"], ["US", "United States"], ["XX", "Other country"],
];
export const countryName = (c: string) => COUNTRIES.find((x) => x[0] === c)?.[1] ?? "Other country";
/** Public URL of a stored file. Paths that start with "/" are files shipped with the site itself. */
export const fileUrl = (bucket: string, path: string | null) => (!path ? null : path.startsWith("/") ? path : `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`);
export const money = (n: number) => "$" + (Number(n) % 1 ? Number(n).toFixed(2) : Number(n).toFixed(0));

const BOOK_COLS = "id,slug,title_si,title_en,description,language,cover_path,category_id,published,featured,is_new,regions,reads,authors(slug,name),book_editions(id,kind,label,tier,sort)";

export async function getCountry() {
  const c = (await cookies()).get("country")?.value ?? "XX";
  return COUNTRIES.some((x) => x[0] === c) ? c : "XX";
}

export async function getViewer(): Promise<Viewer> {
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: ents }] = await Promise.all([
    supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle(),
    supabase.from("entitlements").select("ends_at,plans(name)").eq("user_id", user.id).order("starts_at", { ascending: false }),
  ]);
  const now = new Date().toISOString();
  const active = (ents ?? []).find((e) => !e.ends_at || e.ends_at > now) as { ends_at: string | null; plans: { name: string } | null } | undefined;
  return {
    id: user.id, email: user.email ?? "", name: profile?.full_name || (user.email ?? "").split("@")[0], role: profile?.role ?? "reader",
    hasPlan: !!active, planName: active?.plans?.name ?? null, until: active?.ends_at ?? null,
  };
}

/** Published books offered in the reader's country. */
export async function getBooks(opts: { category?: string; q?: string; authorId?: string } = {}): Promise<Book[]> {
  const supabase = await db();
  const country = await getCountry();
  let query = supabase.from("books").select(BOOK_COLS).eq("published", true).or(`regions.eq.{},regions.cs.{${country}}`).order("created_at", { ascending: false });
  if (opts.category) query = query.eq("category_id", opts.category);
  if (opts.authorId) query = query.eq("author_id", opts.authorId);
  if (opts.q) {
    const q = opts.q.replace(/[%,()]/g, " ").trim();
    if (q) query = query.or(`title_en.ilike.%${q}%,title_si.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) console.error("getBooks", error.message);
  return (data ?? []) as unknown as Book[];
}

export async function getBook(slug: string): Promise<Book | null> {
  const supabase = await db();
  const { data } = await supabase.from("books").select(BOOK_COLS).eq("slug", slug).maybeSingle();
  return (data as unknown as Book) ?? null;
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await (await db()).from("categories").select("*").order("sort");
  return (data ?? []) as Category[];
}
export async function getAuthors(): Promise<Author[]> {
  const { data } = await (await db()).from("authors").select("*").order("name");
  return (data ?? []) as Author[];
}
export const isFree = (b: Book) => b.book_editions.some((e) => e.tier === "free");
