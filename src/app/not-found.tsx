import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-display text-4xl font-semibold">404</h1>
      <p className="text-muted-foreground">This page could not be found.</p>
      <Link href="/dashboard" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Go to dashboard</Link>
    </div>
  );
}
