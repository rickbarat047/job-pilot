import * as React from "react";
import { cn } from "@/lib/utils";
import {
  FileText, CheckCircle2, Send, XCircle, RotateCcw, Bot, Mail, MessageSquare,
  Reply, AlertTriangle, Clock, Sparkles, Eye, Upload, CircleDot,
} from "lucide-react";

export interface TimelineEvent {
  id: string;
  type: string;
  detail?: string | null;
  at?: string | null;
  to?: string | null;
  from?: string | null;
}

function iconFor(type: string) {
  const t = type.toLowerCase();
  if (t.includes("draft")) return FileText;
  if (t.includes("approved")) return CheckCircle2;
  if (t.includes("submitted") || t.includes("applied")) return Send;
  if (t.includes("fail")) return AlertTriangle;
  if (t.includes("retry")) return RotateCcw;
  if (t.includes("browser")) return Bot;
  if (t.includes("email")) return Mail;
  if (t.includes("reply")) return Reply;
  if (t.includes("rejected") || t.includes("withdraw")) return XCircle;
  if (t.includes("opened_for_manual")) return Eye;
  if (t.includes("queued")) return Clock;
  if (t.includes("confirmed")) return CheckCircle2;
  return CircleDot;
}

function toneFor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("fail") || t.includes("reject") || t.includes("withdraw")) return "bg-destructive text-destructive-foreground";
  if (t.includes("reply") || t.includes("submitted") || t.includes("applied") || t.includes("approved") || t.includes("confirmed")) return "bg-emerald-500 text-white";
  if (t.includes("browser") || t.includes("queued") || t.includes("retry")) return "bg-sky-500 text-white";
  if (t.includes("draft")) return "bg-slate-500 text-white";
  return "bg-primary text-primary-foreground";
}

function relativeTime(at: string | null | undefined): string {
  if (!at) return "";
  const ms = Date.now() - new Date(at).getTime();
  if (ms < 0) return new Date(at).toLocaleString();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(at).toLocaleDateString();
}

function labelFor(type: string): string {
  return type.replace(/^application\./, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  if (events.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No events yet.</p>;
  }
  return (
    <ol className={cn("relative space-y-5 border-l-2 border-border/60 pl-6", className)}>
      {events.map((event, index) => {
        const Icon = iconFor(event.type);
        const tone = toneFor(event.type);
        return (
          <li key={event.id} className="relative">
            <span
              aria-hidden
              className={cn(
                "absolute -left-[33px] top-0.5 grid h-6 w-6 place-items-center rounded-full ring-4 ring-background",
                tone,
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold">{labelFor(event.type)}</span>
              {event.to ? (
                <span className="text-xs font-medium text-muted-foreground">
                  → {event.from ? `${event.from} → ` : ""}{event.to}
                </span>
              ) : null}
              <span className="ml-auto text-[11px] text-muted-foreground">{relativeTime(event.at)}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">{event.at ? new Date(event.at).toLocaleString() : ""}</div>
            {event.detail ? <p className="mt-1 text-sm text-muted-foreground break-words leading-relaxed">{event.detail}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}