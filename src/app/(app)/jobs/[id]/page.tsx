import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getJobDetailForUser } from "@/lib/repositories";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { TailorButton } from "@/components/tailor-button";
import { ShortlistButton } from "@/components/shortlist-button";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  getDb();
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const data = await getJobDetailForUser(user.id, id);
  if (!data) redirect("/jobs");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{data.job.title}</h1>
          <p className="text-muted-foreground">{data.job.companyName} · {data.job.location} · {data.job.employmentType}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{data.job.source}</Badge>
            <Badge variant="outline">{data.job.remoteStatus}</Badge>
            {data.job.salaryText ? <Badge variant="outline">{data.job.salaryText}</Badge> : null}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-4xl font-semibold">{data.match.overallScore}%</div>
          <div className="text-sm text-muted-foreground">{data.match.recommendedAction}</div>
        </div>
      </div>

      <Progress value={data.match.overallScore} />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle>Job description</CardTitle></CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-sm text-foreground/90">{data.job.description}</div>
            <div className="mt-4 text-sm">
              <a href={data.job.applicationUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Open official application page</a>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Match explanation</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{data.match.explanation}</p>
              {data.match.strengths.length ? <div><div className="font-medium">Strengths</div><p className="text-muted-foreground">{data.match.strengths.join(", ")}</p></div> : null}
              {data.match.gaps.length ? <div><div className="font-medium">Gaps</div><p className="text-muted-foreground">{data.match.gaps.join(", ")}</p></div> : null}
              {data.match.missingRequirements.length ? <div><div className="font-medium">Missing requirements</div><p className="text-muted-foreground">{data.match.missingRequirements.join("; ")}</p></div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.applicationId ? (
                <Link href={`/applications/${data.applicationId}`} className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">View application</Link>
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
