import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getInterviewData } from "@/lib/repositories";
import { getApplicationDetail } from "@/lib/repositories";
import { newId, nowIso, run } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json(await getInterviewData(user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const applicationId = String(body.applicationId ?? "");
    const detail = await getApplicationDetail(user.id, applicationId);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const questions = [
      `Tell me about yourself and why you are interested in ${detail.job.title} at ${detail.job.company}.`,
      `What relevant projects or experience prepare you for this role?`,
      `How would you handle ${detail.match?.gaps?.[0] ?? "a challenging task you have not done before"}?`,
      "Describe a time you solved a problem with limited information.",
      "How do you prioritize tasks when deadlines overlap?",
      "What are your salary expectations and availability?",
    ];
    const id = newId("int");
    const now = nowIso();
    await run(
      "INSERT INTO interview_sessions (id, user_id, application_id, type, status, questions, answers, created_at, updated_at) VALUES (?, ?, ?, 'prep', 'active', ?, '[]', ?, ?)",
      [id, user.id, applicationId, JSON.stringify(questions), now, now],
    );
    return NextResponse.json({ id, questions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create interview prep." }, { status: 400 });
  }
}

