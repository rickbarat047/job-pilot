import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap sm:px-2.5 sm:py-0.5 sm:text-xs",
  {
    variants: {
      tone: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border text-foreground",
        success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        destructive: "bg-destructive/10 text-destructive",
        accent: "bg-accent text-accent-foreground",
        muted: "bg-muted text-muted-foreground",
        info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
        violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
        slate: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
      },
    },
    defaultVariants: { tone: "secondary" },
  },
);

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: NonNullable<VariantProps<typeof statusVariants>["tone"]>;
}

export function StatusBadge({ tone, className, ...props }: StatusBadgeProps) {
  return <span className={cn(statusVariants({ tone }), className)} {...props} />;
}
