"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Moon, Search, Settings, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

export function Topbar({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function search(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/jobs?query=${encodeURIComponent(term)}` : "/jobs");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl md:h-16 md:px-6">
      <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">J</div>
        <span className="hidden font-display text-lg font-semibold tracking-tight min-[380px]:inline">JobPilot</span>
      </Link>

      <form onSubmit={search} role="search" className="relative w-full max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 border-border/80 bg-card/70 pl-9 shadow-sm"
          placeholder="Search jobs"
          aria-label="Search jobs, companies and skills"
        />
      </form>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Link
          href="/dashboard#activity"
          aria-label="View recent activity"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative text-muted-foreground")}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {mounted && theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </Button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Account menu for ${name || email}`}
            className="grid h-10 w-10 place-items-center rounded-full transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar name={name || email} size="sm" />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[3.25rem] w-56 origin-top-right overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_1px_2px_rgba(15,23,42,0.06),0_20px_48px_-24px_rgba(15,23,42,0.4)] animate-sheet"
            >
              <div className="border-b border-border px-4 py-3">
                <div className="truncate text-sm font-medium leading-tight">{name || "Signed in"}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{email}</div>
              </div>
              <div className="p-1.5">
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" /> Settings
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
