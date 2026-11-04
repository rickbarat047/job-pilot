"use client";
import * as React from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  side?: "left" | "right";
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const panelClass =
    side === "right" ? "right-0 top-0 h-full w-full max-w-sm" : "left-0 top-0 h-full w-80 max-w-[85vw]";

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn("fixed z-50 flex h-full flex-col bg-card shadow-2xl", panelClass)} data-side={side}>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1 pr-2 font-display text-lg font-semibold">{title}</div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-safe">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
