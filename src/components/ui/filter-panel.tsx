"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function FilterPanel({ title = "Filters", children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="mb-4 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}
