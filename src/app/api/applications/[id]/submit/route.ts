import { NextResponse } from "next/server";
import { assertSameOrigin, requireApiUser } from "@/lib/auth";
import { getApplicationDetail, getPermissionsForUser } from "@/lib/repositories";
import { assertPermission } from "@/lib/permissions";
import { affectedRows, newId, nowIso, run, transaction } from "@/lib/db";
import { sendApplicationEmail } from "@/lib/email";
import { workerIsOnline } from "@/lib/automation";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { supportedAtsForUrl } from "@/lib/ats-safety";
import { isActiveForAutomatedApplication } from "@/lib/job-verification";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const ip = clientIp(request);
    const rate = await checkRateLimit(`submit:${ip}`, 10, 15 * 60 * 1000);
    if (!rate.ok) {
      const status = rate.unavailable ? 503 : 429;
      const message = rate.unavailable ? "Rate limiting is unavailable. Try again later." : "Too many requests. Try again later.";
      return NextResponse.json({ error: message }, { status });
    }
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
      const claimed = await transaction(async (db) => {
        const updated = await db.run(
          "UPDATE applications SET state='Applying', application_method='email', last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state='Approved'",
          [now, now, id, user.id],
        );
        if (affectedRows(updated) !== 1) return false;
        await db.run(
          "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.email_sending', 'Approved', 'Applying', '{}', ?)",
          [newId("evt"), id, user.id, now],
        );
        return true;
      });
      if (!claimed) return NextResponse.json({ error: "This application is already being processed. Refresh before trying again." }, { status: 409 });

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
        const sentAt = nowIso();
        const recorded = await transaction(async (db) => {
          const updated = await db.run("UPDATE applications SET state='Applied', applied_at=?, last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state='Applying' AND application_method='email'", [sentAt, sentAt, sentAt, id, user.id]);
          if (affectedRows(updated) !== 1) return false;
          await db.run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.submitted_email', 'Applying', 'Applied', ?, ?)", [newId("evt"), id, user.id, JSON.stringify({ messageId: result.messageId }), sentAt]);
          return true;
        });
        if (!recorded) return NextResponse.json({ ok: false, error: "The email was sent, but its status changed before JobPilot could record it. Check your sent folder before taking another action." }, { status: 409 });
        return NextResponse.json({ ok: true, state: "Applied", method: "email" });
      }
      const failedAt = nowIso();
      const failureRecorded = await transaction(async (db) => {
        const updated = await db.run("UPDATE applications SET state='Application Failed', last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state='Applying' AND application_method='email'", [failedAt, failedAt, id, user.id]);
        if (affectedRows(updated) !== 1) return false;
        await db.run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.failed', 'Applying', 'Application Failed', ?, ?)", [newId("evt"), id, user.id, JSON.stringify({ error: result.error, status: result.status }), failedAt]);
        return true;
      });
      if (!failureRecorded) return NextResponse.json({ ok: false, error: "Email delivery failed, but the application status changed before JobPilot could record it. Refresh and check the timeline." }, { status: 409 });
      return NextResponse.json({ ok: false, state: "Application Failed", error: result.error, status: result.status }, { status: 400 });
    }

    if (method === "browser") {
      assertPermission(permissions, "submit_application");
      if (!isActiveForAutomatedApplication(detail.job.status)) {
        return NextResponse.json({ error: "This listing is no longer marked active. Browser submission is paused; check the employer page and refresh discovery." }, { status: 409 });
      }
      if (!supportedAtsForUrl(detail.job.applicationUrl)) {
        return NextResponse.json({ error: "Browser automation is available only for secure links on supported hiring systems. Open this employer link and complete the application manually." }, { status: 400 });
      }
      if (permissions.demoMode) {
        return NextResponse.json({ error: "Demo mode is enabled. Turn it off in Settings before submitting real applications." }, { status: 400 });
      }
      if (!await workerIsOnline()) {
        return NextResponse.json({ ok: false, error: "Browser automation worker is offline. Open the official application page and complete it manually.", fallback: "manual" }, { status: 503 });
      }
      const taskId = newId("tsk");
      const queued = await transaction(async (db) => {
        const updated = await db.run(
          "UPDATE applications SET state='Applying', application_method='browser', last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state='Approved'",
          [now, now, id, user.id],
        );
        if (affectedRows(updated) !== 1) return false;
        await db.run(
          `INSERT INTO automation_tasks (id, user_id, type, status, priority, payload, next_run_at, created_at, updated_at)
           VALUES (?, ?, 'browser-apply', 'queued', 2, ?, ?, ?, ?)`,
          [taskId, user.id, JSON.stringify({ applicationId: id, jobId: detail.application.jobId, submit: true }), now, now, now],
        );
        await db.run(
          "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.browser_queued', 'Approved', 'Applying', ?, ?)",
          [newId("evt"), id, user.id, JSON.stringify({ taskId }), now],
        );
        return true;
      });
      if (!queued) return NextResponse.json({ error: "This application is already being processed. Refresh to see its current status." }, { status: 409 });
      return NextResponse.json({ ok: true, state: "Applying", method: "browser", taskId });
    }

    // External/manual submission: never claim success automatically.
    await run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.opened_for_manual_submission', 'Approved', 'Approved', ?, ?)", [newId("evt"), id, user.id, JSON.stringify({ applicationUrl: detail.job.applicationUrl }), now]);
    return NextResponse.json({ ok: true, state: "Approved", method: "external", requiresManual: true, applicationUrl: detail.job.applicationUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit." }, { status: 400 });
  }
}

