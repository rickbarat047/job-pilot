import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getJobDetailForUser } from "@/lib/repositories";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { TailorButton } from "@/components/tailor-button";
import { ShortlistButton } from "@/components/shortlist-button";
import { cn } from "@/lib/utils";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  getDb();
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const data = await getJobDetailForUser(user.id, id);
  if (!data) redirect("/jobs");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <Link href="/jobs" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Back to jobs
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{data.job.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.job.companyName} · {data.job.location} · {data.job.employmentType}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{data.job.source}</Badge>
              <Badge variant="outline">{data.job.remoteStatus}</Badge>
              {data.job.salaryText ? <Badge variant="outline">{data.job.salaryText}</Badge> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right sm:px-5">
            <div className="font-display text-3xl font-semibold sm:text-4xl">{data.match.overallScore}%</div>
            <div className="text-xs text-muted-foreground sm:text-sm">{data.match.recommendedAction}</div>
          </div>
        </div>
      </div>

      <Progress value={data.match.overallScore} />

      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="order-2 space-y-5 lg:order-1">
          <Card>
            <CardHeader><CardTitle>Job description</CardTitle></CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                {data.job.description}
              </div>
              <a href={data.job.applicationUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}>
                Open official application page
              </a>
            </CardContent>
          </Card>
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader><CardTitle>Match explanation</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="leading-relaxed">{data.match.explanation}</p>
              {data.match.strengths.length ? (
                <div>
                  <div className="font-medium">Strengths</div>
                  <p className="text-muted-foreground">{data.match.strengths.join(", ")}</p>
                </div>
              ) : null}
              {data.match.gaps.length ? (
                <div>
                  <div className="font-medium">Gaps</div>
                  <p className="text-muted-foreground">{data.match.gaps.join(", ")}</p>
                </div>
              ) : null}
              {data.match.missingRequirements.length ? (
                <div>
                  <div className="font-medium">Missing requirements</div>
                  <p className="text-muted-foreground">{data.match.missingRequirements.join("; ")}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Resume fit (ATS)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="font-display text-2xl font-semibold tabular-nums">{Math.round(data.match.skillScore)}%</div>
                <div className="text-xs text-muted-foreground">keyword overlap between your CV and this JD</div>
              </div>
              <Progress value={data.match.skillScore} />
              {data.match.strengths.length ? (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Matched keywords</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {data.match.strengths.map((s: string) => (
                      <span key={s} className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">{s}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {data.match.missingRequirements.length ? (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Add to your resume</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {data.match.missingRequirements.map((s: string) => (
                      <span key={s} className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">{s}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.applicationId ? (
                <Link href={`/applications/${data.applicationId}`} className={cn(buttonVariants({ size: "default" }), "w-full bg-primary text-primary-foreground")}>
                  View application
                </Link>
              ) : (
                <TailorButton jobId={data.job.id} />
              )}
              <ShortlistButton jobId={data.job.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
