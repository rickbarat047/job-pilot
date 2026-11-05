"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare, Sparkles, CalendarPlus, Download } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

function googleCalendarUrl(session: any, application?: any): string {
  const title = encodeURIComponent(`Interview: ${application?.jobTitle ?? "Role"} at ${application?.company ?? ""}`);
  const start = session.interviewAt ? new Date(session.interviewAt) : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const details = encodeURIComponent(`Interview prep: ${window.location.origin}/interviews\nApplication: ${window.location.origin}/applications/${application?.id ?? ""}`);
  const location = encodeURIComponent(session.interviewLocation || "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`;
}

function downloadIcs(session: any, application?: any) {
  const title = `Interview: ${application?.jobTitle ?? "Role"} at ${application?.company ?? ""}`;
  const start = session.interviewAt ? new Date(session.interviewAt) : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JobPilot AI//Interview//EN",
    "BEGIN:VEVENT",
    `UID:${session.id}@jobpilot.ai`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:Interview prep: ${window.location.origin}/interviews`,
    `LOCATION:${session.interviewLocation || ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `interview-${session.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function InterviewsPage() {
  const [data, setData] = useState<{ applications?: any[]; sessions?: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [applicationId, setApplicationId] = useState("");
  const [followup, setFollowup] = useState<{ subject: string; body: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{ interviewAt: string; interviewType: string; interviewLocation: string; interviewer: string }>({ interviewAt: "", interviewType: "video", interviewLocation: "", interviewer: "" });
  const [savingSchedule, setSavingSchedule] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/interviews");
    setData(await response.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function saveSchedule(sessionId: string) {
    setSavingSchedule(true);
    try {
      await fetch(`/api/interviews/${sessionId}/schedule`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scheduleForm),
      });
      setSchedulingId(null);
      load();
    } finally {
      setSavingSchedule(false);
    }
  }

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

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="mt-2 h-3 w-24 rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState title="No interview prep yet" description="Generate prep for an application to see likely questions and talking points." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((session) => {
            const application = applications.find((a: any) => a.id === session.applicationId);
            const isScheduling = schedulingId === session.id;
            return (
              <Card key={session.id} className="overflow-hidden">
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle>Prep session</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge variant={session.status === "active" ? "success" : "secondary"}>{session.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {session.interviewAt ? (
                    <div className="rounded-xl border border-border bg-background/40 p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <Calendar className="h-4 w-4 text-primary" />
                        {new Date(session.interviewAt).toLocaleString()}
                      </div>
                      {session.interviewType ? <div className="mt-1 text-xs text-muted-foreground">Type: {session.interviewType}</div> : null}
                      {session.interviewLocation ? <div className="mt-1 text-xs text-muted-foreground">Location: {session.interviewLocation}</div> : null}
                      {session.interviewer ? <div className="mt-1 text-xs text-muted-foreground">Interviewer: {session.interviewer}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={googleCalendarUrl(session, application)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" /> Add to Google Calendar
                        </a>
                        <button
                          type="button"
                          onClick={() => downloadIcs(session, application)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          <Download className="h-3.5 w-3.5" /> Download .ics
                        </button>
                        <Button size="sm" variant="ghost" onClick={() => { setSchedulingId(session.id); setScheduleForm({ interviewAt: session.interviewAt ? new Date(session.interviewAt).toISOString().slice(0, 16) : "", interviewType: session.interviewType || "video", interviewLocation: session.interviewLocation || "", interviewer: session.interviewer || "" }); }}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setSchedulingId(session.id); setScheduleForm({ interviewAt: "", interviewType: "video", interviewLocation: "", interviewer: "" }); }}>
                      <Calendar className="mr-1.5 h-3.5 w-3.5" /> Schedule interview
                    </Button>
                  )}

                  {isScheduling ? (
                    <div className="space-y-3 rounded-xl border border-border bg-background/40 p-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Date & time</label>
                        <Input type="datetime-local" value={scheduleForm.interviewAt} onChange={(e) => setScheduleForm({ ...scheduleForm, interviewAt: e.target.value })} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Type</label>
                        <Select value={scheduleForm.interviewType} onChange={(e) => setScheduleForm({ ...scheduleForm, interviewType: e.target.value })}>
                          <option value="video">Video call</option>
                          <option value="phone">Phone</option>
                          <option value="onsite">On-site</option>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Location / link</label>
                        <Input value={scheduleForm.interviewLocation} onChange={(e) => setScheduleForm({ ...scheduleForm, interviewLocation: e.target.value })} placeholder="Zoom link or office address" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Interviewer</label>
                        <Input value={scheduleForm.interviewer} onChange={(e) => setScheduleForm({ ...scheduleForm, interviewer: e.target.value })} placeholder="Name" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveSchedule(session.id)} disabled={savingSchedule || !scheduleForm.interviewAt}>
                          {savingSchedule ? "Saving…" : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSchedulingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : null}

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
            );
          })}
        </div>
      )}
    </div>
  );
}
