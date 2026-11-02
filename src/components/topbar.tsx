"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Moon, Sun, Bell, Search, LayoutDashboard, Briefcase, Kanban, User, Zap, Building2, Target, Settings, FileText } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Job discovery", icon: Briefcase },
  { href: "/applications", label: "Applications", icon: Kanban },
  { href: "/profile", label: "Career profile", icon: User },
  { href: "/cv-builder", label: "AI CV builder", icon: FileText },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/interviews", label: "Interviews", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
        <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-muted md:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">J</div>
          <span className="font-display text-lg font-semibold">JobPilot</span>
        </Link>
        <div className="relative hidden max-w-md flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="border-border/80 bg-card/70 pl-9 shadow-sm" placeholder="Search jobs, companies, skills…" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-background" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">J</div>
              <span className="font-display text-lg font-semibold">JobPilot</span>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-muted" aria-label="Close navigation" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="space-y-1 p-4">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-base", active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </>
  );
}
