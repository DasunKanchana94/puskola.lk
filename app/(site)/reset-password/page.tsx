import Link from "next/link";
import { Submit } from "@/components/Submit";
import { setNewPassword } from "@/app/actions";
import { getViewer } from "@/lib/data";
import { Notice } from "@/components/ui";

export const metadata = { title: "Choose a new password" };

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, viewer] = await Promise.all([searchParams, getViewer()]);
  if (!viewer) return <div style={{ maxWidth: 420, margin: "0 auto" }}>
    <h1>Link expired</h1>
    <p style={{ margin: "10px 0 16px" }}>This page opens from the reset email. Ask for a new link and open it on this device.</p>
    <Link className="btn pri" href="/login?mode=forgot">Send a new link</Link>
  </div>;
  return <div style={{ maxWidth: 420, margin: "0 auto" }}>
    <h1>Choose a new password</h1>
    <p className="muted" style={{ margin: "8px 0 18px" }}>At least 8 characters.</p>
    <Notice error={error} />
    <form action={setNewPassword} className="card" style={{ display: "grid", gap: 12 }}>
      <label>New password<input className="inp" name="password" id="password" type="password" required minLength={8} autoComplete="new-password" /></label>
      <label>Type it again<input className="inp" name="confirm" id="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
      <Submit className="btn pri">Save new password</Submit>
    </form>
  </div>;
}
