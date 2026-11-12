"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: [string, string][] }) {
  const path = usePathname();
  return <nav aria-label="Back office">{items.map(([href, label]) => {
    const on = href === "/admin" ? path === "/admin" : path.startsWith(href);
    return <Link key={href} href={href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>{label}</Link>;
  })}</nav>;
}
