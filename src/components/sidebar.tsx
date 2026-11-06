"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Search, Kanban, User, Zap, Building2, Target, Settings, LogOut, FileText,
  Activity,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navGroups: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/applications", label: "Applications", icon: Kanban },
      { href: "/interviews", label: "Interviews", icon: Target },
    ],
  },
  {
    label: "Find work",
    items: [
      { href: "/jobs", label: "Job discovery", icon: Search },
      { href: "/companies", label: "Companies", icon: Building2 },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/profile", label: "Career profile", icon: User },
      { href: "/cv-builder", label: "AI CV builder", icon: FileText },
      { href: "/automation", label: "Automation", icon: Zap },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/users", label: "User activity", icon: Activity },
    ],
  },
];

export function Sidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-[0_8px_20px_-8px_color-mix(in_srgb,var(--primary)_55%,transparent)]">J</div>
        <div>
          <div className="font-display text-lg font-semibold leading-none tracking-tight">JobPilot</div>
          <div className="mt-1 text-xs text-muted-foreground">AI career agent</div>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 scrollbar-thin" aria-label="Application navigation">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all",
                      active
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {active ? <span className="absolute left-0 h-4 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                    <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-4">
        <div className="mb-2.5 flex min-w-0 items-center gap-2.5">
          <Avatar name={name || email} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium leading-tight">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
