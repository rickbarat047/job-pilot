"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("jp_install_dismissed") === "1") setDismissed(true);
    } catch { /* ignore */ }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDeferred(null);
  };
  const dismiss = () => {
    try { localStorage.setItem("jp_install_dismissed", "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-[140] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Install JobPilot for quick access and offline use.</p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
          <Button size="sm" onClick={install}>Install</Button>
        </div>
      </div>
    </div>
  );
}