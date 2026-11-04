"use client";
import * as React from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title = "Please confirm",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="alertdialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border-t border-border bg-card p-4 pb-safe shadow-2xl sm:rounded-2xl sm:border sm:border-border sm:p-6">
        <div className="flex items-start gap-3">
          <span className={cn("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl", destructive ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold">{title}</div>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="outline" className="min-h-11" onClick={() => { onOpenChange(false); onCancel?.(); }}>
            {cancelLabel}
          </Button>
          <Button className={cn(destructive && "bg-destructive text-destructive-foreground")} onClick={() => { onOpenChange(false); onConfirm(); }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
