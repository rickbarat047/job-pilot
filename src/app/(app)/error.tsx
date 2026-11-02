"use client";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
