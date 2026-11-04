import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataCard } from "@/components/ui/data-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Timeline } from "@/components/ui/timeline";
import { ApplicationActions } from "@/components/application-actions";
import { cn } from "@/lib/utils";

const STATE_TONE: Record<string, "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "accent" | "muted" | "info" | "violet" | "slate"> = {
  "Draft Ready": "slate",
  "Awaiting Approval": "warning",
  Approved: "success",
  Applying: "info",
  Applied: "default",
  Interview: "violet",
  Assessment: "violet",
  Offer: "success",
  Rejected: "destructive",
  Withdrawn: "muted",
  "Application Failed": "destructive",
};

function documentLabel(kind: string) {
  if (kind === "cover_letter") return "Cover letter";
  if (kind === "resume") return "Resume";
  return kind.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  getDb();
  const { id } = await params;
  const data = await getApplicationDetail(user.id, id);
  if (!data) redirect("/applications");

  const events = data.events.map((event) => ({
    id: event.id,
    type: event.type,
    detail: event.detail,
    at: event.createdAt,
    to: event.to,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/applications" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            ← Back to applications
          </Link>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{data.job.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.job.company} · {data.job.location}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge tone={STATE_TONE[data.application.state] ?? "secondary"}>{data.application.state}</StatusBadge>
            {data.application.matchScore !== null ? <StatusBadge tone="secondary">Match {data.application.matchScore}%</StatusBadge> : null}
            <StatusBadge tone="outline">{data.job.method}</StatusBadge>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="order-2 space-y-5 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle>Job description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{data.job.description}</div>
              <a href={data.job.applicationUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}>
                Open official application page
              </a>
            </CardContent>
          </Card>
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          <DataCard title="Actions" description="Everything stays under your approval.">
            <ApplicationActions id={data.application.id} state={data.application.state} method={data.job.method} />
          </DataCard>

          <Card>
            <CardHeader><CardTitle>Generated materials</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.documents.map((doc) => (
                <a key={doc.id} href={`/api/documents/${doc.path}`} target="_blank" rel="noreferrer" className="block rounded-xl border border-border p-3 text-sm transition-colors hover:bg-muted/40">
                  <span className="font-medium">{documentLabel(doc.kind)}</span>
                  <span className="mt-0.5 block break-all text-xs text-muted-foreground">{doc.filename}</span>
                </a>
              ))}
              {data.resume ? (
                <div className="rounded-xl border border-border p-3 text-sm">
                  <div className="font-medium">Resume customization</div>
                  <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                    {data.resume.notes.map((note, index) => <li key={index}>{note}</li>)}
                  </ul>
                </div>
              ) : null}
              {data.documents.length === 0 && !data.resume ? (
                <p className="text-sm text-muted-foreground">No generated materials yet.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Application questions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.questions.length === 0 ? <p className="text-sm text-muted-foreground">No questions generated.</p> : null}
              {data.questions.map((question) => (
                <div key={question.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="font-medium">{question.question}</div>
                  {question.answer ? <p className="mt-1 text-muted-foreground">{question.answer}</p> : <p className="mt-1 text-amber-700 dark:text-amber-400">Needs your input.</p>}
                  {question.sensitive ? <StatusBadge tone="warning" className="mt-2">Sensitive — approval required</StatusBadge> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          {data.automation ? (
            <Card>
              <CardHeader><CardTitle>Browser automation</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    tone={data.automation.status === "succeeded" ? "success" : data.automation.status === "failed" ? "destructive" : data.automation.status === "manual_required" ? "warning" : "secondary"}
                  >
                    {data.automation.status.replace(/_/g, " ")}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">Attempt {data.automation.attempts} of {data.automation.maxAttempts}</span>
                </div>
                {data.automation.lastError ? <p className="break-words text-muted-foreground">{data.automation.lastError}</p> : null}
                {data.automation.status === "manual_required" ? (
                  <p className="text-muted-foreground">The worker stopped safely. Open the official application page, finish the remaining questions, then confirm below.</p>
                ) : null}
                {data.automation.status === "queued" ? <p className="text-muted-foreground">Queued for the next worker poll.</p> : null}
                {data.automation.status === "running" ? <p className="text-muted-foreground">The worker is filling the form now.</p> : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <Timeline events={events} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
