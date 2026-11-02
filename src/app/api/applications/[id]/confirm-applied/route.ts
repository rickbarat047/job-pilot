import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { canTransition } from "@/lib/permissions";
import { newId, nowIso, run } from "@/lib/db";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (!canTransition(detail.application.state, "Applied")) return NextResponse.json({ error: `Cannot mark applied from ${detail.application.state}.` }, { status: 400 });
    const now = nowIso();
    await run("UPDATE applications SET state='Applied', applied_at=?, last_event_at=?, updated_at=?, notes=COALESCE(notes,'') || ? WHERE id=? AND user_id=?", [now, now, now, `\nUser confirmed manual submission on ${now}. ${body.note ?? ""}`, id, user.id]);
    await run("INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.user_confirmed', ?, 'Applied', ?, ?)", [newId("evt"), id, user.id, detail.application.state, JSON.stringify(body), now]);
    return NextResponse.json({ ok: true, state: "Applied" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to confirm." }, { status: 400 });
  }
}

