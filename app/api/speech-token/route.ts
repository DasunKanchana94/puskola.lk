import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";

/**
 * A 10-minute Azure Speech token for the back office's narration generator.
 * Admins only. The key itself never leaves the server.
 */
export async function POST() {
  const supabase = await db();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return NextResponse.json({ error: "Only admins can generate narration." }, { status: 403 });

  const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return NextResponse.json({ error: "Narration is not set up yet: add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in Vercel, then redeploy." }, { status: 503 });
  const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key, "Content-Length": "0" } });
  if (!res.ok) return NextResponse.json({ error: `Azure refused the key (${res.status}). Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.` }, { status: 502 });
  return NextResponse.json({ token: await res.text(), region });
}
