"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Tooltip({ content, children, className }: { content: string; children: React.ReactElement; className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      {React.cloneElement(children, { "data-tooltip": content } as Record<string, unknown>)}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
