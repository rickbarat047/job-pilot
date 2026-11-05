"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarCheck, Send, Sparkles, ArrowUpRight, ArrowDownRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/empty-state";
import { RunDiscoveryButton } from "@/components/run-discovery-button";

interface DashboardData {
  stats: {
    discovered: number;
    matched: number;
    shortlisted: number;
    applied: number;
    pending: number;
    interviews: number;
    newThisWeek: number;
    totalApplications: number;
    responseRate: number;
  };
  funnel: { label: string; value: number }[];
  weekly: { week: number; count: number; label: string }[];
  pipeline: { state: string; c: number }[];
  topMatches: any[];
  activity: any[];
  followUps: any[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [userRes, dashRes] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/dashboard", { credentials: "include" }),
        ]);
        if (!userRes.ok) { router.push("/login"); return; }
        const userData = await userRes.json();
        const dashData = await dashRes.json();
        setUser(userData.user);
        setData(dashData);
      } catch {
        setError("Unable to load dashboard.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-3xl bg-muted" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !data || !user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground">{error || "Unable to load dashboard."}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const firstName = user.name?.trim().split(/\s+/)[0] || "there";
  const stats: {
    label: string;
    value: number;
    hint: string;
    icon: typeof Briefcase;
    tone: string;
    trendUp?: boolean;
    secondaryMetric?: string;
  }[] = [
    { label: "Jobs discovered", value: data.stats.discovered, hint: `${data.stats.newThisWeek > 0 ? data.stats.newThisWeek + " new this week" : "No new matches"}`, icon: Briefcase, tone: "bg-primary/10 text-primary", trendUp: data.stats.newThisWeek > 3, secondaryMetric: data.stats.applied > 0 ? `Applications started: ${data.stats.applied}` : undefined },
    { label: "Strong matches", value: data.stats.matched, hint: `Of ${data.stats.discovered} discovered`, icon: Sparkles, tone: "bg-accent/40 text-foreground", trendUp: data.stats.matched > 0, secondaryMetric: `Pending approvals: ${data.stats.pending}` },
    { label: "Applications", value: data.stats.applied, hint: data.stats.pending > 0 ? `${data.stats.pending} awaiting your approval` : "Nothing waiting on you", icon: Send, tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300", trendUp: data.stats.applied > 0, secondaryMetric: data.stats.interviews > 0 ? `${data.stats.interviews} interview${data.stats.interviews === 1 ? "" : "s"}` : "No interviews yet" },
    { label: "Interviews", value: data.stats.interviews, hint: data.stats.interviews > 0 ? "Scheduled or completed" : "None yet — submitted applications get reviewed", icon: CalendarCheck, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300", trendUp: data.stats.interviews > 0, secondaryMetric: data.stats.interviews > 0 ? `Response rate: ${data.stats.responseRate}%` : undefined },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.09] via-card to-accent/25 px-5 py-6 shadow-sm sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Your AI career agent
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-4xl">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {data.stats.matched > 0
                ? `${data.stats.matched} strong matches are ready for review. Approve the ones you like and JobPilot will prepare the rest.`
                : "Run discovery to find roles that match your CV, location and salary expectations."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href="/jobs" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted sm:h-10">
              Browse jobs
              {data.stats.newThisWeek > 0 ? (
                <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {data.stats.newThisWeek > 99 ? "99+" : data.stats.newThisWeek}
                </span>
              ) : null}
            </Link>
            <RunDiscoveryButton />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="relative overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <span className={`absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-2xl sm:right-5 sm:top-5 sm:h-10 sm:w-10 ${item.tone}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <div className="pr-11 text-xs text-muted-foreground sm:pr-12 sm:text-sm">{item.label}</div>
                <div className="mt-1.5 flex items-baseline gap-2 font-display text-2xl font-semibold tabular-nums sm:mt-2 sm:text-3xl">
                  {item.value}
                  {item.trendUp !== undefined && item.value > 0 && (
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${item.trendUp ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                      {item.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {item.trendUp ? "Up" : "Down"}
                    </span>
                  )}
                </div>
                {item.secondaryMetric ? (
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground/70">{item.secondaryMetric}</p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">{item.hint}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <CardTitle>Top matches</CardTitle>
              <p className="mt-1 break-words text-sm text-muted-foreground">Explainable scores based on skills, education, experience and preferences.</p>
            </div>
            <Link href="/jobs" className="inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-2 py-2 -mr-2 text-sm font-medium text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topMatches.length === 0 ? <EmptyState title="No matched jobs yet" description="Run discovery to find opportunities tailored to your profile." action={<RunDiscoveryButton />} /> : null}
            {data.topMatches.map((item: any) => (
              <Link key={item.job.id} href={`/jobs/${item.job.id}`} className="group block rounded-2xl border border-border bg-background/40 p-4 transition-all hover:border-primary/30 hover:bg-muted/40">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-semibold uppercase">
                      {item.job.companyName?.slice(0, 1) || "J"}
                    </span>
                    <div className="min-w-0">
                      <div className="break-words font-medium group-hover:text-primary">{item.job.title}</div>
                      <div className="break-words text-sm text-muted-foreground">{item.job.companyName} · {item.job.location}</div>
                    </div>
                  </div>
                  <Badge className="shrink-0" variant={item.match.overallScore >= 75 ? "success" : item.match.overallScore >= 55 ? "warning" : "secondary"}>
                    {item.match.overallScore}%
                  </Badge>
                </div>
                <Progress value={item.match.overallScore} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">{item.match.recommendedAction}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">Where every application stands right now.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.pipeline.length === 0 ? <p className="text-sm text-muted-foreground">No applications yet.</p> : null}
            {data.pipeline.map((row: any) => (
              <div key={String(row.state)} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="truncate">{String(row.state)}</span>
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
    </div>
  );
}