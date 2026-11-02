"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ShortlistButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    await fetch(`/api/jobs/${jobId}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: "shortlisted" }) });
    setLoading(false);
    router.refresh();
  }
  return <Button variant="outline" className="w-full" onClick={run} disabled={loading}>{loading ? "Saving…" : "Shortlist"}</Button>;
}
