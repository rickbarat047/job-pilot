import * as React from "react";
import { cn } from "@/lib/utils";

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = String(name ?? "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
    || "?";
  const sizes = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  } as const;
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full bg-primary/10 font-semibold text-primary", sizes[size], className)}
    >
      {initials}
    </span>
  );
}
