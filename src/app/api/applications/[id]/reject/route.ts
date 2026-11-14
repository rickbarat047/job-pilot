import { NextResponse } from "next/server";
import { assertSameOrigin, requireApiUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { canTransition } from "@/lib/permissions";
import { affectedRows, newId, nowIso, transaction } from "@/lib/db";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.length > 2000)) {
      return NextResponse.json({ error: "Rejection note must be text and 2,000 characters or fewer." }, { status: 400 });
    }
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const to = body.state === "Rejected" ? "Rejected" : "Rejected";
    if (!canTransition(detail.application.state, to)) return NextResponse.json({ error: `Cannot reject from ${detail.application.state}.` }, { status: 400 });
    const now = nowIso();
    await transaction(async (db) => {
      const updated = await db.run("UPDATE applications SET state='Rejected', last_event_at=?, updated_at=?, notes=COALESCE(notes,'') || ? WHERE id=? AND user_id=? AND state=?", [now, now, `\nMarked rejected: ${body.reason ?? ""}`, id, user.id, detail.application.state]);
      if (affectedRows(updated) !== 1) throw new Error("Application status changed. Refresh and try again.");
      await db.run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.rejected', ?, 'Rejected', ?, ?)", [newId("evt"), id, user.id, detail.application.state, JSON.stringify({ reason: body.reason ?? "" }), now]);
    });
    return NextResponse.json({ ok: true, state: "Rejected" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update." }, { status: 400 });
  }
}

