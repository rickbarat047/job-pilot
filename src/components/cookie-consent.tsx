"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "jp_cookie_consent_v1";

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [decided, setDecided] = useState(false);
  const [consent, setConsent] = useState<boolean | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    const ok = stored === "1";
    setConsent(ok);
    setDecided(true);
  }, []);

  if (!mounted || decided === false) return null;
  if (consent !== null) return null;

  const decide = (value: boolean) => {
    try { localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch { /* ignore */ }
    setConsent(value);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[150] border-t border-border bg-background/95 backdrop-blur-xl" role="region" aria-label="Cookie consent">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground">
          We use cookies to run JobPilot and remember your preferences. See our{" "}
          <Link href="/privacy" className="underline hover:text-foreground">privacy policy</Link>.
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => decide(true)} className="h-9 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground">Accept</button>
          <button type="button" onClick={() => decide(false)} className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground">Reject</button>
        </div>
      </div>
    </div>
  );
}
