"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserDb } from "@/lib/supabase/client";
import { setFilePath } from "@/app/admin-actions";

/** Uploads a file straight from the browser to storage, then records its path on the given row. */
export function FileUpload({ bucket, table, id, accept, label, maxMb }: { bucket: string; table: "books" | "authors" | "media_items"; id: string; accept: string; label: string; maxMb: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  const inputId = `up-${table}-${id}`;
  return (
    <span className="row" style={{ gap: 8 }}>
      <label className="btn sm" htmlFor={inputId}>{state === "busy" ? "Uploading…" : label}</label>
      <input id={inputId} type="file" accept={accept} hidden disabled={state === "busy"} onChange={async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        if (file.size > maxMb * 1024 * 1024) return setState(`That file is larger than ${maxMb} MB. Choose a smaller one.`);
        setState("busy");
        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${id}-${Date.now()}.${ext}`;
        const { error } = await browserDb().storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) return setState(`Upload failed: ${error.message}`);
        await setFilePath(table, id, path, file.type.startsWith("video"));
        setState("done"); router.refresh();
      }} />
      {state === "done" && <span className="small" style={{ color: "var(--ok)" }}>Uploaded</span>}
      {state !== "idle" && state !== "busy" && state !== "done" && <span className="small" style={{ color: "var(--danger)" }} role="alert">{state}</span>}
    </span>
  );
}
