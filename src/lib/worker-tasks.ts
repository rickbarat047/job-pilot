import { affectedRows, get, newId, nowIso, parseJson, run, all, transaction } from "./db";
import {
  createNotification,
  getApplicationDetail,
  getPermissionsForUser,
  getProfile,
} from "./repositories";
import { supportedAtsForUrl } from "./ats-safety";
import { isActiveForAutomatedApplication } from "./job-verification";

type Row = Record<string, unknown>;

export type WorkerTaskStatus = "applied" | "manual_required" | "failed";

export interface WorkerResultInput {
  status: WorkerTaskStatus;
  message?: string;
  confirmation?: string;
  finalUrl?: string;
  fieldsFilled?: string[];
  screenshotPath?: string;
}

export function workerSafeAnswers(questions: Array<{ question: string; answer: string; sensitive?: boolean; requiresApproval?: boolean }>) {
  return questions
    .filter((question) => question.answer && question.answer.trim() && !question.sensitive && !question.requiresApproval)
    .map((question) => ({ question: question.question, answer: question.answer, sensitive: false }));
}

const STALE_LOCK_MS = 10 * 60 * 1000;

/**
 * Atomically claim the next approved browser application. The worker polls
 * this; the Next.js app never consumes browser tasks itself.
 */
export async function claimWorkerTask(): Promise<Row | null> {
  const now = nowIso();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  // Recover tasks whose worker died mid-run so they are not stuck forever.
  await run(
    `UPDATE automation_tasks
     SET status='queued', locked_at=NULL, last_error=COALESCE(last_error, 'Worker lock expired.'),
         updated_at=?
     WHERE type='browser-apply' AND status='running' AND locked_at IS NOT NULL AND locked_at < ?`,
    [now, staleBefore],
  );

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await get<Row>(
      `SELECT * FROM automation_tasks
       WHERE type='browser-apply' AND status='queued' AND next_run_at <= ?
       ORDER BY priority ASC, created_at ASC LIMIT 1`,
      [now],
    );
    if (!candidate) return null;

    const result = await run(
      `UPDATE automation_tasks
       SET status='running', attempts=COALESCE(attempts, 0) + 1, locked_at=?, updated_at=?
       WHERE id=? AND status='queued'`,
      [now, now, String(candidate.id)],
    );
    if (affectedRows(result) > 0) {
      return { ...candidate, status: "running", attempts: Number(candidate.attempts ?? 0) + 1, locked_at: now };
    }
  }
  return null;
}

/**
 * Build the complete, minimal payload a browser worker needs. The worker gets
 * no session cookie and no database credentials: only this task's data plus
 * token-authenticated document download URLs.
 */
export async function getWorkerTaskPayload(taskId: string, baseUrl: string) {
  const task = await get<Row>("SELECT * FROM automation_tasks WHERE id = ?", [taskId]);
  if (!task) throw new Error("Browser task not found.");
  if (String(task.type) !== "browser-apply") throw new Error("This task is not a browser application.");

  const userId = String(task.user_id);
  const payload = parseJson<Record<string, unknown>>(task.payload, {});
  const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : "";
  if (!applicationId) throw new Error("Browser task has no application attached.");

  const detail = await getApplicationDetail(userId, applicationId);
  if (!detail) throw new Error("Application not found for this browser task.");
  if (!isActiveForAutomatedApplication(detail.job.status)) {
    throw new Error("This listing is no longer marked active; browser submission was stopped. Check the employer page and refresh discovery.");
  }
  if (!supportedAtsForUrl(detail.job.applicationUrl)) throw new Error("This application URL is not on a supported secure hiring system.");
  if (!["Approved", "Applying"].includes(detail.application.state)) {
    throw new Error(`Application is ${detail.application.state}; only approved applications can be automated.`);
  }

  const permissions = await getPermissionsForUser(userId);
  if (permissions.demoMode) throw new Error("Demo mode is enabled; browser submissions are disabled.");

  const profile = await getProfile(userId);
  const now = nowIso();
  if (detail.application.state === "Approved") {
    await run(
      "UPDATE applications SET state='Applying', application_method='browser', last_event_at=?, updated_at=? WHERE id=? AND user_id=?",
      [now, now, applicationId, userId],
    );
    await run(
      `INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at)
       VALUES (?, ?, ?, 'application.browser_started', 'Approved', 'Applying', ?, ?)`,
      [newId("evt"), applicationId, userId, JSON.stringify({ taskId }), now],
    );
  }

  const origin = baseUrl.replace(/\/$/, "");
  return {
    task: {
      id: String(task.id),
      attempts: Number(task.attempts),
      maxAttempts: Number(task.max_attempts ?? 3),
      createdAt: String(task.created_at ?? ""),
    },
    application: {
      id: detail.application.id,
      state: "Applying",
      jobId: detail.application.jobId,
      method: "browser",
    },
    job: {
      title: detail.job.title,
      company: detail.job.company,
      location: detail.job.location,
      applicationUrl: detail.job.applicationUrl,
      employmentType: detail.job.employmentType,
      remoteStatus: detail.job.remoteStatus,
    },
    candidate: {
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      headline: profile.headline,
      summary: profile.summary,
      currentStatus: profile.currentStatus,
      noticePeriod: profile.noticePeriod,
      experienceYears: profile.experienceYears,
      degree: profile.degree,
      university: profile.university,
      graduationYear: profile.graduationYear,
      cgpa: profile.cgpa,
      languages: profile.languages,
      skills: profile.skills.map((skill) => skill.name).filter(Boolean),
    },
    documents: detail.documents.map((doc) => ({
      id: doc.id,
      kind: doc.kind,
      filename: doc.filename,
      downloadUrl: `${origin}/api/automation/worker/documents/${encodeURIComponent(doc.id)}?taskId=${encodeURIComponent(String(task.id))}`,
    })),
    answers: workerSafeAnswers(detail.questions),
    submit: payload.submit !== false,
    demoMode: false,
  };
}

export async function recordWorkerResult(taskId: string, input: WorkerResultInput) {
  const task = await get<Row>("SELECT * FROM automation_tasks WHERE id = ?", [taskId]);
  if (!task) throw new Error("Browser task not found.");
  if (String(task.type) !== "browser-apply") throw new Error("This task is not a browser application.");

  // Worker result callbacks may be retried after a network timeout. Return the
  // recorded outcome for terminal tasks instead of duplicating application
  // events, notifications, or retry scheduling.
  const taskStatus = String(task.status);
  if (taskStatus === "succeeded") return { ok: true, state: "Applied", status: "applied", alreadyRecorded: true };
  if (taskStatus === "manual_required") return { ok: true, state: "Approved", status: "manual_required", alreadyRecorded: true };
  if (taskStatus === "failed") return { ok: true, state: "Application Failed", status: "failed", alreadyRecorded: true };
  if (taskStatus !== "running") throw new Error("Browser task is no longer running; its result was not changed.");

  const userId = String(task.user_id);
  const payload = parseJson<Record<string, unknown>>(task.payload, {});
  const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : "";
  const now = nowIso();
  const message = (input.message || "").slice(0, 4000);

  if (!applicationId) {
    const recorded = await transaction(async (db) => {
      const changed = await db.run(
        "UPDATE automation_tasks SET status='failed', last_error=?, locked_at=NULL, updated_at=? WHERE id=? AND status='running'",
        [message || "Browser task has no application attached.", now, taskId],
      );
      return affectedRows(changed) === 1;
    });
    return { ok: true, state: null, status: "failed", alreadyRecorded: !recorded };
  }

  const application = await get<Row>("SELECT id, state FROM applications WHERE id = ? AND user_id = ?", [applicationId, userId]);
  if (!application) {
    const recorded = await transaction(async (db) => {
      const changed = await db.run(
        "UPDATE automation_tasks SET status='failed', last_error='Application no longer exists.', locked_at=NULL, updated_at=? WHERE id=? AND status='running'",
        [now, taskId],
      );
      return affectedRows(changed) === 1;
    });
    return { ok: true, state: null, status: "failed", alreadyRecorded: !recorded };
  }

  const fromState = String(application.state);
  const jobRow = await get<{ title: string }>(
    "SELECT j.title FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND a.user_id = ?",
    [applicationId, userId],
  );
  const title = jobRow?.title ? String(jobRow.title) : "This application";

  if (input.status === "applied") {
    const recorded = await transaction(async (db) => {
      const currentTask = await db.get<Row>("SELECT status FROM automation_tasks WHERE id=?", [taskId]);
      if (!currentTask) throw new Error("Browser task not found.");
      if (String(currentTask.status) === "succeeded") return false;
      if (String(currentTask.status) !== "running") throw new Error("Browser task is no longer running; its result was not changed.");

      const currentApplication = await db.get<Row>("SELECT state FROM applications WHERE id=? AND user_id=?", [applicationId, userId]);
      if (!currentApplication) throw new Error("Application no longer exists.");
      if (String(currentApplication.state) === "Applied") {
        await db.run("UPDATE automation_tasks SET status='succeeded', last_error=NULL, locked_at=NULL, updated_at=? WHERE id=? AND status='running'", [now, taskId]);
        return false;
      }
      if (String(currentApplication.state) !== "Applying") throw new Error("Application is no longer in the applying state; the worker result was not recorded.");

      const changed = await db.run(
        "UPDATE automation_tasks SET status='succeeded', last_error=NULL, locked_at=NULL, updated_at=? WHERE id=? AND status='running'",
        [now, taskId],
      );
      if (affectedRows(changed) !== 1) return false;
      await db.run(
        "UPDATE applications SET state='Applied', applied_at=?, last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state='Applying'",
        [now, now, now, applicationId, userId],
      );
      await db.run(
        `INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at)
         VALUES (?, ?, ?, 'application.submitted_browser', 'Applying', 'Applied', ?, ?)`,
        [newId("evt"), applicationId, userId, JSON.stringify({
          message, confirmation: input.confirmation ?? null, finalUrl: input.finalUrl ?? null,
          fieldsFilled: input.fieldsFilled ?? [], screenshotPath: input.screenshotPath ?? null,
        }), now],
      );
      return true;
    });
    if (!recorded) return { ok: true, state: "Applied", status: "applied", alreadyRecorded: true };
    await createNotification(
      userId,
      "application",
      "Application submitted",
      `${title} was submitted with browser automation.`,
      `/applications/${applicationId}`,
    );
    return { ok: true, state: "Applied", status: "applied" };
  }

  if (input.status === "manual_required") {
    const recorded = await transaction(async (db) => {
      const currentTask = await db.get<Row>("SELECT status FROM automation_tasks WHERE id=?", [taskId]);
      if (!currentTask || String(currentTask.status) !== "running") return false;
      const currentApplication = await db.get<Row>("SELECT state FROM applications WHERE id=? AND user_id=?", [applicationId, userId]);
      if (!currentApplication || !["Applying", "Approved"].includes(String(currentApplication.state))) {
        throw new Error("Application state changed; the worker result was not recorded.");
      }
      const changed = await db.run(
        "UPDATE automation_tasks SET status='manual_required', last_error=?, locked_at=NULL, updated_at=? WHERE id=? AND status='running'",
        [message || "Manual completion required.", now, taskId],
      );
      if (affectedRows(changed) !== 1) return false;
      if (String(currentApplication.state) === "Applying") {
        const updated = await db.run(
          "UPDATE applications SET state='Approved', last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state='Applying'",
          [now, now, applicationId, userId],
        );
        if (affectedRows(updated) !== 1) throw new Error("Application state changed; the worker result was not recorded.");
        await db.run(
          `INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at)
           VALUES (?, ?, ?, 'application.browser_manual_required', 'Applying', 'Approved', ?, ?)`,
          [newId("evt"), applicationId, userId, JSON.stringify({
            message, finalUrl: input.finalUrl ?? null, fieldsFilled: input.fieldsFilled ?? [],
            screenshotPath: input.screenshotPath ?? null,
          }), now],
        );
      }
      return true;
    });
    if (!recorded) return { ok: true, state: "Approved", status: "manual_required", alreadyRecorded: true };
    await createNotification(
      userId,
      "application",
      "Browser automation needs your help",
      `${title} needs manual completion: ${message || "open the application page."}`,
      `/applications/${applicationId}`,
    );
    return { ok: true, state: "Approved", status: "manual_required" };
  }

  const attempts = Number(task.attempts ?? 0);
  const maxAttempts = Number(task.max_attempts ?? 3) || 3;
  const terminal = attempts >= maxAttempts;
  const retryAt = new Date(Date.now() + Math.min(30, 2 ** Math.max(0, attempts)) * 60_000).toISOString();
  const result = await transaction(async (db) => {
    const currentTask = await db.get<Row>("SELECT status FROM automation_tasks WHERE id=?", [taskId]);
    if (!currentTask || String(currentTask.status) !== "running") return null;
    const currentApplication = await db.get<Row>("SELECT state FROM applications WHERE id=? AND user_id=?", [applicationId, userId]);
    if (!currentApplication) throw new Error("Application no longer exists.");

    const nextTaskStatus = terminal ? "failed" : "queued";
    const changed = await db.run(
      "UPDATE automation_tasks SET status=?, next_run_at=?, last_error=?, locked_at=NULL, updated_at=? WHERE id=? AND status='running'",
      [nextTaskStatus, terminal ? null : retryAt, message || "Browser automation failed.", now, taskId],
    );
    if (affectedRows(changed) !== 1) return null;

    let nextApplicationState = String(currentApplication.state);
    if (nextApplicationState === "Applying") {
      nextApplicationState = terminal ? "Application Failed" : "Approved";
      const updated = await db.run(
        "UPDATE applications SET state=?, last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state='Applying'",
        [nextApplicationState, now, now, applicationId, userId],
      );
      if (affectedRows(updated) !== 1) throw new Error("Application state changed; the worker result was not recorded.");
      await db.run(
        `INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at)
         VALUES (?, ?, ?, ?, 'Applying', ?, ?, ?)`,
        [
          newId("evt"), applicationId, userId,
          terminal ? "application.browser_failed" : "application.browser_retry_scheduled",
          nextApplicationState,
          JSON.stringify({ message, finalUrl: input.finalUrl ?? null, screenshotPath: input.screenshotPath ?? null }),
          now,
        ],
      );
    }
    return { state: nextApplicationState, status: terminal ? "failed" : "retry_queued" };
  });
  if (!result) return { ok: true, state: fromState, status: terminal ? "failed" : "retry_queued", alreadyRecorded: true };
  await createNotification(
    userId,
    "application",
    terminal ? "Browser application failed" : "Browser application will retry",
    terminal ? `${title} failed: ${message || "unknown error"}` : `${title} hit a temporary issue and will retry.`,
    `/applications/${applicationId}`,
  );
  return { ok: true, ...result };
}

export async function workerTaskForApplication(userId: string, applicationId: string) {
  const tasks = await all<Row>(
    "SELECT * FROM automation_tasks WHERE user_id = ? AND type='browser-apply' ORDER BY created_at DESC LIMIT 25",
    [userId],
  );
  const task = tasks.find((row) => {
    const payload = parseJson<Record<string, unknown>>(row.payload, {});
    return payload.applicationId === applicationId;
  });
  if (!task) return null;
  return {
    id: String(task.id),
    status: String(task.status),
    attempts: Number(task.attempts ?? 0),
    maxAttempts: Number(task.max_attempts ?? 3),
    lastError: task.last_error ? String(task.last_error) : null,
    nextRunAt: task.next_run_at ? String(task.next_run_at) : null,
    updatedAt: task.updated_at ? String(task.updated_at) : null,
  };
}

