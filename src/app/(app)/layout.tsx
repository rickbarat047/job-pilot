import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { MobileNav } from "@/components/mobile-nav";
import { getDb } from "@/lib/db";
import { ensureBootstrap } from "@/lib/bootstrap";
import { get } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  getDb();
  // Fire bootstrap in the background — don't block the page render.
  void ensureBootstrap().catch(() => {});
  // Guided onboarding: send first-time users (no profile yet) to onboarding.
  try {
    const row = await get<{ user_id: string }>("SELECT user_id FROM candidate_profiles WHERE user_id = ?", [user.id]);
    if (!row) redirect("/onboarding");
  } catch {
    // If the check fails, don't block the page.
  }
  return (
    <div className="flex min-h-dvh w-full max-w-full overflow-x-clip">
      <Sidebar name={user.name} email={user.email} />
      <div className="flex w-full min-w-0 flex-1 flex-col">
        <Topbar name={user.name} email={user.email} />
        <main className="flex-1 px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-6 md:pt-6 lg:px-8">
          {children}
        </main>
      </div>
      <MobileNav name={user.name} email={user.email} />
    </div>
  );
}
