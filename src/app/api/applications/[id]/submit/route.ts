import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail, getPermissionsForUser } from "@/lib/repositories";
import { assertPermission } from "@/lib/permissions";
import { canTransition } from "@/lib/permissions";
import { getDb, newId, nowIso, run, get } from "@/lib/db";
import { sendApplicationEmail } from "@/lib/email";
import { enqueueTask, workerIsOnline } from "@/lib/automation";
import { relativeStoragePath } from "@/lib/storage";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ip = clientIp(request);
    const rate = checkRateLimit(`submit:${ip}`, 10, 15 * 60 * 1000);
    if (!rate.ok) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (detail.application.state !== "Approved") return NextResponse.json({ error: "Approve the application before submitting." }, { status: 400 });

    const permissions = await getPermissionsForUser(user.id);
    // Users can explicitly choose browser automation for jobs whose canonical
    // source is "external" (Greenhouse, Lever, Ashby, SmartRecruiters, ...).
    const requestedMethod = typeof body.method === "string" ? body.method : "";
    const method = requestedMethod === "browser" ? "browser" : (detail.job.method || detail.application.method || "external");
    const now = nowIso();

    if (method === "email") {
      assertPermission(permissions, "send_recruiter_email");
      if (!detail.email?.to) return NextResponse.json({ error: "No recruiter email is available for this application." }, { status: 400 });
      const attachments = detail.documents
        .filter((doc) => doc.kind === "resume" || doc.kind === "cover_letter")
        .map((doc) => ({ filename: doc.filename, path: doc.path }));
      const result = await sendApplicationEmail({
        userId: user.id,
        applicationId: id,
        to: detail.email.to,
        subject: detail.email.subject,
        body: detail.email.body,
        attachments,
        demoMode: permissions.demoMode,
      });
      if (result.ok) {
        await run("UPDATE applications SET state='Applied', applied_at=?, last_event_at=?, updated_at=? WHERE id=? AND user_id=?", [now, now, now, id, user.id]);
        await run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.submitted_email', 'Approved', 'Applied', ?, ?)", [newId("evt"), id, user.id, JSON.stringify({ messageId: result.messageId }), now]);
        return NextResponse.json({ ok: true, state: "Applied", method: "email" });
      }
      await run("UPDATE applications SET state='Application Failed', last_event_at=?, updated_at=? WHERE id=? AND user_id=?", [now, now, id, user.id]);
      await run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.failed', 'Approved', 'Application Failed', ?, ?)", [newId("evt"), id, user.id, JSON.stringify({ error: result.error, status: result.status }), now]);
      return NextResponse.json({ ok: false, error: result.error, status: result.status }, { status: 400 });
    }

    if (method === "browser") {
      assertPermission(permissions, "submit_application");
      if (permissions.demoMode) {
        return NextResponse.json({ error: "Demo mode is enabled. Turn it off in Settings before submitting real applications." }, { status: 400 });
      }
      if (!await workerIsOnline()) {
        return NextResponse.json({ ok: false, error: "Browser automation worker is offline. Open the official application page and complete it manually.", fallback: "manual" }, { status: 503 });
      }
      const taskId = await enqueueTask(user.id, "browser-apply", { applicationId: id, jobId: detail.application.jobId, submit: true }, 2);
      await run("UPDATE applications SET state='Applying', application_method='browser', last_event_at=?, updated_at=? WHERE id=? AND user_id=?", [now, now, id, user.id]);
      await run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.browser_queued', 'Approved', 'Applying', ?, ?)", [newId("evt"), id, user.id, JSON.stringify({ taskId }), now]);
      return NextResponse.json({ ok: true, state: "Applying", method: "browser", taskId });
    }

    // External/manual submission: never claim success automatically.
    await run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.opened_for_manual_submission', 'Approved', 'Approved', ?, ?)", [newId("evt"), id, user.id, JSON.stringify({ applicationUrl: detail.job.applicationUrl }), now]);
    return NextResponse.json({ ok: true, state: "Approved", method: "external", requiresManual: true, applicationUrl: detail.job.applicationUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit." }, { status: 400 });
  }
}

