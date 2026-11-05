import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { get, run, nowIso } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const session = await get<{ id: string; user_id: string }>("SELECT id, user_id FROM interview_sessions WHERE id = ? AND user_id = ?", [id, user.id]);
    if (!session) return NextResponse.json({ error: "Interview session not found." }, { status: 404 });

    const interviewAt = typeof body.interviewAt === "string" ? body.interviewAt : null;
    const interviewType = typeof body.interviewType === "string" ? body.interviewType : null;
    const interviewLocation = typeof body.interviewLocation === "string" ? body.interviewLocation : null;
    const interviewer = typeof body.interviewer === "string" ? body.interviewer : null;

    await run(
      "UPDATE interview_sessions SET interview_at = ?, interview_type = ?, interview_location = ?, interviewer = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      [interviewAt, interviewType, interviewLocation, interviewer, nowIso(), id, user.id],
    );

    return NextResponse.json({ ok: true, id, interviewAt, interviewType, interviewLocation, interviewer });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to schedule." }, { status: 400 });
  }
}