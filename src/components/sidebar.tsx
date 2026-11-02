"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Search, Kanban, User, Zap, Building2, Target, Settings, LogOut, Briefcase, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Job discovery", icon: Search },
  { href: "/applications", label: "Applications", icon: Kanban },
  { href: "/profile", label: "Career profile", icon: User },
  { href: "/cv-builder", label: "AI CV builder", icon: FileText },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/interviews", label: "Interviews", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card/60 backdrop-blur md:flex md:flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">J</div>
        <div>
          <div className="font-display text-lg font-semibold leading-none">JobPilot</div>
          <div className="text-xs text-muted-foreground">AI career agent</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all",
                active
                  ? "bg-primary/10 font-medium text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {active ? <span className="absolute left-0 h-5 w-0.5 rounded-full bg-primary" /> : null}
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="mb-3">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </div>
        <form action="/api/auth/logout" method="post">
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
