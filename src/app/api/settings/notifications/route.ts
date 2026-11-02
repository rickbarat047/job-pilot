import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { get, run, nowIso } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireApiUser();
    const row = await get<Record<string, unknown>>("SELECT * FROM notification_preferences WHERE user_id = ?", [user.id]);
    return NextResponse.json({ preferences: row ?? {} });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const now = nowIso();
    await run(
      `INSERT INTO notification_preferences (user_id, email_enabled, daily_digest, application_updates, interview_reminders, frequency, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET email_enabled=excluded.email_enabled, daily_digest=excluded.daily_digest,
         application_updates=excluded.application_updates, interview_reminders=excluded.interview_reminders,
         frequency=excluded.frequency, updated_at=excluded.updated_at`,
      [user.id, body.emailEnabled ? 1 : 0, body.dailyDigest ? 1 : 0, body.applicationUpdates ? 1 : 0, body.interviewReminders ? 1 : 0, body.frequency ?? "daily", now],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save notification preferences." }, { status: 400 });
  }
}

