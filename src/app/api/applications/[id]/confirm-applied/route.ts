import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { canTransition } from "@/lib/permissions";
import { affectedRows, newId, nowIso, transaction } from "@/lib/db";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Confirmation details are invalid." }, { status: 400 });
    if (body.note !== undefined && typeof body.note !== "string") return NextResponse.json({ error: "Confirmation note must be text." }, { status: 400 });
    if (typeof body.note === "string" && body.note.length > 2000) return NextResponse.json({ error: "Confirmation note must be 2,000 characters or fewer." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (detail.application.state === "Applied") return NextResponse.json({ error: "This application is already marked as submitted." }, { status: 409 });
    if (!canTransition(detail.application.state, "Applied")) return NextResponse.json({ error: `Cannot mark applied from ${detail.application.state}.` }, { status: 400 });
    const now = nowIso();
    await transaction(async (db) => {
      const result = await db.run(
        "UPDATE applications SET state='Applied', applied_at=?, last_event_at=?, updated_at=?, notes=COALESCE(notes,'') || ? WHERE id=? AND user_id=? AND state=?",
        [now, now, now, `\nUser confirmed manual submission on ${now}.${note ? ` ${note}` : ""}`, id, user.id, detail.application.state],
      );
      if (affectedRows(result) !== 1) throw new Error("Application status changed. Refresh and try again.");
      await db.run(
        "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.user_confirmed', ?, 'Applied', ?, ?)",
        [newId("evt"), id, user.id, detail.application.state, JSON.stringify({ note }), now],
      );
    });
    return NextResponse.json({ ok: true, state: "Applied" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to confirm." }, { status: 400 });
  }
}

