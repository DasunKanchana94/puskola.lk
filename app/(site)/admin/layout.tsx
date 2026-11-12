import { AdminNav } from "@/components/AdminNav";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";

const NAV: [string, string][] = [["/admin", "Dashboard"], ["/admin/books", "Books"], ["/admin/categories", "Categories"], ["/admin/authors", "Authors"], ["/admin/widgets", "Homepage widgets"], ["/admin/media", "Audio, video, podcasts"], ["/admin/customers", "Customers"], ["/admin/orders", "Orders and revenue"], ["/admin/pricing", "Plans and pricing"], ["/admin/payments", "Payment gateway"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (viewer.role !== "admin") redirect("/");
  return <div className="adm"><AdminNav items={NAV} /><div>{children}</div></div>;
}
