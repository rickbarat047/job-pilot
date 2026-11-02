import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApplicationActions } from "@/components/application-actions";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  getDb();
  const { id } = await params;
  const data = await getApplicationDetail(user.id, id);
  if (!data) redirect("/applications");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{data.job.title}</h1>
          <p className="text-muted-foreground">{data.job.company} · {data.job.location}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{data.application.state}</Badge>
            {data.application.matchScore !== null ? <Badge variant="secondary">Match {data.application.matchScore}%</Badge> : null}
            <Badge variant="outline">{data.job.method}</Badge>
          </div>
        </div>
        <div className="w-full max-w-xs">
          <ApplicationActions id={data.application.id} state={data.application.state} method={data.job.method} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle>Job description</CardTitle></CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm text-foreground/90">{data.job.description}</div>
            <a href={data.job.applicationUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-primary hover:underline">Open official application page</a>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Generated materials</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.documents.map((doc) => (
                <a key={doc.id} href={`/api/documents/${doc.path}`} target="_blank" rel="noreferrer" className="block rounded-lg border border-border p-3 text-sm hover:bg-muted/40">
                  {doc.kind}: {doc.filename}
                </a>
              ))}
              {data.resume ? (
                <div className="rounded-lg border border-border p-3 text-sm">
                  <div className="font-medium">Resume customization</div>
                  <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                    {data.resume.notes.map((note, index) => <li key={index}>{note}</li>)}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Application questions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.questions.length === 0 ? <p className="text-sm text-muted-foreground">No questions generated.</p> : null}
              {data.questions.map((question) => (
                <div key={question.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="font-medium">{question.question}</div>
                  {question.answer ? <p className="mt-1 text-muted-foreground">{question.answer}</p> : <p className="mt-1 text-amber-700 dark:text-amber-400">Needs your input.</p>}
                  {question.sensitive ? <Badge variant="warning" className="mt-2">Sensitive — approval required</Badge> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          {data.automation ? (
            <Card>
              <CardHeader><CardTitle>Browser automation</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={data.automation.status === "succeeded" ? "success" : data.automation.status === "failed" ? "destructive" : data.automation.status === "manual_required" ? "warning" : "secondary"}>
                    {data.automation.status.replace(/_/g, " ")}
                  </Badge>
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
            <CardContent className="space-y-3">
              {data.events.map((event) => (
                <div key={event.id} className={`border-l-2 pl-3 text-sm ${event.type.includes("reply") ? "border-emerald-500" : "border-primary"}`}>
                  <div className="font-medium">{event.type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()} {event.to ? `→ ${event.to}` : ""}</div>
                  {event.type.includes("reply") && event.detail ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {(() => {
                        try {
                          const d = JSON.parse(event.detail);
                          return d.subject ? `Subject: ${d.subject}` : null;
                        } catch { return null; }
                      })()}
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
