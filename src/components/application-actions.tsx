"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ApplicationActions({ id, state, method }: { id: string; state: string; method: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [workerOnline, setWorkerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/automation/worker", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (active) setWorkerOnline(Boolean(data.online)); })
      .catch(() => { if (active) setWorkerOnline(false); });
    return () => { active = false; };
  }, []);

  async function run(name: string, body?: Record<string, unknown>, key = name) {
    setLoading(key);
    setMessage("");
    const response = await fetch(`/api/applications/${id}/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await response.json().catch(() => ({}));
    setLoading("");
    if (!response.ok) {
      setMessage(data.error || "Action failed.");
      toast.error(data.error || "Action failed.");
      return;
    }
    if (data.requiresManual && data.applicationUrl) {
      window.open(data.applicationUrl, "_blank", "noopener,noreferrer");
      setMessage("Opened the official application page. Complete it there, then click “I applied manually”.");
      toast.info("Official application page opened.");
    } else if (typeof data.repliesFound === "number") {
      const found = Number(data.repliesFound);
      const already = Number(data.alreadyRecorded || 0);
      const text = found > 0
        ? `${found} new ${found === 1 ? "reply" : "replies"} recorded.`
        : already > 0
          ? `No new replies. ${already} previously recorded reply${already === 1 ? " is" : "ies are"} already in the timeline.`
          : "No matching replies found in the last 14 days.";
      setMessage(text);
      if (found > 0) toast.success(text); else toast.info(text);
    } else if (data.state) {
      setMessage(data.method === "browser" ? "Browser automation queued. This page refreshes automatically in a moment." : `Status updated to ${data.state}.`);
      toast.success(data.method === "browser" ? "Browser automation queued." : `Status updated to ${data.state}.`);
      if (data.method === "browser") window.setTimeout(() => router.refresh(), 2500);
    }
    router.refresh();
  }

  const canConfirm = state === "Approved" || state === "Applying";
  const browserUnavailable = workerOnline === false;

  return (
    <div className="space-y-2">
      {(state === "Draft Ready" || state === "Awaiting Approval") && (
        <Button className="w-full" onClick={() => run("approve")} disabled={!!loading}>Approve application</Button>
      )}

      {state === "Approved" && (
        <>
          {method === "email" ? (
            <Button className="w-full" onClick={() => run("submit")} disabled={!!loading}>
              {loading === "submit" ? "Sending…" : "Send application email"}
            </Button>
          ) : method === "browser" ? (
            <Button className="w-full" onClick={() => run("submit", { method: "browser" })} disabled={!!loading || browserUnavailable}>
              {loading === "submit" ? "Starting…" : "Start browser automation"}
            </Button>
          ) : (
            <Button className="w-full" onClick={() => run("submit")} disabled={!!loading}>
              {loading === "submit" ? "Opening…" : "Open official application"}
            </Button>
          )}

          {method !== "browser" && method !== "email" ? (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => run("submit", { method: "browser" }, "submit-browser")}
              disabled={!!loading || browserUnavailable}
            >
              {loading === "submit-browser" ? "Starting…" : "Use browser automation"}
            </Button>
          ) : null}

          {browserUnavailable ? (
            <p className="text-xs text-muted-foreground">Browser worker is offline. Use the official page or start the worker from Settings.</p>
          ) : null}
        </>
      )}

      {state === "Applying" && (
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <div className="font-medium">Browser automation is working</div>
          <p className="mt-1 text-xs text-muted-foreground">This page refreshes automatically. If you complete the form yourself, confirm it below.</p>
        </div>
      )}

      {canConfirm && (
        <Button className="w-full" variant="outline" onClick={() => run("confirm-applied", { note: "Manual submission confirmed" })} disabled={!!loading}>
          I applied manually
        </Button>
      )}

      {state === "Applying" && (
        <Button className="w-full" variant="ghost" onClick={() => router.refresh()} disabled={!!loading}>Refresh status</Button>
      )}

      {(state === "Applied" || state === "Interview" || state === "Assessment") && (
        <>
          <Button className="w-full" variant="outline" onClick={() => run("mark-replied", { note: "Reply received from employer" })} disabled={!!loading}>
            {loading === "mark-replied" ? "Recording…" : "Mark replied"}
          </Button>
          <Button className="w-full" variant="ghost" onClick={() => run("check-replies")} disabled={!!loading}>
            {loading === "check-replies" ? "Checking…" : "Check for email replies"}
          </Button>
        </>
      )}
      {state === "Application Failed" && <Button className="w-full" variant="outline" onClick={() => run("retry")} disabled={!!loading}>Retry application</Button>}
      {!["Rejected", "Withdrawn", "Offer"].includes(state) && <Button className="w-full" variant="ghost" onClick={() => run("withdraw")} disabled={!!loading}>Withdraw</Button>}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
