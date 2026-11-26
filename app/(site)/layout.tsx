import Link from "next/link";
import { cookies } from "next/headers";
import { COUNTRIES, getCountry, getViewer } from "@/lib/data";
import { CountrySelect, ThemeToggle } from "@/components/HeaderControls";
import { initials } from "@/components/ui";
import { signOut } from "@/app/actions";
import { AccountMenu } from "@/components/AccountMenu";
import { Submit } from "@/components/Submit";
import { BrandMark } from "@/components/Brand";
import { NavLinks, TabBar } from "@/components/NavLinks";
import { Search } from "lucide-react";

const NAV: [string, string][] = [["/", "Home"], ["/browse", "Browse"], ["/categories", "Categories"], ["/authors", "Authors"], ["/audiobooks", "Audiobooks"], ["/videos", "Videos and podcasts"]];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [viewer, country, store] = await Promise.all([getViewer(), getCountry(), cookies()]);
  const theme = store.get("theme")?.value === "dark" ? "dark" : "light";
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="hdr">
        <div className="wrap top">
          <Link className="logo" href="/" aria-label="Puskola home"><BrandMark /><span className="word"><b>Puskola</b><small>පුස්කොළ</small></span></Link>
          <form className="search" action="/browse" role="search"><Search size={18} strokeWidth={1.75} aria-hidden />
            <input className="inp" type="search" name="q" id="q" placeholder="Search books and authors" aria-label="Search books and authors" autoComplete="off" /></form>
          <span className="sp" />
          {!viewer?.hasPlan && <Link className="btn sm pri plans-cta" href="/plans">See plans</Link>}
          <CountrySelect value={country} countries={COUNTRIES} />
          <ThemeToggle theme={theme} />
          {viewer ? (
            <AccountMenu label={<><span className="avatar xs">{initials(viewer.name)}</span>{viewer.name.split(" ")[0]}</>}>
                <Link href="/library">My library</Link>
                <Link href="/account">Profile and plan</Link>
                <Link href="/plans">Plans</Link>
                {viewer.role === "admin" && <Link href="/admin">Back office</Link>}
                <form action={signOut}><Submit className="">Sign out</Submit></form>
            </AccountMenu>
          ) : <Link className="btn sm" href="/login">Sign in</Link>}
        </div>
        <div className="navrow"><nav className="wrap nav" aria-label="Main"><NavLinks items={NAV} /></nav></div>
      </header>
      <main id="main" tabIndex={-1}><div className="wrap">{children}</div></main>
      <footer className="foot">
        <div className="wrap">
          <div className="cols">
            <div>
              <Link className="logo" href="/" aria-label="Puskola home"><BrandMark /><span className="word"><b>Puskola</b><small>පුස්කොළ</small></span></Link>
              <p style={{ marginTop: 10, maxWidth: "36ch" }}>Sinhala books, restored and readable. Classics, Buddhist writings, novels and audiobooks, in a reader made for long sessions.</p>
            </div>
            <div><h4>Read</h4><ul><li><Link href="/browse">Browse all books</Link></li><li><Link href="/categories">Categories</Link></li><li><Link href="/authors">Authors</Link></li><li><Link href="/library">My library</Link></li></ul></div>
            <div><h4>Listen and watch</h4><ul><li><Link href="/audiobooks">Audiobooks</Link></li><li><Link href="/videos">Videos and podcasts</Link></li></ul></div>
            <div><h4>Account</h4><ul><li><Link href="/plans">Plans</Link></li><li><Link href={viewer ? "/account" : "/login"}>{viewer ? "Profile and plan" : "Sign in"}</Link></li></ul></div>
          </div>
          <div className="base"><span>© {new Date().getFullYear()} DK Trade International (Pvt) Ltd</span><span className="sp" />
            <label className="row small" style={{ gap: 8 }}>Country <CountrySelect id="ft-country" value={country} countries={COUNTRIES} /></label></div>
        </div>
      </footer>
      <TabBar signedIn={!!viewer} />
    </>
  );
}
