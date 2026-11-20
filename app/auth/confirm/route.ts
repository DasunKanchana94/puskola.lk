import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { db } from "@/lib/supabase/server";

/**
 * Finishes email links that carry a token hash (password reset, sign-up confirmation).
 * Unlike the code exchange in /auth/callback, this works even when the link is opened
 * in a different browser or mail app from the one that asked for it.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? "/reset-password" : "/";
  const next = params.get("next") ?? fallback;
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : fallback;

  if (tokenHash && type) {
    const { error } = await (await db()).auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safe, request.url));
  }
  const retry = type === "recovery" ? "/login?mode=forgot&error=" : "/login?error=";
  return NextResponse.redirect(
    new URL(retry + encodeURIComponent("That link has expired or was already used. Ask for a new one and open it once."), request.url),
  );
}
