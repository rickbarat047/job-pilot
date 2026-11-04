"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({ value, onChange, items, className }: { value: string; onChange: (value: string) => void; items: { value: string; label: React.ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto rounded-full border border-border bg-muted/60 p-1", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            value === item.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
