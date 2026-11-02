import { all, get, newId, nowIso, parseJson, run } from "./db";
import { runDiscovery } from "./discovery";
import { createNotification, getPermissionsForUser } from "./repositories";
import { evaluatePermission } from "./permissions";
import { checkCompanyCareerPage } from "./companies/check";

type Row = Record<string, unknown>;

export type AutomationTaskType = "discovery" | "verify-jobs" | "career-page-check" | "daily-digest" | "auto-apply" | "browser-apply";

export async function enqueueTask(userId: string, type: AutomationTaskType, payload: Record<string, unknown> = {}, priority = 5): Promise<string> {
  const id = newId("tsk");
  const now = nowIso();
  await run(
    `INSERT INTO automation_tasks (id, user_id, type, status, priority, payload, attempts, max_attempts, next_run_at, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', ?, ?, 0, 3, ?, ?, ?)`,
    [id, userId, type, priority, JSON.stringify(payload), now, now, now],
  );
  return id;
}

export async function retryTask(userId: string, taskId: string): Promise<void> {
  await run("UPDATE automation_tasks SET status='queued', attempts=0, next_run_at=?, last_error=NULL, updated_at=? WHERE id=? AND user_id=?", [nowIso(), nowIso(), taskId, userId]);
}

export async function processAutomationTasks(userId?: string, maxTasks = 4): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = nowIso();
  const where = userId ? "user_id = ? AND" : "";
  const params: (string | number)[] = userId ? [userId] : [];
  // Browser applications are long-running and are claimed by the external
  // Playwright worker. Never let the in-app processor consume or discard them.
  const tasks = await all<Row>(
    `SELECT * FROM automation_tasks WHERE ${where} status='queued' AND type <> 'browser-apply' AND next_run_at <= ? ORDER BY priority ASC, created_at ASC LIMIT ?`,
    [...params, now, maxTasks],
  );
  let processed = 0, succeeded = 0, failed = 0;
  for (const task of tasks) {
    const id = String(task.id);
    const uid = String(task.user_id);
    await run("UPDATE automation_tasks SET status='running', locked_at=?, updated_at=? WHERE id=?", [nowIso(), nowIso(), id]);
    try {
      const payload = parseJson<Record<string, unknown>>(task.payload, {});
      await runTask(uid, String(task.type), payload);
      await run("UPDATE automation_tasks SET status='succeeded', updated_at=? WHERE id=?", [nowIso(), id]);
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = Number(task.attempts) + 1;
      const maxAttempts = Number(task.max_attempts);
      const retryAt = new Date(Date.now() + Math.min(30, 2 ** attempts) * 60_000).toISOString();
      const status = attempts >= maxAttempts ? "failed" : "queued";
      await run("UPDATE automation_tasks SET status=?, attempts=?, next_run_at=?, last_error=?, updated_at=? WHERE id=?", [status, attempts, retryAt, message, nowIso(), id]);
      await run("INSERT INTO automation_logs (id, user_id, run_id, level, message, meta, created_at) VALUES (?, ?, NULL, 'error', ?, ?, ?)", [newId("log"), uid, `Task ${task.type} failed: ${message}`, JSON.stringify({ taskId: id }), nowIso()]);
      failed++;
    }
    processed++;
  }
  return { processed, succeeded, failed };
}

async function runTask(userId: string, type: string, payload: Record<string, unknown>): Promise<void> {
  switch (type) {
    case "discovery": {
      await runDiscovery(userId, { sourceKeys: Array.isArray(payload.sourceKeys) ? (payload.sourceKeys as string[]) : undefined, match: true });
      break;
    }
    case "career-page-check": {
      if (typeof payload.companyId === "string") await checkCompanyCareerPage(payload.companyId);
      break;
    }
    case "verify-jobs": {
      const jobs = await all<{ id: string; application_url: string }>("SELECT id, application_url FROM jobs WHERE status='active' ORDER BY last_verified_at ASC LIMIT 50");
      for (const job of jobs) {
        try {
          const response = await fetch(job.application_url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
          await run("UPDATE jobs SET last_verified_at=?, status=? WHERE id=?", [nowIso(), response.status >= 400 ? "expired" : "active", job.id]);
        } catch {
          await run("UPDATE jobs SET last_verified_at=? WHERE id=?", [nowIso(), job.id]);
        }
      }
      break;
    }
    case "daily-digest": {
      const { getDashboard } = await import("./repositories");
      const dashboard = await getDashboard(userId);
      const { createNotification } = await import("./repositories");
      await createNotification(userId, "digest", "Daily job digest", `You have ${dashboard.stats.matched} matched roles, ${dashboard.stats.pending} pending approvals and ${dashboard.stats.interviews} interviews in progress.`, "/dashboard");
      break;
    }
    case "auto-apply": {
      const permissions = await getPermissionsForUser(userId);
      if (permissions.autonomyLevel < 4) throw new Error("Auto-apply requires autonomy level 4.");
      const minScore = permissions.autoApplyMinScore || 85;
      const categories = new Set(permissions.autoApplyCategories.map((value) => value.toLowerCase()));
      const rows = await all<{ job_id: string; overall_score: number; title: string; role_family: string | null }>(
        `SELECT jm.job_id, jm.overall_score, j.title, jm.role_family FROM job_matches jm JOIN jobs j ON j.id = jm.job_id
         WHERE jm.user_id = ? AND jm.overall_score >= ? AND jm.qualified = 1 ORDER BY jm.overall_score DESC LIMIT 5`,
        [userId, minScore],
      );
      const decision = evaluatePermission(permissions, "auto_apply");
      if (!decision.allowed) throw new Error(decision.reason);
      if (!await workerIsOnline()) throw new Error("The browser automation worker is offline; auto-apply is paused.");

      for (const row of rows) {
        if (categories.size && row.role_family && !categories.has(String(row.role_family).toLowerCase())) continue;
        // Auto-apply never manufactures an application or answers sensitive
        // questions. It only submits a prepared, approved draft.
        const application = await get<{ id: string; state: string }>(
          "SELECT id, state FROM applications WHERE user_id = ? AND job_id = ? ORDER BY created_at DESC LIMIT 1",
          [userId, row.job_id],
        );
        if (!application) continue;

        if (application.state === "Draft Ready" || application.state === "Awaiting Approval") {
          const unanswered = await get<{ c: number }>(
            `SELECT COUNT(*) as c FROM application_questions
             WHERE application_id = ? AND (sensitive = 1 OR requires_approval = 1)
               AND (answer IS NULL OR answer = '')`,
            [application.id],
          );
          if (Number(unanswered?.c ?? 0) > 0) {
            await createNotification(userId, "application", "Auto-apply paused for review", `${row.title} has sensitive questions that need your answer.`, `/applications/${application.id}`);
            continue;
          }
          const nowApproved = nowIso();
          await run(
            "UPDATE applications SET state='Approved', approval_required=0, approved_at=?, last_event_at=?, updated_at=? WHERE id=?",
            [nowApproved, nowApproved, nowApproved, application.id],
          );
          await run(
            `INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at)
             VALUES (?, ?, ?, 'application.auto_approved', ?, 'Approved', ?, ?)`,
            [newId("evt"), application.id, userId, application.state, JSON.stringify({ source: "auto-apply", score: row.overall_score }), nowApproved],
          );
        } else if (application.state !== "Approved") {
          continue;
        }

        await enqueueTask(userId, "browser-apply", { applicationId: application.id, jobId: row.job_id, submit: true }, 3);
        const nowQueued = nowIso();
        await run(
          "UPDATE applications SET state='Applying', application_method='browser', last_event_at=?, updated_at=? WHERE id=?",
          [nowQueued, nowQueued, application.id],
        );
      }
      break;
    }
    case "browser-apply": {
      // Browser tasks are claimed only by the external Playwright worker.
      throw new Error("Browser application tasks must be processed by the Playwright worker.");
    }
    default:
      throw new Error(`Unknown automation task type: ${type}`);
  }
}

export async function updateWorkerHeartbeat(status: "online" | "offline", meta: Record<string, unknown> = {}): Promise<void> {
  const now = nowIso();
  await run(
    "INSERT INTO worker_status (id, name, status, last_heartbeat, meta) VALUES ('playwright-worker','Playwright browser worker',?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, last_heartbeat=excluded.last_heartbeat, meta=excluded.meta",
    [status, now, JSON.stringify(meta)],
  );
}

export async function workerIsOnline(): Promise<boolean> {
  const row = await get<{ status: string; last_heartbeat: string | null }>("SELECT status, last_heartbeat FROM worker_status WHERE id='playwright-worker'");
  if (!row || row.status !== "online" || !row.last_heartbeat) return false;
  return Date.now() - new Date(row.last_heartbeat).getTime() < 90_000;
}






