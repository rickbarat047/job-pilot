import * as React from "react";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  type: string;
  detail?: string | null;
  at?: string | null;
  to?: string | null;
}

export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  if (events.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No events yet.</p>;
  }
  return (
    <ol className={cn("relative space-y-4 border-l border-border pl-5", className)}>
      {events.map((event, index) => (
        <li key={event.id} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full",
              event.type.includes("reply") ? "bg-emerald-500" : event.type.includes("fail") || event.type.includes("reject") || event.type.includes("withdraw") ? "bg-destructive" : "bg-primary",
            )}
          />
          <div className="text-sm">
            <span className="font-medium capitalize">{event.type.replace(/_/g, " ")}</span>
            {event.to ? <span className="text-muted-foreground"> → {event.to}</span> : null}
          </div>
          <div className="text-xs text-muted-foreground">{event.at ? new Date(event.at).toLocaleString() : ""}</div>
          {event.detail ? <p className="mt-1 text-sm text-muted-foreground break-words">{event.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}
