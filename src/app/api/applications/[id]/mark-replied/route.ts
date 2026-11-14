import { NextResponse } from "next/server";
import { assertSameOrigin, requireApiUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { affectedRows, newId, nowIso, transaction } from "@/lib/db";
import { createNotification } from "@/lib/repositories";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Reply details are invalid." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
    if (body.note !== undefined && typeof body.note !== "string") return NextResponse.json({ error: "Reply note must be text." }, { status: 400 });
    if (typeof body.note === "string" && body.note.length > 2000) return NextResponse.json({ error: "Reply note must be 2,000 characters or fewer." }, { status: 400 });
    const allowedChannels = new Set(["email", "phone", "linkedin", "portal", "other"]);
    const channel = body.channel === undefined ? "email" : body.channel;
    if (typeof channel !== "string" || !allowedChannels.has(channel)) return NextResponse.json({ error: "Reply channel is invalid." }, { status: 400 });
    if (!["Applied", "Interview", "Assessment"].includes(detail.application.state)) {
      return NextResponse.json({ error: "Record employer replies after the application has been submitted." }, { status: 400 });
    }
    const now = nowIso();
    await transaction(async (db) => {
      const result = await db.run(
        "UPDATE applications SET last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state=?",
        [now, now, id, user.id, detail.application.state],
      );
      if (affectedRows(result) !== 1) throw new Error("Application status changed. Refresh and try again.");
      await db.run(
        "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.reply_received', ?, ?, ?, ?)",
        [newId("evt"), id, user.id, detail.application.state, detail.application.state, JSON.stringify({ note, channel }), now],
      );
    });
    await createNotification(user.id, "application", "Reply received", `A reply was recorded for ${detail.job.title} at ${detail.job.company}.`, `/applications/${id}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record reply." }, { status: 400 });
  }
}
