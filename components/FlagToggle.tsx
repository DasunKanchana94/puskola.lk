"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setBookFlag } from "@/app/actions";

export function FlagToggle({ id, field, value, label }: { id: string; field: "published" | "featured" | "is_new"; value: boolean; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="row small" style={{ gap: 5 }}>
      <input type="checkbox" checked={value} disabled={pending} onChange={(e) => start(async () => { await setBookFlag(id, field, e.target.checked); router.refresh(); })} />{label}
    </label>
  );
}
