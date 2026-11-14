"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function TailorButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/jobs/${jobId}/tailor`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Unable to prepare this application.");
        return;
      }
      router.push(`/applications/${data.applicationId}`);
      router.refresh();
    } catch {
      setError("Could not reach JobPilot. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      <Button className="w-full" onClick={run} disabled={loading}>{loading ? "Tailoring…" : "Tailor application"}</Button>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}


