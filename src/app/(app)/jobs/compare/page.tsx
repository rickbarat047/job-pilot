"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

interface CompareItem {
  job: { id: string; title: string; companyName: string; location: string; remoteStatus: string; employmentType: string; salaryText?: string | null; source: string; description?: string | null };
  match: { overallScore: number; skillScore: number; recommendedAction: string; strengths: string[]; gaps: string[]; missingRequirements: string[] };
  applicationId?: string | null;
}

export default function JobComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ids = (searchParams.get("ids") || "").split(",").filter(Boolean);
  const [items, setItems] = useState<CompareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ids.length < 2) { setLoading(false); setError("Select at least 2 jobs to compare."); return; }
    (async () => {
      try {
        const res = await fetch(`/api/jobs/compare?ids=${ids.join(",")}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load comparison.");
        setItems(data.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load comparison.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      </div>
    );
  }

  if (error || items.length < 2) {
    return (
      <EmptyState
        title="Nothing to compare"
        description={error || "Select 2–3 jobs from the discovery page to compare them side by side."}
        action={<Link href="/jobs" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Browse jobs</Link>}
      />
    );
  }

  const rows: { label: string; render: (item: CompareItem) => React.ReactNode }[] = [
    { label: "Match score", render: (i) => <span className="font-display text-2xl font-semibold tabular-nums">{i.match.overallScore}%</span> },
    { label: "ATS keyword fit", render: (i) => <span className="tabular-nums">{Math.round(i.match.skillScore)}%</span> },
    { label: "Company", render: (i) => i.job.companyName },
    { label: "Location", render: (i) => i.job.location },
    { label: "Work mode", render: (i) => i.job.remoteStatus },
    { label: "Employment", render: (i) => i.job.employmentType },
    { label: "Salary", render: (i) => i.job.salaryText || "—" },
    { label: "Source", render: (i) => <Badge variant="outline">{i.job.source}</Badge> },
    { label: "Recommended action", render: (i) => <span className="text-xs text-muted-foreground">{i.match.recommendedAction}</span> },
    { label: "Strengths", render: (i) => (
      <div className="flex flex-wrap gap-1">
        {i.match.strengths.length ? i.match.strengths.map((s) => <span key={s} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">{s}</span>) : <span className="text-xs text-muted-foreground">—</span>}
      </div>
    ) },
    { label: "Gaps", render: (i) => (
      <div className="flex flex-wrap gap-1">
        {i.match.gaps.length ? i.match.gaps.map((s) => <span key={s} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">{s}</span>) : <span className="text-xs text-muted-foreground">—</span>}
      </div>
    ) },
    { label: "Missing skills", render: (i) => (
      <div className="flex flex-wrap gap-1">
        {i.match.missingRequirements.length ? i.match.missingRequirements.map((s) => <span key={s} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">{s}</span>) : <span className="text-xs text-muted-foreground">—</span>}
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/jobs" className="text-xs font-medium text-muted-foreground hover:text-foreground">← Back to jobs</Link>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Compare jobs</h1>
          <p className="text-sm text-muted-foreground">{items.length} roles side by side.</p>
        </div>
        <div className="flex gap-2">
          {items.map((i) => (
            <Link key={i.job.id} href={`/jobs/${i.job.id}`} className={cn("inline-flex items-center justify-center rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted")}>
              View {i.job.companyName}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 bg-muted/40 px-4 py-3 text-left text-xs font-medium text-muted-foreground">Attribute</th>
              {items.map((i) => (
                <th key={i.job.id} className="px-4 py-3 text-left">
                  <div className="font-display font-semibold">{i.job.title}</div>
                  <div className="text-xs font-normal text-muted-foreground">{i.job.companyName}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <td className="sticky left-0 bg-card px-4 py-3 text-xs font-medium text-muted-foreground">{row.label}</td>
                {items.map((i) => (
                  <td key={i.job.id} className="px-4 py-3">{row.render(i)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <Link key={i.job.id} href={`/jobs/${i.job.id}`} className={cn(buttonVariants({ size: "sm" }), "bg-primary text-primary-foreground")}>
            Tailor {i.job.title}
          </Link>
        ))}
      </div>
    </div>
  );
}