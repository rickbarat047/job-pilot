import { affectedRows, newId, nowIso, parseJson, transaction } from "./db";
import type { DbClient } from "./db";
import { createNotification } from "./repositories";

type Row = Record<string, unknown>;
export type WorkerResultStatus = "applied" | "manual_required" | "failed";
// Backwards-compatible alias used by the worker result API route.
export type WorkerTaskStatus = WorkerResultStatus;
export interface WorkerResultInput {
  status: WorkerResultStatus;
  message?: string;
  confirmation?: string;
  finalUrl?: string;
  fieldsFilled?: string[];
  screenshotPath?: string;
}
export interface WorkerResultOutcome {
  ok: boolean;
  duplicate?: boolean;
  state: string | null;
  status: string;
  error?: string;
}

const ACTIVE_TASK_STATUSES = ["running", "queued"];

function notificationFor(outcome: WorkerResultOutcome, title: string): { title: string; body: string } | null {
  if (!outcome.ok || outcome.duplicate) return null;
  if (outcome.status === "applied") {
    return {
      title: "Application submitted",
      body: `${title} was submitted with browser automation.`,
    };
  }
  if (outcome.status === "manual_required") {
    return {
      title: "Browser automation needs your help",
      body: `${title} needs manual completion.`,
    };
  }
  if (outcome.status === "failed") {
    return {
      title: "Browser automation failed",
      body: `${title} could not be submitted automatically.`,
    };
  }
  return null;
}

/**
 * Record a worker result exactly once.
 *
 * The atomic gate is a conditional UPDATE of automation_tasks from an active
 * status to its terminal/retry status inside a single DB transaction. A second
 * callback (concurrent or delayed) cannot win that gate, so it never writes a
 * second event, notification or state change.
 */
export async function recordWorkerResult(taskId: string, input: WorkerResultInput): Promise<WorkerResultOutcome> {
  const written = await transaction(async (db: DbClient) => {
    const task = await db.get<Row>("SELECT * FROM automation_tasks WHERE id = ?", [taskId]);
    if (!task || String(task.type) !== "browser-apply") {
      return { outcome: { ok: false, state: null, status: "failed", error: "Browser task not found." } as WorkerResultOutcome };
    }

    const priorStatus = String(task.status ?? "");
    if (!ACTIVE_TASK_STATUSES.includes(priorStatus)) {
      return {
        outcome: {
          ok: true,
          duplicate: true,
          state: null,
          status: "duplicate",
          error: `Result already recorded (task status: ${priorStatus}).`,
        } as WorkerResultOutcome,
      };
    }

    const userId = String(task.user_id);
    const payload = parseJson<Record<string, unknown>>(task.payload, {});
    const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : "";
    const now = nowIso();
    const message = String(input.message || "").slice(0, 4000);

    if (!applicationId) {
      await db.run(
        "UPDATE automation_tasks SET status='failed', last_error=?, locked_at=NULL WHERE id=? AND status IN ('running','queued')",
        ["Browser task has no application attached.", taskId],
      );
      return { outcome: { ok: true, state: null, status: "failed" } as WorkerResultOutcome };
    }

    const application = await db.get<Row>(
      "SELECT * FROM applications WHERE id = ? AND user_id = ?",
      [applicationId, userId],
    );
    if (!application) {
      await db.run(
        "UPDATE automation_tasks SET status='failed', last_error=?, locked_at=NULL WHERE id=? AND status IN ('running','queued')",
        ["Application not found for this browser task.", taskId],
      );
      return { outcome: { ok: true, state: null, status: "failed" } as WorkerResultOutcome };
    }

    const fromState = String(application.state ?? "");
    const jobRow = await db.get<Row>(
      "SELECT title FROM jobs WHERE id = ?",
      [String(application.job_id ?? "")],
    );
    const title = String(jobRow?.title ?? "This application");
    const attempts = Number(task.attempts ?? 0);
    const maxAttempts = Number(task.max_attempts ?? 3) || 3;
    const terminal = attempts >= maxAttempts;
    const retryAt = new Date(Date.now() + Math.min(30, 2 ** Math.max(0, attempts)) * 60_000).toISOString();
    const detail = JSON.stringify({
      message,
      confirmation: input.confirmation,
      finalUrl: input.finalUrl,
      fieldsFilled: input.fieldsFilled,
      screenshotPath: input.screenshotPath,
    });

    let finalStatus = "succeeded";
    let nextStatus: string = "applied";
    let nextState: string | null = "Applied";

    if (input.status === "manual_required") {
      finalStatus = "manual_required";
      nextStatus = "manual_required";
      nextState = fromState === "Applying" ? "Approved" : fromState;
    } else if (input.status === "failed") {
      finalStatus = terminal ? "failed" : "queued";
      nextStatus = terminal ? "failed" : "retry_queued";
      nextState = fromState === "Applying" ? (terminal ? "Application Failed" : "Approved") : fromState;
    }

    // Atomic idempotency gate: only one caller can move an active task.
    const claimed = await db.run(
      `UPDATE automation_tasks
          SET status=?, last_error=?, locked_at=NULL, next_run_at=?, updated_at=?
        WHERE id=? AND status IN ('running','queued')`,
      [finalStatus, input.status === "applied" ? null : message || input.status, input.status === "failed" && !terminal ? retryAt : now, now, taskId],
    );
    if (affectedRows(claimed) === 0) {
      return {
        outcome: {
          ok: true,
          duplicate: true,
          state: null,
          status: "duplicate",
          error: `Result already recorded (task status: ${priorStatus}).`,
        } as WorkerResultOutcome,
      };
    }

    if (input.status === "applied") {
      await db.run(
        "UPDATE applications SET state='Applied', applied_at=?, last_event_at=?, updated_at=? WHERE id=? AND user_id=?",
        [now, now, now, applicationId, userId],
      );
      await db.run(
        `INSERT INTO application_events
           (id, application_id, user_id, event_type, from_state, to_state, detail, created_at)
         VALUES (?, ?, ?, 'application.submitted_browser', ?, 'Applied', ?, ?)`,
        [newId("evt"), applicationId, userId, fromState, detail, now],
      );
    } else if (input.status === "manual_required") {
      if (fromState === "Applying") {
        await db.run(
          "UPDATE applications SET state='Approved', last_event_at=?, updated_at=? WHERE id=? AND user_id=?",
          [now, now, applicationId, userId],
        );
        await db.run(
          `INSERT INTO application_events
             (id, application_id, user_id, event_type, from_state, to_state, detail, created_at)
           VALUES (?, ?, ?, 'application.browser_manual_required', 'Applying', 'Approved', ?, ?)`,
          [newId("evt"), applicationId, userId, detail, now],
        );
      }
    } else if (fromState === "Applying") {
      await db.run(
        "UPDATE applications SET state=?, last_event_at=?, updated_at=? WHERE id=? AND user_id=?",
        [nextState, now, now, applicationId, userId],
      );
      await db.run(
        `INSERT INTO application_events
           (id, application_id, user_id, event_type, from_state, to_state, detail, created_at)
         VALUES (?, ?, ?, ?, 'Applying', ?, ?, ?)`,
        [newId("evt"), applicationId, userId, terminal ? "application.browser_failed" : "application.browser_retry_scheduled", nextState, detail, now],
      );
    }

    return {
      outcome: { ok: true, state: nextState, status: nextStatus } as WorkerResultOutcome,
      notification: notificationFor({ ok: true, state: nextState, status: nextStatus }, title),
      userId,
      applicationId,
    };
  });

  if (written.notification) {
    await createNotification(
      written.userId,
      "application",
      written.notification.title,
      written.notification.body,
      `/applications/${written.applicationId}`,
    );
  }
  return written.outcome;
}
