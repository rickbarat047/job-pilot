"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function InterviewsPage() {
  const [data, setData] = useState<{ applications?: any[]; sessions?: any[] }>({});
  const [applicationId, setApplicationId] = useState("");
  const [followup, setFollowup] = useState<{ subject: string; body: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function load() {
    const response = await fetch("/api/interviews");
    setData(await response.json());
  }
  useEffect(() => { load(); }, []);

  async function createPrep() {
    if (!applicationId) return;
    setCreating(true);
    await fetch("/api/interviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ applicationId }) });
    setCreating(false);
    load();
  }

  async function generateFollowup() {
    if (!applicationId) return;
    setGenerating(true);
    const response = await fetch("/api/interviews/followup-email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ applicationId }) });
    const result = await response.json();
    setGenerating(false);
    setFollowup({ subject: result.subject, body: result.body });
  }

  const applications = data.applications ?? [];
  const sessions = data.sessions ?? [];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.08] via-card to-accent/20 px-6 py-7 shadow-sm sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1 text-xs font-medium text-primary">
            <Calendar className="h-3.5 w-3.5" /> Interview prep
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-4xl">Interview center</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Turn an applied role into a structured prep plan and a polished follow-up email.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Create interview prep</CardTitle>
          <p className="text-sm text-muted-foreground">Pick an application that has been submitted or reached interview stage.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Application</label>
            <Select value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              <option value="">Select an application…</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.jobTitle} — {application.company} ({application.state})
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button className="w-full sm:w-auto" onClick={createPrep} disabled={!applicationId || creating}>{creating ? "Generating…" : "Generate prep"}</Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={generateFollowup} disabled={!applicationId || generating}>{generating ? "Drafting…" : "Generate follow-up email"}</Button>
          </div>
        </CardContent>
      </Card>

      {followup ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Follow-up email draft</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Review and send only after you approve it.</p>
            </div>
            <Badge variant="secondary">Draft</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{followup.subject}</div>
            <pre className="mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground scrollbar-thin">{followup.body}</pre>
          </CardContent>
        </Card>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState title="No interview prep yet" description="Generate prep for an application to see likely questions and talking points." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((session) => (
            <Card key={session.id} className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Prep session</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleString()}</p>
                </div>
                <Badge variant={session.status === "active" ? "success" : "secondary"}>{session.status}</Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {session.questions.map((question: string, index: number) => (
                    <li key={index} className="flex gap-2 rounded-xl border border-border bg-background/40 px-3 py-2">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
