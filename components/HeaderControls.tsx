"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setCountry, setTheme } from "@/app/actions";

export function CountrySelect({ value, countries }: { value: string; countries: [string, string][] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select className="inp cty" id="hd-country" aria-label="Your country" title="Your country. Some books are only available in certain countries." value={value} disabled={pending}
      onChange={(e) => start(async () => { await setCountry(e.target.value); router.refresh(); })}>
      {countries.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
    </select>
  );
}

export function ThemeToggle({ theme }: { theme: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <button className="iconb" title="Switch light or dark theme" aria-label="Switch light or dark theme"
      onClick={() => start(async () => { await setTheme(theme === "dark" ? "light" : "dark"); router.refresh(); })}>
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
