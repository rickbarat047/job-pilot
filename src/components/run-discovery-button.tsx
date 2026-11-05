"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";

export function RunDiscoveryButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    const res = await fetch("/api/discovery/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    const data = await res.json().catch(() => ({}));
    analytics.discoveryRun(data?.discovery?.fetched ?? 0);
    setLoading(false);
    router.refresh();
  }
  return <Button onClick={run} disabled={loading}>{loading ? "Running…" : "Run discovery"}</Button>;
}
