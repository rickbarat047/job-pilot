"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/form-controls";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/empty-state";

interface JobItem {
  job: { id: string; title: string; companyName: string; location: string; remoteStatus: string; employmentType: string; salaryText?: string | null; source: string };
  match: { overallScore: number; recommendedAction: string; strengths: string[] };
  savedState: string | null;
  applicationId: string | null;
  applicationState: string | null;
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

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (source) params.set("source", source);
    if (remote) params.set("remote", remote);
    if (sort) params.set("sort", sort);
    if (minScore) params.set("minScore", minScore);
    params.set("limit", "60");
    const response = await fetch(`/api/jobs?${params.toString()}`);
    const data = await response.json();
    setJobs(data.items ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleSave(jobId: string, state: "saved" | "shortlisted" | null) {
    await fetch(`/api/jobs/${jobId}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state }) });
    load();
  }

  async function runDiscovery() {
    setLoading(true);
    await fetch("/api/discovery/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Job discovery</h1>
          <p className="text-muted-foreground">{total} roles matched to your profile.</p>
        </div>
        <Button onClick={runDiscovery} disabled={loading}>{loading ? "Working…" : "Run discovery"}</Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <Input placeholder="Search title, company, skill…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Input placeholder="Source" value={source} onChange={(e) => setSource(e.target.value)} />
          <Select value={remote} onChange={(e) => setRemote(e.target.value)}>
            <option value="">Any work mode</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="match">Sort by match</option>
            <option value="newest">Sort by newest</option>
            <option value="salary">Sort by salary</option>
          </Select>
          <div className="flex gap-2">
            <Input placeholder="Min score" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
            <Button onClick={load}>Filter</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-5 w-2/3 rounded bg-muted" />
                <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
                <div className="mt-4 h-2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {!loading && jobs.length === 0 ? (
        <EmptyState title="No jobs found yet" description="Run discovery or adjust your filters to find opportunities." action={<Button onClick={runDiscovery}>Run discovery</Button>} />
      ) : null}

      <div className="grid gap-4">
        {jobs.map((item) => (
          <Card key={item.job.id}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-semibold uppercase">
                    {item.job.companyName?.slice(0, 1) || "J"}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/jobs/${item.job.id}`} className="break-words font-display text-lg font-semibold hover:text-primary">{item.job.title}</Link>
                    <div className="break-words text-sm text-muted-foreground">{item.job.companyName} · {item.job.location} · {item.job.employmentType}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{item.job.source}</Badge>
                    <Badge variant="outline">{item.job.remoteStatus}</Badge>
                    {item.job.salaryText ? <Badge variant="outline">{item.job.salaryText}</Badge> : null}
                    {item.savedState === "shortlisted" ? <Badge variant="accent">Shortlisted</Badge> : null}
                    {item.applicationState ? <Badge variant="success">{item.applicationState}</Badge> : null}
                  </div>
                </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-semibold">{item.match.overallScore}%</div>
                  <div className="text-xs text-muted-foreground">{item.match.recommendedAction}</div>
                </div>
              </div>
              <Progress value={item.match.overallScore} className="mt-4" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/jobs/${item.job.id}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-transparent px-3 text-xs font-medium hover:bg-muted">View</Link>
                <Button size="sm" variant="secondary" onClick={() => toggleSave(item.job.id, item.savedState === "shortlisted" ? "saved" : "shortlisted")}>
                  {item.savedState === "shortlisted" ? "Saved" : "Shortlist"}
                </Button>
                {item.applicationId ? <Link href={`/applications/${item.applicationId}`} className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium hover:bg-muted">Application</Link> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


