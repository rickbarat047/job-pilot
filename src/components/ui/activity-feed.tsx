"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  title: string;
  body?: string | null;
  at?: string | null;
  href?: string;
}

export function ActivityFeed({ items, className }: { items: ActivityItem[]; className?: string }) {
  if (items.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No recent activity.</p>;
  }
  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-background/40 p-3">
          <div className="text-sm font-medium">{item.title}</div>
          {item.body ? <div className="mt-0.5 text-xs text-muted-foreground">{item.body}</div> : null}
          <div className="mt-1 text-xs text-muted-foreground">{item.at ? new Date(item.at).toLocaleString() : ""}</div>
        </div>
      ))}
    </div>
  );
}
