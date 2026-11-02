import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDashboard } from "@/lib/repositories";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { Briefcase, CalendarCheck, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/empty-state";
import { RunDiscoveryButton } from "@/components/run-discovery-button";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  getDb();
  const data = await getDashboard(user.id);
  const firstName = user.name?.trim().split(/\s+/)[0] || "there";

  const stats = [
    {
      label: "Jobs discovered",
      value: data.stats.discovered,
      hint: "Across every connected source",
      icon: Briefcase,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Strong matches",
      value: data.stats.matched,
      hint: "Scored against your real profile",
      icon: Sparkles,
      tone: "bg-accent/40 text-foreground",
    },
    {
      label: "Applications",
      value: data.stats.applied,
      hint: `${data.stats.pending} awaiting your approval`,
      icon: Send,
      tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    {
      label: "Interviews",
      value: data.stats.interviews,
      hint: `${data.stats.responseRate}% response rate`,
      icon: CalendarCheck,
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.09] via-card to-accent/25 px-6 py-7 shadow-sm sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Your AI career agent
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {data.stats.matched > 0
                ? `${data.stats.matched} strong matches are ready for review. Approve the ones you like and JobPilot will prepare the rest.`
                : "Run discovery to find roles that match your CV, location and salary expectations."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/jobs"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              Browse jobs
            </Link>
            <RunDiscoveryButton />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">{item.label}</div>
                    <div className="mt-2 font-display text-3xl font-semibold tabular-nums">{item.value}</div>
                  </div>
                  <span className={`grid h-10 w-10 place-items-center rounded-2xl ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{item.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Application funnel</CardTitle>
            <p className="text-sm text-muted-foreground">From discovery to interview, based on your real activity.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.funnel?.map((step: { label: string; value: number }) => {
              const max = Math.max(1, ...((data.funnel as { value: number }[]).map((item) => item.value)));
              const width = Math.max(6, Math.round((step.value / max) * 100));
              return (
                <div key={step.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{step.label}</span>
                    <span className="tabular-nums text-muted-foreground">{step.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Applications per week</CardTitle>
            <p className="text-sm text-muted-foreground">Last 8 weeks of submitted and drafted applications.</p>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2">
              {data.weekly?.map((bucket: { label: string; count: number }, index: number) => {
                const max = Math.max(1, ...((data.weekly as { count: number }[]).map((item) => item.count)));
                const height = Math.max(4, Math.round((bucket.count / max) * 100));
                return (
                  <div key={index} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div className="w-full rounded-t-md bg-primary/80 transition-all" style={{ height: `${height}%` }} title={`${bucket.count}`} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{bucket.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Top matches</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Explainable scores based on skills, education, experience and preferences.</p>
            </div>
            <Link href="/jobs" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topMatches.length === 0 ? <EmptyState title="No matched jobs yet" description="Run discovery to find opportunities tailored to your profile." action={<RunDiscoveryButton />} /> : null}
            {data.topMatches.map((item) => (
              <Link
                key={item.job.id}
                href={`/jobs/${item.job.id}`}
                className="group block rounded-2xl border border-border bg-background/40 p-4 transition-all hover:border-primary/30 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-semibold uppercase">
                      {item.job.companyName?.slice(0, 1) || "J"}
                    </span>
                    <div className="min-w-0">
                      <div className="break-words font-medium group-hover:text-primary">{item.job.title}</div>
                      <div className="break-words text-sm text-muted-foreground">{item.job.companyName} · {item.job.location}</div>
                    </div>
                  </div>
                  <Badge variant={item.match.overallScore >= 75 ? "success" : item.match.overallScore >= 55 ? "warning" : "secondary"}>
                    {item.match.overallScore}%
                  </Badge>
                </div>
                <Progress value={item.match.overallScore} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">{item.match.recommendedAction}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">Where every application stands right now.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.pipeline.length === 0 ? <p className="text-sm text-muted-foreground">No applications yet.</p> : null}
            {data.pipeline.map((row) => (
              <div key={String(row.state)} className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {String(row.state)}
                </span>
                <Badge variant="secondary">{Number(row.c)}</Badge>
              </div>
            ))}
            <div className="pt-2 text-sm text-muted-foreground">
              Pending approvals: {data.stats.pending} · Response rate: {data.stats.responseRate}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.activity.length === 0 ? <p className="text-sm text-muted-foreground">No recent activity.</p> : null}
            {data.activity.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.body}</div>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(item.at).toLocaleString()}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Follow-ups due</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.followUps.length === 0 ? <p className="text-sm text-muted-foreground">No follow-ups due.</p> : null}
            {data.followUps.map((item) => (
              <Link key={item.id} href={`/applications/${item.id}`} className="block rounded-xl border border-border bg-background/40 p-3 transition-colors hover:bg-muted/40">
                <div className="font-medium">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.company} · applied {item.daysAgo} days ago</div>
              </Link>
            ))}
            <Link href="/applications" className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-transparent px-3 text-xs font-medium hover:bg-muted">Open applications</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
