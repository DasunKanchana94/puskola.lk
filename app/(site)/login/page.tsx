import Link from "next/link";
import { requestPasswordReset, signIn, signUp } from "@/app/actions";
import { Notice } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string; notice?: string; next?: string }> }) {
  const { mode, error, notice, next } = await searchParams;
  const signup = mode === "signup";
  if (mode === "forgot") return <div style={{ maxWidth: 420, margin: "0 auto" }}>
    <h1>Reset your password</h1>
    <p className="muted" style={{ margin: "8px 0 18px" }}>Enter your email and we will send you a link to choose a new password.</p>
    <Notice error={error} notice={notice} />
    <form action={requestPasswordReset} className="card" style={{ display: "grid", gap: 12 }}>
      <label>Email<input className="inp" name="email" id="email" type="email" required autoComplete="email" /></label>
      <button className="btn pri">Send reset link</button>
    </form>
    <p style={{ marginTop: 14 }}><Link href="/login">Back to sign in</Link></p>
  </div>;
  return <div style={{ maxWidth: 420, margin: "0 auto" }}>
    <h1>{signup ? "Create your account" : "Sign in"}</h1>
    <p className="muted" style={{ margin: "8px 0 18px" }}>{signup ? "Free books are open to every member." : "Welcome back."}</p>
    <Notice error={error} notice={notice} />
    <form action={signup ? signUp : signIn} className="card" style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="next" value={next ?? ""} />
      {signup && <label>Name<input className="inp" name="name" id="name" required autoComplete="name" /></label>}
      <label>Email<input className="inp" name="email" id="email" type="email" required autoComplete="email" /></label>
      <label>Password<input className="inp" name="password" id="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} /></label>
      <button className="btn pri">{signup ? "Create account" : "Sign in"}</button>
      {!signup && <Link className="small" href="/login?mode=forgot">Forgot your password?</Link>}
    </form>
    <p style={{ marginTop: 14 }}>{signup ? <>Already a member? <Link href="/login">Sign in</Link></> : <>New here? <Link href="/login?mode=signup">Create an account</Link></>}</p>
  </div>;
}
