import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail, getPermissionsForUser } from "@/lib/repositories";
import { assertPermission } from "@/lib/permissions";
import { canTransition } from "@/lib/permissions";
import { affectedRows, newId, nowIso, transaction } from "@/lib/db";
import { assertSameOrigin } from "@/lib/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body) || body.reviewed !== true) {
      return NextResponse.json({ error: "Review the application materials and answers, then confirm before approving." }, { status: 400 });
    }
    const permissions = await getPermissionsForUser(user.id);
    assertPermission(permissions, "submit_application");
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const from = detail.application.state;
    if (!canTransition(from, "Approved")) return NextResponse.json({ error: `Cannot approve from ${from}.` }, { status: 400 });
    const now = nowIso();
    await transaction(async (db) => {
      const updated = await db.run(
        "UPDATE applications SET state='Approved', approval_required=0, approved_at=?, last_event_at=?, updated_at=? WHERE id=? AND user_id=? AND state=?",
        [now, now, now, id, user.id, from],
      );
      if (affectedRows(updated) !== 1) throw new Error("Application changed during review. Reload it and review again before approving.");
      await db.run(
        "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.approved', ?, 'Approved', '{}', ?)",
        [newId("evt"), id, user.id, from, now],
      );
    });
    return NextResponse.json({ ok: true, state: "Approved" });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as Error & { status: number }).status) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve." }, { status });
  }
}

