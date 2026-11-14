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
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (!canTransition(detail.application.state, "Withdrawn")) return NextResponse.json({ error: `Cannot withdraw from ${detail.application.state}.` }, { status: 400 });
    const now = nowIso();
    await transaction(async (db) => {
      const updated = await db.run("UPDATE applications SET state='Withdrawn', last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state=?", [now, now, id, user.id, detail.application.state]);
      if (affectedRows(updated) !== 1) throw new Error("Application status changed. Refresh and try again.");
      await db.run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.withdrawn', ?, 'Withdrawn', '{}', ?)", [newId("evt"), id, user.id, detail.application.state, now]);
    });
    return NextResponse.json({ ok: true, state: "Withdrawn" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to withdraw." }, { status: 400 });
  }
}

