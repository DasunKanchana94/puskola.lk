"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** The account dropdown. Closes on a click outside it, on Escape, on choosing an item, and when the page changes. */
export function AccountMenu({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const close = () => { if (ref.current) ref.current.open = false; };

  useEffect(close, [pathname]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && ref.current?.open) { close(); ref.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <details className="acct" ref={ref}>
      <summary className="btn sm">{label}</summary>
      <div className="dd" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) close(); }}>{children}</div>
    </details>
  );
}
