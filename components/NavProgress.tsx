"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * A thin bar along the top of the window that shows something is loading:
 * after clicking a link to another page, or submitting a form.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<"idle" | "run" | "end">("idle");
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = () => {
    if (safety.current) clearTimeout(safety.current);
    setState((s) => (s === "run" ? "end" : s));
  };

  // A new page has arrived.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(finish, [pathname, search]);

  useEffect(() => {
    if (state !== "end") return;
    const t = setTimeout(() => setState("idle"), 350);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    const start = () => {
      setState("run");
      if (safety.current) clearTimeout(safety.current);
      safety.current = setTimeout(finish, 20000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => { if (!(e.target as HTMLElement).closest("[data-local]")) start(); };
    window.addEventListener("puskola:busy", start);
    window.addEventListener("puskola:idle", finish);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      window.removeEventListener("puskola:busy", start);
      window.removeEventListener("puskola:idle", finish);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return <div className={`navprog ${state}`} role="progressbar" aria-hidden={state === "idle"} aria-label="Loading" />;
}
