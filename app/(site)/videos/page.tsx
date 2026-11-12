import { db } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data";
import { MediaList, type MediaItem } from "@/components/MediaList";

export const metadata = { title: "Videos and podcasts" };

export default async function Page() {
  const [{ data }, viewer] = await Promise.all([
    (await db()).from("media_items").select("id,kind,title,duration,tier,file_path,is_video").in("kind", ["video", "podcast"]).eq("published", true).order("sort"),
    getViewer(),
  ]);
  const items = (data ?? []) as MediaItem[];
  return <>
    <h1>Videos and podcasts</h1>
    {items.length ? <MediaList items={items} canPlaySub={!!viewer?.hasPlan || viewer?.role === "admin"} signedIn={!!viewer} />
      : <div className="card" style={{ marginTop: 22 }}>Nothing has been published here yet. Check back soon.</div>}
  </>;
}
