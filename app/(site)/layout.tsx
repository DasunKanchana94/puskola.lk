import Link from "next/link";
import { cookies } from "next/headers";
import { COUNTRIES, getCountry, getViewer } from "@/lib/data";
import { CountrySelect, ThemeToggle } from "@/components/HeaderControls";
import { initials } from "@/components/ui";
import { signOut } from "@/app/actions";

const NAV: [string, string][] = [["/", "Home"], ["/browse", "Browse"], ["/categories", "Categories"], ["/authors", "Authors"], ["/audiobooks", "Audiobooks"], ["/videos", "Videos and podcasts"]];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [viewer, country, store] = await Promise.all([getViewer(), getCountry(), cookies()]);
  const theme = store.get("theme")?.value === "dark" ? "dark" : "light";
  return (
    <>
      <header className="hdr">
        <div className="wrap top">
          <Link className="logo" href="/"><i>පු</i>Puskola</Link>
          <form className="search" action="/browse"><input className="inp" name="q" id="q" placeholder="Search books and authors" aria-label="Search" /></form>
          <span className="sp" />
          {!viewer?.hasPlan && <Link className="btn sm pri" href="/plans">See plans</Link>}
          <CountrySelect value={country} countries={COUNTRIES} />
          <ThemeToggle theme={theme} />
          {viewer ? (
            <details className="acct">
              <summary className="btn sm"><span className="avatar xs">{initials(viewer.name)}</span>{viewer.name.split(" ")[0]}</summary>
              <div className="dd">
                <Link href="/library">My library</Link>
                <Link href="/account">Profile and plan</Link>
                <Link href="/plans">Plans</Link>
                {viewer.role === "admin" && <Link href="/admin">Back office</Link>}
                <form action={signOut}><button>Sign out</button></form>
              </div>
            </details>
          ) : <Link className="btn sm" href="/login">Sign in</Link>}
        </div>
        <div className="navrow"><nav className="wrap nav" aria-label="Main">{NAV.map((n) => <Link key={n[0]} href={n[0]}>{n[1]}</Link>)}</nav></div>
      </header>
      <main><div className="wrap">{children}</div></main>
      <footer className="foot"><div className="wrap row"><span>Puskola. Sinhala books, restored and readable.</span><span className="sp" /><Link href="/plans">Plans</Link></div></footer>
    </>
  );
}
