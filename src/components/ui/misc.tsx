import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({ value = 0, className }: { value?: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("h-4 w-4 rounded border-input text-primary focus:ring-ring", className)} {...props} />;
}

export function Switch({ checked, onCheckedChange, className }: { checked?: boolean; onCheckedChange?: (value: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", checked ? "bg-primary" : "bg-muted", className)}
    >
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-background transition-transform", checked ? "translate-x-5" : "translate-x-1")} />
    </button>
  );
}
