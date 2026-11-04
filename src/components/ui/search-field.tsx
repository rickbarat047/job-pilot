"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  type = "search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <svg
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-7a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Search…"}
        className="flex h-11 w-full rounded-xl border border-input bg-background pl-9 pr-4 py-2 text-base ring-offset-background placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
      />
    </div>
  );
}
