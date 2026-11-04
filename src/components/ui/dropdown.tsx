"use client";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownItem {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function Dropdown({ trigger, items, align = "right", className }: { trigger: React.ReactNode; items: DropdownItem[]; align?: "left" | "right"; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <span className="relative inline-flex">
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="inline-flex">
          {trigger}
        </button>
        <ChevronDown className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {open ? (
          <div
            role="menu"
            className={cn(
              "absolute z-40 min-w-[200px] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg",
              align === "right" ? "right-0" : "left-0",
              "bottom-full mb-2",
            )}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left text-sm disabled:opacity-50 disabled:pointer-events-none",
                  item.destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </span>
    </div>
  );
}
