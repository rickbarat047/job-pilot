import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 300;
import { all, get, parseJson, run } from "@/lib/db";
import { processAutomationTasks } from "@/lib/automation";
import { runDiscovery } from "@/lib/discovery";
import { logger } from "@/lib/logger";

const BATCH_SIZE = Math.max(1, Math.min(50, Number(process.env.CRON_BATCH_SIZE || 8)));

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const secret = request.headers.get("x-cron-secret") || bearer || new URL(request.url).searchParams.get("secret") || "";
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret." }, { status: 401 });
  }

  // Cursor-based batching: process a small slice of users per invocation so no
  // single tick can time out on Vercel's 300s serverless limit. The cursor is
  // persisted in app_meta so successive ticks (and the daily Vercel cron) walk
  // through all users in deterministic order, then wrap around.
  let cursor = "";
  try {
    const row = await get<{ value: string }>("SELECT value FROM app_meta WHERE key='cron_cursor'");
    if (row?.value) cursor = row.value;
  } catch {
    cursor = "";
  }

  let users = await all<{ id: string }>(
    "SELECT id FROM users WHERE deleted_at IS NULL AND id > ? ORDER BY id ASC LIMIT ?",
    [cursor, BATCH_SIZE],
  );
  let wrapped = false;
  if (users.length === 0) {
    users = await all<{ id: string }>("SELECT id FROM users WHERE deleted_at IS NULL ORDER BY id ASC LIMIT ?", [BATCH_SIZE]);
    wrapped = true;
  }

  const results = [];
  for (const user of users) {
    const schedules = await all<{ id: string; enabled: number; next_run_at: string | null; sources: string }>(
      "SELECT id, enabled, next_run_at, sources FROM scheduled_searches WHERE user_id = ? AND enabled = 1",
      [user.id],
    );
    for (const schedule of schedules) {
      if (schedule.next_run_at && new Date(schedule.next_run_at).getTime() > Date.now()) continue;
      try {
        const sources = parseJson<string[]>(schedule.sources, []);
        const discovery = await runDiscovery(user.id, { sourceKeys: sources });
        await run(
          "UPDATE scheduled_searches SET last_run_at=?, next_run_at=?, updated_at=? WHERE id=?",
          [new Date().toISOString(), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), new Date().toISOString(), schedule.id],
        );
        results.push({ userId: user.id, scheduleId: schedule.id, ok: true, discovery });
      } catch (error) {
        results.push({ userId: user.id, scheduleId: schedule.id, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  // Automation tasks (non-browser) run every tick regardless of user batching.
  try {
    await processAutomationTasks();
  } catch (error) {
    results.push({ automation: true, ok: false, error: error instanceof Error ? error.message : String(error) });
  }

  // Daily match digest (Resend) — fire-and-forget, gated to once per 24h per user.
  if (process.env.RESEND_API_KEY) {
    for (const user of users) {
      try {
        const key = `last_digest_${user.id}`;
        const row = await get<{ value: string }>("SELECT value FROM app_meta WHERE key = ?", [key]);
        const last = row?.value ? new Date(row.value).getTime() : 0;
        if (Date.now() - last < 24 * 60 * 60 * 1000) continue;
        const { sendMatchDigest } = await import("@/lib/transactional-email");
        const sent = await sendMatchDigest(user.id);
        if (sent) {
          await run("INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key, new Date().toISOString()]);
          results.push({ userId: user.id, digest: true, ok: true });
        }
        // Push notification (best-effort, alongside email)
        try {
          const { sendPushToUser } = await import("@/lib/push");
          await sendPushToUser(user.id, { title: "JobPilot: new matches", body: "You have new high-match jobs. Tap to view.", url: "/jobs" });
        } catch { /* ignore */ }
      } catch (error) {
        results.push({ userId: user.id, digest: true, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  // Advance cursor.
  const newCursor = users.length > 0 ? String(users[users.length - 1].id) : cursor;
  const cycleComplete = users.length < BATCH_SIZE || wrapped;
  const persistedCursor = cycleComplete ? "" : newCursor;
  try {
    await run(
      "INSERT INTO app_meta (key, value) VALUES ('cron_cursor', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [persistedCursor],
    );
  } catch {
    try {
      await run("UPDATE app_meta SET value=? WHERE key='cron_cursor'", [persistedCursor]);
    } catch {
      await run("INSERT INTO app_meta (key, value) VALUES ('cron_cursor', ?)", [persistedCursor]);
    }
  }

  const hasMore = !cycleComplete && users.length === BATCH_SIZE;
  logger.info("Cron tick completed", { batch: users.length, processed: results.length, hasMore, cycleComplete });
  return NextResponse.json({ ok: true, batch: users.length, processed: results.length, hasMore, cursor: persistedCursor, results });
}
