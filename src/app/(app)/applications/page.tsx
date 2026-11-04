"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/empty-state";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { cn } from "@/lib/utils";

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

function stateDot(state: string) {
  return STATE_TONE[state]?.split(" ")[0] ?? "bg-muted";
}

export default function ApplicationsPage() {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedStage, setSelectedStage] = useState("All");
  const [withdrawId, setWithdrawId] = useState("");

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
      toast.error(err instanceof Error ? err.message : "Unable to load applications.");
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
      const message = data.error || "Action failed.";
      toast.error(message);
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.state) toast.success(`Status updated to ${data.state}.`);
    else if (data.repliesFound !== undefined) toast.info(`${data.repliesFound} new replies recorded.`);
    load();
  }

  const visibleColumns = showAll ? ALL_COLUMNS : ACTIVE_COLUMNS.filter((column) => items.some((item) => item.state === column));
  const columns = showAll ? ALL_COLUMNS : (visibleColumns.length ? visibleColumns : ACTIVE_COLUMNS.slice(0, 5));
  const total = items.length;
  const hasTerminal = items.some((item) => TERMINAL_COLUMNS.includes(item.state));

  const stageCounts = new Map<string, number>();
  stageCounts.set("All", items.length);
  for (const column of columns) stageCounts.set(column, items.filter((item) => item.state === column).length);
  const filteredItems = selectedStage === "All" ? items : items.filter((item) => item.state === selectedStage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Applications</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading your pipeline…" : `${total} application${total === 1 ? "" : "s"} across ${columns.length} stage${columns.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasTerminal && !showAll ? (
            <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>Show all stages</Button>
          ) : null}
          {showAll ? (
            <Button variant="outline" size="sm" onClick={() => setShowAll(false)}>Active only</Button>
          ) : null}
          <Link href="/jobs" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-primary")}>
            Find jobs
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
                <div className="mt-3 h-2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && total === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Tailor a job from the discovery page and approve it to start tracking."
          action={<Link href="/jobs" className={cn(buttonVariants({ size: "default" }), "bg-primary text-primary-foreground")}>Browse jobs</Link>}
        />
      ) : null}

      {!loading && total > 0 ? (
        <>
          {/* Mobile: stage chips + compact cards */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:hidden">
            {["All", ...columns].map((stage) => {
              const active = selectedStage === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setSelectedStage(stage)}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {stage}
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] tabular-nums", active ? "bg-primary-foreground/20" : "bg-muted")}>
                    {stageCounts.get(stage) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 md:hidden">
            {filteredItems.map((item) => (
              <ApplicationCard key={item.id} item={item} onAction={action} onWithdraw={(id) => setWithdrawId(id)} />
            ))}
          </div>

          {/* Desktop: kanban columns */}
          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
            {columns.map((column) => {
              const columnItems = items.filter((item) => item.state === column);
              return (
                <Card key={column} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", stateDot(column))} />
                        <h3 className="text-sm font-medium">{column}</h3>
                      </div>
                      <Badge variant="secondary">{columnItems.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {columnItems.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">No applications</p>
                      ) : null}
                      {columnItems.map((item) => (
                        <ApplicationCard key={item.id} item={item} onAction={action} onWithdraw={(id) => setWithdrawId(id)} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      <ConfirmationDialog
        open={Boolean(withdrawId)}
        onOpenChange={(open) => { if (!open) setWithdrawId(""); }}
        onCancel={() => setWithdrawId("")}
        onConfirm={() => { if (withdrawId) void action(withdrawId, "withdraw"); setWithdrawId(""); }}
        title="Withdraw application?"
        description="Withdrawing stops the job search pipeline for this application. This cannot be undone."
        confirmLabel="Withdraw"
        cancelLabel="Keep application"
        destructive
      />
    </div>
  );
}

function ApplicationCard({
  item,
  onAction,
  onWithdraw,
}: {
  item: ApplicationItem;
  onAction: (id: string, name: string, body?: Record<string, unknown>) => void;
  onWithdraw: (id: string) => void;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-background/40 p-3 transition-colors hover:border-primary/30">
      <Link href={`/applications/${item.id}`} className="inline-block min-h-[36px] py-2 -my-2 font-medium group-hover:text-primary">
        {item.jobTitle}
      </Link>
      <div className="mt-1 text-xs text-muted-foreground">
        {item.company} · {item.location}
      </div>
      {item.matchScore !== null ? (
        <div className="mt-2 flex items-center gap-2">
          <Progress value={item.matchScore} className="h-1.5 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">{item.matchScore}%</span>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.state === "Draft Ready" || item.state === "Awaiting Approval" ? (
          <Button size="sm" className="flex-1 sm:flex-initial" onClick={() => onAction(item.id, "approve")}>Approve</Button>
        ) : null}
        {item.state === "Approved" ? (
          <Button size="sm" className="flex-1 sm:flex-initial" onClick={() => onAction(item.id, "submit")}>Submit</Button>
        ) : null}
        {item.state === "Approved" ? (
          <Button size="sm" variant="outline" className="flex-1 sm:flex-initial" onClick={() => onAction(item.id, "confirm-applied", { note: "Manual submission confirmed" })}>
            I applied
          </Button>
        ) : null}
        {item.state === "Application Failed" ? (
          <Button size="sm" variant="outline" className="flex-1 sm:flex-initial" onClick={() => onAction(item.id, "retry")}>
            Retry
          </Button>
        ) : null}
        {!["Rejected", "Withdrawn", "Offer"].includes(item.state) ? (
          <Button size="sm" variant="ghost" onClick={() => onWithdraw(item.id)}>Withdraw</Button>
        ) : null}
      </div>
    </div>
  );
}
