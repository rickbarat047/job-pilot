"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/empty-state";
import { JobCard } from "@/components/ui/job-card";
import { cn } from "@/lib/utils";

interface JobItem {
  job: { id: string; title: string; companyName: string; location: string; remoteStatus: string; employmentType: string; salaryText?: string | null; source: string };
  match: { overallScore: number; recommendedAction: string; strengths: string[] };
  savedState: string | null;
  applicationId: string | null;
  applicationState: string | null;
}

interface FilterOverrides {
  query?: string;
  source?: string;
  remote?: string;
  sort?: string;
  minScore?: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [remote, setRemote] = useState("");
  const [sort, setSort] = useState("match");
  const [minScore, setMinScore] = useState("");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  async function load(overrides: FilterOverrides = {}) {
    setLoading(true);
    const params = new URLSearchParams();
    const nextQuery = overrides.query ?? query;
    const nextSource = overrides.source ?? source;
    const nextRemote = overrides.remote ?? remote;
    const nextSort = overrides.sort ?? sort;
    const nextMinScore = overrides.minScore ?? minScore;
    if (nextQuery) params.set("query", nextQuery);
    if (nextSource) params.set("source", nextSource);
    if (nextRemote) params.set("remote", nextRemote);
    if (nextSort) params.set("sort", nextSort);
    if (nextMinScore) params.set("minScore", nextMinScore);
    params.set("limit", "60");
    try {
      const response = await fetch(`/api/jobs?${params.toString()}`);
      const data = await response.json();
      setJobs(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get("query") ?? "";
    if (initialQuery) {
      setQuery(initialQuery);
      void load({ query: initialQuery });
    } else {
      void load();
    }
    // Intentionally run once: subsequent loads are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleSave(jobId: string, state: "saved" | "shortlisted" | null) {
    await fetch(`/api/jobs/${jobId}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state }) });
    load();
  }

  async function runDiscovery() {
    setLoading(true);
    await fetch("/api/discovery/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    await load();
  }

  function clearFilters() {
    setSource("");
    setRemote("");
    setMinScore("");
    setSort("match");
    void load({ source: "", remote: "", minScore: "", sort: "match" });
  }

  const filterCount = [source, remote, minScore, sort !== "match" ? sort : ""].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Job discovery</h1>
          <p className="text-sm text-muted-foreground">{total} roles matched to your profile.</p>
        </div>
        <Button onClick={runDiscovery} disabled={loading} className="w-full sm:w-auto">
          {loading ? "Working…" : "Run discovery"}
        </Button>
      </div>

      <Card className="sticky top-14 z-20 -mx-4 rounded-none border-x-0 bg-background/95 shadow-none backdrop-blur-xl md:static md:mx-0 md:rounded-2xl md:border-x md:bg-card md:shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void load();
            }}
            className="space-y-3"
          >
            <div className="flex items-stretch gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Search title, company, skill…"
                  aria-label="Search jobs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 md:hidden"
                onClick={() => setFiltersOpen((value) => !value)}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {filterCount > 0 ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {filterCount}
                  </span>
                ) : null}
              </Button>
              <Button type="submit" className="hidden shrink-0 md:inline-flex">Apply</Button>
            </div>

            <div className={cn("grid gap-2 sm:grid-cols-2", filtersOpen ? "grid" : "hidden md:grid md:grid-cols-4")}>
              <Input
                placeholder="Source (e.g. greenhouse)"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                aria-label="Filter by source"
              />
              <Select value={remote} onChange={(event) => setRemote(event.target.value)} aria-label="Work mode">
                <option value="">Any work mode</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </Select>
              <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort jobs">
                <option value="match">Sort by match</option>
                <option value="newest">Sort by newest</option>
                <option value="salary">Sort by salary</option>
              </Select>
              <Input
                placeholder="Minimum score"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={minScore}
                onChange={(event) => setMinScore(event.target.value)}
                aria-label="Minimum match score"
              />
            </div>

            {filterCount > 0 ? (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{filterCount} filter{filterCount === 1 ? "" : "s"} active</span>
                <button type="button" onClick={clearFilters} className="font-medium text-primary hover:underline">
                  Clear all
                </button>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2, 3].map((index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-4 sm:p-5">
                <div className="flex gap-3">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
                  </div>
                  <div className="h-7 w-14 rounded-full bg-muted" />
                </div>
                <div className="mt-4 h-2 rounded bg-muted" />
                <div className="mt-3 h-10 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {!loading && jobs.length === 0 ? (
        <EmptyState title="No jobs found yet" description="Run discovery or adjust your filters to find opportunities." action={<Button onClick={runDiscovery}>Run discovery</Button>} />
      ) : null}

      <div className="grid gap-3">
        <AnimatePresence>
          {expandedJobId ? (
            <motion.div
              key={`expanded-${expandedJobId}`}
              layoutId={`job-${expandedJobId}`}
              initial={{ opacity: 1 }}
              className="min-w-0 rounded-3xl border border-border bg-card p-6 shadow-lg sm:p-8"
            >
              <button onClick={() => setExpandedJobId(null)} className="mb-3 text-xs font-medium text-primary hover:underline">← Back to list</button>
              {/* Expanded content for the selected job */}
              {(() => {
                const item = jobs.find((j) => j.job.id === expandedJobId);
                if (!item) return null;
                return (
                  <div className="space-y-4">
                    <h2 className="font-display text-xl font-semibold sm:text-2xl">{item.job.title}</h2>
                    <div className="text-sm text-muted-foreground">{item.job.companyName} · {item.job.location} · {item.job.employmentType}</div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.match.overallScore}%` }} />
                    </div>
                    <p className="text-sm">{item.match.recommendedAction || "No recommendation yet."}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium">via {item.job.source}</span>
                      {item.match.overallScore >= 75 && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Strong match</span>}
                      {item.match.overallScore < 55 && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">Thin match</span>}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link href={`/jobs/${item.job.id}`} className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">View full details</Link>
                      <Button size="sm" variant="outline" onClick={() => setExpandedJobId(null)}>Back</Button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          ) : null}
          {jobs.map((item) => (
            <motion.div
              key={item.job.id}
              layoutId={`job-${item.job.id}`}
              initial={{ opacity: 1 }}
              onClick={() => setExpandedJobId(item.job.id)}
              className="cursor-pointer"
            >
              <JobCard
                job={{
                  id: item.job.id,
                  title: item.job.title,
                  companyName: item.job.companyName,
                  location: item.job.location,
                  remoteStatus: item.job.remoteStatus,
                  employmentType: item.job.employmentType,
                  salaryText: item.job.salaryText,
                  source: item.job.source,
                  description: null,
                }}
                score={item.match.overallScore}
                action={
                  <>
                    <Link href={`/jobs/${item.job.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                      View role
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(item.job.id, item.savedState === "shortlisted" ? "saved" : "shortlisted"); }}
                    >
                      {item.savedState === "shortlisted" ? "Saved" : "Shortlist"}
                    </Button>
                    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={compareIds.includes(item.job.id)}
                        onChange={() => toggleCompare(item.job.id)}
                        className="h-4 w-4 rounded border-border"
                        aria-label={`Compare ${item.job.title}`}
                      />
                      Compare
                    </label>
                    {item.applicationId ? (
                      <Link href={`/applications/${item.applicationId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                        View application
                      </Link>
                    ) : null}
                  </>
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {compareIds.length > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Compare ({compareIds.length}/3):</span>
              {compareIds.map((id) => {
                const item = jobs.find((j) => j.job.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                    {item?.job.title ?? id}
                    <button type="button" onClick={() => toggleCompare(id)} className="text-muted-foreground hover:text-foreground" aria-label="Remove">✕</button>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCompareIds([])}>Clear</Button>
              <Link href={`/jobs/compare?ids=${compareIds.join(",")}`} className={cn(buttonVariants({ size: "sm" }), "bg-primary text-primary-foreground")}>
                Compare
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
