"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log to console in dev; Sentry captures automatically in prod.
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">{error.message || "An unexpected error occurred. Please try again."}</p>
        <Button onClick={reset}>Try again</Button>
      </body>
    </html>
  );
}