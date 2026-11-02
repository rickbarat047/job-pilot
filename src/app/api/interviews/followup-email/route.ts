import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { newId, nowIso, run } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const detail = await getApplicationDetail(user.id, String(body.applicationId ?? ""));
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const subject = `Following up — ${detail.job.title} application`;
    const emailBody = `Dear Hiring Team at ${detail.job.company},

I hope you are well. I am following up on my application for the ${detail.job.title} role submitted on ${detail.application.appliedAt ?? "recently"}.

I remain very interested in contributing to ${detail.job.company}. Please let me know if you need any additional information, work samples or references.

Thank you for your time.

Regards,
Candidate`;
    const id = newId("eml");
    const now = nowIso();
    await run("INSERT INTO email_messages (id, user_id, application_id, to_email, subject, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)", [id, user.id, detail.application.id, "", subject, emailBody, now]);
    return NextResponse.json({ id, subject, body: emailBody });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate follow-up." }, { status: 400 });
  }
}

