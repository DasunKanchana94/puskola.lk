import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/supabase/server";

/** Finishes email confirmation and password-reset links: swaps the code for a signed-in session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await (await db()).auth.exchangeCodeForSession(code);
    const next = request.nextUrl.searchParams.get("next") ?? "/";
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (!error) return NextResponse.redirect(new URL(safe, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("That link has expired. Sign in, or create the account again."), request.url));
}
