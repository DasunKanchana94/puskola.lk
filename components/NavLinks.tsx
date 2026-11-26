"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Headphones, Home, Library, User } from "lucide-react";

const isOn = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

/** The main navigation row, marking the current section. */
export function NavLinks({ items }: { items: [string, string][] }) {
  const path = usePathname();
  return <>{items.map(([href, label]) => <Link key={href} href={href} aria-current={isOn(path, href) ? "page" : undefined}>{label}</Link>)}</>;
}

/** Phone tab bar: the five places readers go most, always one tap away. */
export function TabBar({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const tabs: [string, string, typeof Home][] = [
    ["/", "Home", Home], ["/browse", "Browse", Compass], ["/library", "Library", Library],
    ["/audiobooks", "Listen", Headphones], [signedIn ? "/account" : "/login", signedIn ? "Account" : "Sign in", signedIn ? User : BookOpen],
  ];
  return (
    <nav className="tabbar" aria-label="Quick">
      {tabs.map(([href, label, Icon]) => (
        <Link key={label} href={href} aria-current={isOn(path, href) ? "page" : undefined}>
          <Icon size={22} strokeWidth={1.75} aria-hidden />{label}
        </Link>
      ))}
    </nav>
  );
}
