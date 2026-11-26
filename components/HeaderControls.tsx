"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { setCountry, setTheme } from "@/app/actions";

export function CountrySelect({ value, countries, id = "hd-country" }: { value: string; countries: [string, string][]; id?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select className="inp cty" id={id} aria-label="Your country" title="Your country. Some books are only available in certain countries." value={value} disabled={pending}
      onChange={(e) => start(async () => { await setCountry(e.target.value); router.refresh(); })}>
      {countries.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
    </select>
  );
}

export function ThemeToggle({ theme }: { theme: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const dark = theme === "dark";
  return (
    <button className="iconb" title={dark ? "Switch to light theme" : "Switch to dark theme"} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} aria-pressed={dark} disabled={pending}
      onClick={() => start(async () => { document.body.classList.toggle("dark", !dark); await setTheme(dark ? "light" : "dark"); router.refresh(); })}>
      {dark ? <Sun size={19} strokeWidth={1.75} aria-hidden /> : <Moon size={19} strokeWidth={1.75} aria-hidden />}
    </button>
  );
}
