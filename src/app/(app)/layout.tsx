import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { getDb } from "@/lib/db";
import { ensureBootstrap } from "@/lib/bootstrap";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  getDb();
  await ensureBootstrap();
  return (
    <div className="flex min-h-screen">
      <Sidebar name={user.name} email={user.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
