"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/empty-state";

interface ApplicationItem {
  id: string;
  state: string;
  jobTitle: string;
  company: string;
  location: string;
  applicationUrl: string;
  matchScore: number | null;
  createdAt: string;
  appliedAt: string | null;
  approvalRequired: boolean;
}

const ACTIVE_COLUMNS = ["Draft Ready", "Awaiting Approval", "Approved", "Applying", "Applied", "Interview", "Assessment"];
const TERMINAL_COLUMNS = ["Offer", "Rejected", "Withdrawn", "Application Failed"];
const ALL_COLUMNS = [...ACTIVE_COLUMNS, ...TERMINAL_COLUMNS];

const STATE_TONE: Record<string, string> = {
  "Draft Ready": "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  "Awaiting Approval": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Applying: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  Applied: "bg-primary/10 text-primary",
  Interview: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Assessment: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Offer: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Rejected: "bg-destructive/10 text-destructive",
  Withdrawn: "bg-muted text-muted-foreground",
  "Application Failed": "bg-destructive/10 text-destructive",
};

export default function ApplicationsPage() {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/applications");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load applications.");
      setItems(data.applications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function action(id: string, name: string, body?: Record<string, unknown>) {
    const response = await fetch(`/api/applications/${id}/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error || "Action failed.");
      return;
    }
    load();
  }

  const visibleColumns = showAll ? ALL_COLUMNS : ACTIVE_COLUMNS.filter((column) => items.some((item) => item.state === column));
  const fallbackColumns = visibleColumns.length ? visibleColumns : ACTIVE_COLUMNS.slice(0, 5);
  const columns = showAll ? ALL_COLUMNS : (visibleColumns.length ? visibleColumns : ACTIVE_COLUMNS.slice(0, 5));

  const total = items.length;
  const hasTerminal = items.some((item) => TERMINAL_COLUMNS.includes(item.state));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Applications</h1>
          <p className="text-muted-foreground">
            {loading ? "Loading your pipeline…" : `${total} application${total === 1 ? "" : "s"} across ${columns.length} active stages.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasTerminal && !showAll ? (
            <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>Show all stages</Button>
          ) : null}
          {showAll ? (
            <Button variant="outline" size="sm" onClick={() => setShowAll(false)}>Show active stages</Button>
          ) : null}
          <Link href="/jobs" className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-medium shadow-sm hover:bg-muted">
            Find jobs
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {!loading && total === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Tailor a job from the discovery page and approve it to start tracking."
          action={<Link href="/jobs" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Browse jobs</Link>}
        />
      ) : null}

      {!loading && total > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {columns.map((column) => {
            const columnItems = items.filter((item) => item.state === column);
            return (
              <Card key={column} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${STATE_TONE[column]?.split(" ")[0] ?? "bg-muted"}`} />
                      <h3 className="font-medium">{column}</h3>
                    </div>
                    <Badge variant="secondary">{columnItems.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {columnItems.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">No applications</p>
                    ) : null}
                    {columnItems.map((item) => (
                      <div key={item.id} className="group rounded-2xl border border-border bg-background/40 p-3 transition-colors hover:border-primary/30">
                        <Link href={`/applications/${item.id}`} className="block font-medium group-hover:text-primary">{item.jobTitle}</Link>
                        <div className="mt-1 text-xs text-muted-foreground">{item.company} · {item.location}</div>
                        {item.matchScore !== null ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Progress value={item.matchScore} className="h-1.5 flex-1" />
                            <span className="text-xs tabular-nums text-muted-foreground">{item.matchScore}%</span>
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.state === "Draft Ready" || item.state === "Awaiting Approval" ? <Button size="sm" onClick={() => action(item.id, "approve")}>Approve</Button> : null}
                          {item.state === "Approved" ? <Button size="sm" onClick={() => action(item.id, "submit")}>Submit</Button> : null}
                          {item.state === "Approved" ? <Button size="sm" variant="outline" onClick={() => action(item.id, "confirm-applied", { note: "Manual submission confirmed" })}>I applied</Button> : null}
                          {item.state === "Application Failed" ? <Button size="sm" variant="outline" onClick={() => action(item.id, "retry")}>Retry</Button> : null}
                          {!["Rejected", "Withdrawn", "Offer"].includes(item.state) ? <Button size="sm" variant="ghost" onClick={() => action(item.id, "withdraw")}>Withdraw</Button> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
