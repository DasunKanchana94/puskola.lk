"use server";

import { db } from "@/lib/supabase/server";

export type Bookmark = { id: string; chapter_id: string; para_idx: number; snippet: string };
export type Highlight = { id: string; chapter_id: string; para_idx: number; start_off: number; end_off: number; color: number; note: string; quote: string };

async function reader() {
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Adds a bookmark at a paragraph, or removes it if one is already there. Returns the new bookmark, or null when removed. */
export async function toggleBookmark(chapterId: string, paraIdx: number, snippet: string): Promise<{ added: Bookmark | null; removedId: string | null; error?: string }> {
  const { supabase, user } = await reader();
  if (!user) return { added: null, removedId: null, error: "Sign in to save bookmarks." };
  const { data: old } = await supabase.from("bookmarks").select("id").eq("user_id", user.id).eq("chapter_id", chapterId).eq("para_idx", paraIdx).maybeSingle();
  if (old) { await supabase.from("bookmarks").delete().eq("id", old.id); return { added: null, removedId: old.id }; }
  const { data, error } = await supabase.from("bookmarks").insert({ user_id: user.id, chapter_id: chapterId, para_idx: paraIdx, snippet: snippet.slice(0, 120) }).select("id,chapter_id,para_idx,snippet").single();
  return { added: data ?? null, removedId: null, error: error ? "The bookmark could not be saved. Try again." : undefined };
}

export async function deleteBookmark(id: string) {
  const { supabase, user } = await reader();
  if (user) await supabase.from("bookmarks").delete().eq("id", id);
}

/** Saves a highlight (with an optional note). Any of the reader's highlights it overlaps in the same paragraph are replaced. */
export async function saveHighlight(h: Omit<Highlight, "id">): Promise<{ row: Highlight | null; removed: string[]; error?: string }> {
  const { supabase, user } = await reader();
  if (!user) return { row: null, removed: [], error: "Sign in to save highlights and notes." };
  if (!(h.end_off > h.start_off) || h.color < 1 || h.color > 4) return { row: null, removed: [], error: "That selection could not be saved." };
  const { data: clash } = await supabase.from("highlights").select("id").eq("user_id", user.id).eq("chapter_id", h.chapter_id).eq("para_idx", h.para_idx).lt("start_off", h.end_off).gt("end_off", h.start_off);
  const removed = (clash ?? []).map((c) => c.id);
  if (removed.length) await supabase.from("highlights").delete().in("id", removed);
  const { data, error } = await supabase.from("highlights")
    .insert({ user_id: user.id, chapter_id: h.chapter_id, para_idx: h.para_idx, start_off: h.start_off, end_off: h.end_off, color: h.color, note: h.note.slice(0, 1000), quote: h.quote.slice(0, 400) })
    .select("id,chapter_id,para_idx,start_off,end_off,color,note,quote").single();
  return { row: data ?? null, removed, error: error ? "The highlight could not be saved. Try again." : undefined };
}

export async function deleteHighlight(id: string) {
  const { supabase, user } = await reader();
  if (user) await supabase.from("highlights").delete().eq("id", id);
}
