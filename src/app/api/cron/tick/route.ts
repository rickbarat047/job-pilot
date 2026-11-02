import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;
import { all, get, parseJson } from "@/lib/db";
import { processAutomationTasks } from "@/lib/automation";
import { runDiscovery } from "@/lib/discovery";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret." }, { status: 401 });
  }
  const users = await all<{ id: string }>("SELECT id FROM users WHERE deleted_at IS NULL");
  const results = [];
  for (const user of users) {
    const schedules = await all<{ id: string; enabled: number; next_run_at: string | null; sources: string }>("SELECT id, enabled, next_run_at, sources FROM scheduled_searches WHERE user_id = ? AND enabled = 1", [user.id]);
    for (const schedule of schedules) {
      if (schedule.next_run_at && new Date(schedule.next_run_at).getTime() > Date.now()) continue;
      try {
        const sources = parseJson<string[]>(schedule.sources, []);
        await runDiscovery(user.id, { sourceKeys: Array.isArray(sources) && sources.length ? sources : undefined, match: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { run } = await import("@/lib/db");
        await run("UPDATE scheduled_searches SET last_run_at=?, next_run_at=?, updated_at=? WHERE id=?", [new Date().toISOString(), new Date(Date.now() + 86400000).toISOString(), new Date().toISOString(), schedule.id]);
      } catch (error) {
        results.push({ userId: user.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    await processAutomationTasks(user.id, 4);
  }
  return NextResponse.json({ ok: true, users: users.length, results });
}



