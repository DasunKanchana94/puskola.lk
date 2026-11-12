import { db } from "@/lib/supabase/server";

const FREE_PER_DAY = 10, PLAN_PER_DAY = 80;
export type Msg = { role: "user" | "assistant"; content: string };

/** Checks that the caller is signed in and under today's limit. Returns the database client, or a message to show the reader. */
export async function aiGate() {
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to use the reading assistant and translation.", status: 401 } as const;
  if (!process.env.ANTHROPIC_API_KEY) return { error: "The reading assistant is not switched on yet. It will be available here soon.", status: 503 } as const;
  const now = new Date().toISOString();
  const [{ data: ents }, { data: profile }] = await Promise.all([
    supabase.from("entitlements").select("ends_at").eq("user_id", user.id),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  const hasPlan = profile?.role === "admin" || (ents ?? []).some((e) => !e.ends_at || e.ends_at > now);
  const { data: used } = await supabase.rpc("bump_ai_usage");
  const limit = hasPlan ? PLAN_PER_DAY : FREE_PER_DAY;
  if (typeof used === "number" && used > limit) {
    return { error: hasPlan ? "You have reached today's limit for the assistant. It resets tomorrow." : `Free accounts get ${FREE_PER_DAY} assistant requests a day. Subscribers get ${PLAN_PER_DAY}. Your limit resets tomorrow.`, status: 429 } as const;
  }
  return { supabase } as const;
}

/** One request to the Claude API. Throws a reader-friendly message on failure. */
export async function askClaude(system: string, messages: Msg[], maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    console.error("Claude API", res.status, (await res.text()).slice(0, 300));
    throw new Error(res.status === 429 || res.status === 529 ? "The assistant is busy right now. Wait a moment and try again." : "The assistant could not answer just now. Try again.");
  }
  const data = await res.json();
  return ((data.content ?? []) as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}
