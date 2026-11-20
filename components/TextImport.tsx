"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { unzipSync } from "fflate";
import { browserDb } from "@/lib/supabase/client";
import { importFromStorage } from "@/app/admin-actions";

type Block = { k: string; t: string; cap?: string };
type Book = { chapters?: { blocks?: Block[] }[] };

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
const isLocal = (t: string) => !/^(https?:)?\/\//.test(t) && !t.startsWith("/") && !t.startsWith("pages/");

/**
 * Loads an edition's text. Takes a .json, a .txt, or a .zip holding the .json and its pictures.
 * Pictures go straight from the browser to storage; the text then follows through storage too,
 * so large books never hit the upload size limit.
 */
export function TextImport({ editionId, bookId, title, hasText }: { editionId: string; bookId: string; title: string; hasText: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy?: string; ok?: string; err?: string }>({});

  const run = async (file: File) => {
    const supabase = browserDb();
    const name = file.name.toLowerCase();
    let text: string, ext: "json" | "txt";
    setState({ busy: "Reading the file…" });

    if (name.endsWith(".zip")) {
      let files: Record<string, Uint8Array>;
      try { files = unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { return setState({ err: "That .zip file could not be opened." }); }
      const paths = Object.keys(files).filter((p) => !p.startsWith("__MACOSX/") && !p.endsWith("/"));
      const jsonPath = paths.find((p) => p.toLowerCase().endsWith(".json"));
      if (!jsonPath) return setState({ err: "The .zip has no .json file in it." });
      const base = jsonPath.includes("/") ? jsonPath.slice(0, jsonPath.lastIndexOf("/") + 1) : "";
      let book: Book;
      try { book = JSON.parse(new TextDecoder().decode(files[jsonPath])); } catch { return setState({ err: "The .json file inside the .zip is not valid." }); }

      const pics = (book.chapters ?? []).flatMap((c) => c.blocks ?? []).filter((b) => b.k === "img" && isLocal(b.t));
      const uploaded = new Map<string, string>();
      const missing: string[] = [];
      for (const [i, b] of pics.entries()) {
        const want = b.t.replace(/^\.\//, "");
        if (!uploaded.has(want)) {
          const found = files[base + want] ? base + want : files[want] ? want : paths.find((p) => p.endsWith("/" + want.split("/").pop()) || p === want.split("/").pop());
          if (!found) { missing.push(want); continue; }
          setState({ busy: `Uploading pictures ${i + 1} of ${pics.length}…` });
          const fileExt = (found.split(".").pop() ?? "").toLowerCase();
          const safe = found.split("/").pop()!.replace(/[^a-zA-Z0-9._-]/g, "-");
          const path = `pages/${bookId}/${Date.now()}-${i}-${safe}`;
          const { error } = await supabase.storage.from("covers").upload(path, new Blob([files[found] as BlobPart], { type: TYPES[fileExt] ?? "application/octet-stream" }), { contentType: TYPES[fileExt] ?? "application/octet-stream", upsert: false });
          if (error) return setState({ err: `A picture could not be uploaded (${want}): ${error.message}` });
          uploaded.set(want, path);
        }
        b.t = uploaded.get(want) ?? b.t;
      }
      if (missing.length) return setState({ err: `These pictures are named in the text but are not in the .zip: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}` });
      text = JSON.stringify(book); ext = "json";
    } else if (name.endsWith(".json")) {
      text = await file.text(); ext = "json";
      try {
        const book: Book = JSON.parse(text);
        const local = (book.chapters ?? []).flatMap((c) => c.blocks ?? []).filter((b) => b.k === "img" && isLocal(b.t));
        if (local.length) return setState({ err: `This book has ${local.length} pictures. Upload a .zip with the .json and the picture files together.` });
      } catch { return setState({ err: "That file is not valid JSON." }); }
    } else if (name.endsWith(".txt")) { text = await file.text(); ext = "txt"; }
    else return setState({ err: "Choose a .json, .zip or .txt file." });

    setState({ busy: "Saving the text…" });
    const path = `imports/${editionId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("book-files").upload(path, new Blob([text], { type: ext === "json" ? "application/json" : "text/plain" }), { upsert: false });
    if (error) return setState({ err: `The file could not be uploaded: ${error.message}` });
    const res = await importFromStorage(editionId, path, title);
    setState(res.ok ? { ok: res.message } : { err: res.message });
    if (res.ok) router.refresh();
  };

  const id = `import-${editionId}`;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span className="row" style={{ gap: 8 }}>
        <label className={`btn sm pri${state.busy ? " disabled" : ""}`} htmlFor={id} aria-busy={!!state.busy || undefined}>
          {state.busy && <span className="spin" aria-hidden />}{state.busy ? "Working…" : hasText ? "Replace text" : "Upload text"}
        </label>
        <input id={id} type="file" hidden accept=".json,.zip,.txt" disabled={!!state.busy} aria-label={`Text file for this edition`}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(f).catch((x) => setState({ err: String(x?.message ?? x) })); }} />
        <span className="muted small">.json, .txt, or a .zip with pictures</span>
      </span>
      {state.busy && <span className="small muted" role="status">{state.busy}</span>}
      {state.ok && <span className="small" style={{ color: "var(--ok)" }} role="status">{state.ok}</span>}
      {state.err && <span className="small" style={{ color: "var(--danger)" }} role="alert">{state.err}</span>}
    </div>
  );
}
