"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RunDiscoveryButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    await fetch("/api/discovery/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    setLoading(false);
    router.refresh();
  }
  return <Button onClick={run} disabled={loading}>{loading ? "Running…" : "Run discovery"}</Button>;
}
