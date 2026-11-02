import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { getDb, newId, nowIso, run } from "@/lib/db";
import { createNotification } from "@/lib/repositories";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    getDb();
    const { id } = await context.params;
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
    const now = nowIso();
    await run(
      "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.reply_received', ?, ?, ?, ?)",
      [newId("evt"), id, user.id, detail.application.state, detail.application.state, JSON.stringify({ note, channel: body.channel ?? "email" }), now],
    );
    await run("UPDATE applications SET last_event_at=?, updated_at=? WHERE id=? AND user_id=?", [now, now, id, user.id]);
    await createNotification(user.id, "application", "Reply received", `A reply was recorded for ${detail.job.title} at ${detail.job.company}.`, `/applications/${id}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record reply." }, { status: 400 });
  }
}
