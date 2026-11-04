"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreHorizontal,
  Search,
  Settings,
  Sun,
  Target,
  User,
  X,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const primary = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Search },
  { href: "/applications", label: "Applications", icon: Kanban },
  { href: "/cv-builder", label: "CV", icon: FileText },
];

const secondary = [
  { href: "/profile", label: "Career profile", icon: User, hint: "Skills, CV and career paths" },
  { href: "/automation", label: "Automation", icon: Zap, hint: "Tasks, worker and runs" },
  { href: "/companies", label: "Companies", icon: Building2, hint: "Research employers" },
  { href: "/interviews", label: "Interviews", icon: Target, hint: "Prep and follow-ups" },
  { href: "/settings", label: "Settings", icon: Settings, hint: "Email, permissions and data" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const moreActive = secondary.some((item) => isActive(pathname, item.href));
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-[0_-8px_30px_-24px_rgba(15,23,42,0.6)] backdrop-blur-xl md:hidden"
      >
        <div className="pb-safe">
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-1.5 pt-1.5">
            {primary.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1.5 pt-1 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground active:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-11 place-items-center rounded-full transition-colors",
                      active ? "bg-primary/10" : "bg-transparent",
                    )}
                  >
                    <Icon className={cn("h-[19px] w-[19px]", active && "stroke-[2.4]")} />
                  </span>
                  <span className="leading-none">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className={cn(
                "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1.5 pt-1 text-[10px] font-medium transition-colors",
                moreActive ? "text-primary" : "text-muted-foreground active:text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-11 place-items-center rounded-full transition-colors",
                  moreActive ? "bg-primary/10" : "bg-transparent",
                )}
              >
                <MoreHorizontal className={cn("h-[19px] w-[19px]", moreActive && "stroke-[2.4]")} />
              </span>
              <span className="leading-none">More</span>
            </button>
          </div>
        </div>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More navigation">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="animate-sheet absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-card pb-safe shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">J</div>
                <span className="font-display text-lg font-semibold">JobPilot</span>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                  {initials}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{name}</div>
                  <div className="truncate text-xs text-muted-foreground">{email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {secondary.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-[76px] flex-col justify-between rounded-2xl border p-3 transition-colors",
                        active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-background/40 text-foreground active:bg-muted",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>
                        <span className="block text-sm font-medium leading-tight">{item.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{item.hint}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-2 pl-4">
                <div>
                  <div className="text-sm font-medium">Appearance</div>
                  <div className="text-xs text-muted-foreground">{mounted && theme === "dark" ? "Dark theme" : "Light theme"}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Toggle theme"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {mounted && theme === "dark" ? "Light" : "Dark"}
                </Button>
              </div>

              <form action="/api/auth/logout" method="post">
                <Button type="submit" variant="outline" className="w-full justify-center text-muted-foreground">
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
