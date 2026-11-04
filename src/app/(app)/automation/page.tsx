"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Activity, ListChecks, PlayCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function AutomationPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/automation");
    setData(await response.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runAction(body: Record<string, unknown>, label: string) {
    setBusy(label);
    const response = await fetch("/api/automation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    setBusy("");
    if (!response.ok) {
      toast.error(result.error || "Action failed.");
      return;
    }
    if (body.action === "run") toast.success(`Processed ${result.succeeded ?? 0} task(s); ${result.failed ?? 0} failed.`);
    else if (body.action === "retry") toast.success("Task queued for retry.");
    else toast.success("Task queued.");
    load();
  }

  const worker = data?.worker as { status?: string; lastHeartbeat?: string | null; online?: boolean; meta?: Record<string, unknown> } | undefined;
  const workerState = !worker
    ? "Not connected"
    : worker.online
      ? worker.status === "busy"
        ? "Working on a task"
        : "Ready for tasks"
      : "Not running";
  const tasks = Array.isArray(data?.tasks) ? (data.tasks as any[]) : [];
  const runs = Array.isArray(data?.runs) ? (data.runs as any[]) : [];
  const logs = Array.isArray(data?.logs) ? (data.logs as any[]) : [];
  const queued = tasks.filter((task) => task.status === "queued").length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-3xl bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.08] via-card to-accent/20 px-6 py-7 shadow-sm sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1 text-xs font-medium text-primary">
              <Zap className="h-3.5 w-3.5" /> Automated workflows
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-4xl">Automation center</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              Control discovery, verification, digests, auto-apply and the browser worker from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runAction({ action: "enqueue", type: "discovery" }, "discovery")} disabled={!!busy}>{busy === "discovery" ? "Queueing…" : "Queue discovery"}</Button>
            <Button variant="outline" onClick={() => runAction({ action: "run" }, "run")} disabled={!!busy}>{busy === "run" ? "Processing…" : "Process tasks"}</Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Worker status</div>
              <Badge variant={worker?.online ? "success" : "warning"}>{worker?.online ? "Online" : "Offline"}</Badge>
            </div>
            <div className="mt-2 font-display text-2xl font-semibold">{workerState}</div>
            <div className="text-xs text-muted-foreground">
              {worker?.lastHeartbeat ? `Last heartbeat ${new Date(worker.lastHeartbeat).toLocaleString()}` : "No heartbeat yet — start the worker to run tasks."}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Queued tasks</div>
              <ListChecks className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 font-display text-2xl font-semibold">{queued}</div>
            <div className="text-xs text-muted-foreground">{tasks.length} total tracked</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Recent runs</div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 font-display text-2xl font-semibold">{runs.length}</div>
            <div className="text-xs text-muted-foreground">{runs.filter((run) => run.status === "succeeded").length} succeeded</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button variant="outline" size="sm" onClick={() => runAction({ action: "enqueue", type: "daily-digest" }, "digest")} disabled={!!busy}>Queue daily digest</Button>
        <Button variant="outline" size="sm" onClick={() => runAction({ action: "enqueue", type: "career-page-check" }, "career")} disabled={!!busy}>Queue career-page check</Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Tasks</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Every queued, running, succeeded and failed automation task.</p>
          </div>
          <Badge variant="secondary">{tasks.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading tasks…</p> : null}
          {!loading && tasks.length === 0 ? <EmptyState title="No tasks yet" description="Queue a discovery run or process tasks to see activity here." /> : null}
          {tasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/40 p-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{String(task.type).replace(/-/g, " ")}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{task.lastError || (task.nextRunAt ? `Next run ${new Date(task.nextRunAt).toLocaleString()}` : "No schedule")}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={task.status === "succeeded" ? "success" : task.status === "failed" ? "destructive" : task.status === "manual_required" ? "warning" : "secondary"}>
                  {String(task.status).replace(/_/g, " ")}
                </Badge>
                {task.status === "failed" ? <Button size="sm" variant="outline" onClick={() => runAction({ action: "retry", taskId: task.id }, "retry")}>Retry</Button> : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation runs</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Recent discovery and processing runs with their results.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {runs.length === 0 ? <p className="text-sm text-muted-foreground">No runs yet.</p> : null}
          {runs.map((run) => (
            <div key={run.id} className="rounded-2xl border border-border bg-background/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{run.trigger} run</span>
                <Badge variant={run.status === "succeeded" ? "success" : "destructive"}>{run.status}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"} · {run.finishedAt ? `finished ${new Date(run.finishedAt).toLocaleString()}` : "running"}
              </div>
              {run.summary && Object.keys(run.summary).length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(run.summary).map(([key, value]) => (
                    <Badge key={key} variant="secondary">{key}: {String(value)}</Badge>
                  ))}
                </div>
              ) : null}
              {run.error ? <p className="mt-2 text-xs text-destructive">{run.error}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation logs</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Latest worker and scheduler messages.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? <p className="text-sm text-muted-foreground">No logs yet.</p> : null}
          {logs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-border bg-background/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{log.level}</span>
                <span className="text-xs text-muted-foreground">{log.at ? new Date(log.at).toLocaleString() : ""}</span>
              </div>
              <div className="mt-1 text-muted-foreground">{log.message}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
