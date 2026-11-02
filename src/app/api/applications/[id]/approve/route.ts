import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail, getPermissionsForUser } from "@/lib/repositories";
import { assertPermission } from "@/lib/permissions";
import { canTransition } from "@/lib/permissions";
import { getDb, newId, nowIso, run, get } from "@/lib/db";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const permissions = await getPermissionsForUser(user.id);
    assertPermission(permissions, "submit_application");
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const from = detail.application.state;
    if (!canTransition(from, "Approved")) return NextResponse.json({ error: `Cannot approve from ${from}.` }, { status: 400 });
    const now = nowIso();
    await run("UPDATE applications SET state='Approved', approval_required=0, approved_at=?, last_event_at=?, updated_at=? WHERE id=? AND user_id=?", [now, now, now, id, user.id]);
    await run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.approved', ?, 'Approved', '{}', ?)", [newId("evt"), id, user.id, from, now]);
    return NextResponse.json({ ok: true, state: "Approved" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve." }, { status: 400 });
  }
}

