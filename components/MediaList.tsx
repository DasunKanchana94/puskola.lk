"use client";

import Link from "next/link";
import { useState } from "react";
import { browserDb } from "@/lib/supabase/client";

export type MediaItem = { id: string; kind: string; title: string; duration: string; tier: string; file_path: string | null; is_video: boolean };
const KIND: Record<string, string> = { audio: "Audiobook", summary: "Audio summary", video: "Video", podcast: "Podcast" };

/** Lists audio and video items. Pressing Play fetches a short-lived link, which storage only grants to readers allowed to play it. */
export function MediaList({ items, canPlaySub, signedIn }: { items: MediaItem[]; canPlaySub: boolean; signedIn: boolean }) {
  const [open, setOpen] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);

  const play = async (m: MediaItem) => {
    if (open?.id === m.id) return setOpen(null);
    setError(null); setBusy(m.id);
    const { data, error: e } = await browserDb().storage.from("media").createSignedUrl(m.file_path!, 60 * 60 * 3);
    setBusy(null);
    if (e || !data) return setError({ id: m.id, text: "This file could not be opened. Try again in a moment." });
    setOpen({ id: m.id, url: data.signedUrl });
  };

  return <div className="mlist" style={{ marginTop: 22 }}>{items.map((m) => {
    const locked = m.tier === "sub" && !canPlaySub;
    return <div key={m.id} style={{ display: "grid", gap: 8 }}>
      <div className="mrow">
        {m.file_path && !locked
          ? <button className="play" onClick={() => play(m)} disabled={busy === m.id} aria-label={`${open?.id === m.id ? "Close" : "Play"} ${m.title}`}>{busy === m.id ? "…" : open?.id === m.id ? "■" : "▶"}</button>
          : <span className="play" aria-hidden style={{ opacity: 0.35, display: "grid", placeItems: "center" }}>▶</span>}
        <div><b>{m.title}</b><div className="muted small">{KIND[m.kind] ?? m.kind}{m.duration ? ` · ${m.duration}` : ""}</div></div>
        <span className="sp" />
        {!m.file_path ? <span className="pill grey">Coming soon</span>
          : locked ? <Link className="btn sm" href={signedIn ? "/plans" : "/login?next=/plans"}>Subscribe to play</Link>
          : m.tier === "free" ? <span className="pill">Free</span> : <span className="pill gold">Subscription</span>}
      </div>
      {error?.id === m.id && <div className="small" role="alert" style={{ color: "var(--danger)" }}>{error.text}</div>}
      {open?.id === m.id && (m.is_video
        ? <video src={open.url} controls autoPlay playsInline style={{ width: "100%", maxHeight: "70vh", borderRadius: 12, background: "#000" }} />
        : <audio src={open.url} controls autoPlay style={{ width: "100%" }} />)}
    </div>;
  })}</div>;
}
