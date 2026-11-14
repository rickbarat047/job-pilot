import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { nowIso, run } from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (!["Draft Ready", "Awaiting Approval"].includes(detail.application.state)) {
      return NextResponse.json({ error: "Answers can only be edited before approving the application." }, { status: 409 });
    }

    const body = await request.json();
    if (!Array.isArray(body.answers) || body.answers.length > 50) {
      return NextResponse.json({ error: "Invalid answer list." }, { status: 400 });
    }
    const allowed = new Set(detail.questions.map((question) => question.id));
    const answers: { id: string; answer: string }[] = [];
    for (const item of body.answers) {
      if (!item || typeof item.id !== "string" || typeof item.answer !== "string" || item.answer.length > 10000) {
        return NextResponse.json({ error: "Each answer must have a valid question and be under 10,000 characters." }, { status: 400 });
      }
      if (!allowed.has(item.id)) return NextResponse.json({ error: "A question was not found for this application." }, { status: 400 });
      answers.push({ id: item.id, answer: item.answer.trim() });
    }
    const now = nowIso();
    for (const item of answers) {
      await run("UPDATE application_questions SET answer=?, status='draft' WHERE id=? AND application_id=?", [item.answer, item.id, id]);
    }
    await run("UPDATE applications SET updated_at=? WHERE id=? AND user_id=?", [now, id, user.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save answers." }, { status: 400 });
  }
}
