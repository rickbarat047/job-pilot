import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail, getProfile } from "@/lib/repositories";
import { get, run, newId, nowIso } from "@/lib/db";
import { decryptSecret } from "@/lib/email";
import { checkForReplies } from "@/lib/imap";
import { createNotification } from "@/lib/repositories";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    // Get email integration settings for IMAP
    const emailRow = await get<Record<string, unknown>>("SELECT * FROM email_integrations WHERE user_id = ?", [user.id]);
    if (!emailRow?.smtp_host) {
      return NextResponse.json({ error: "No email integration configured. Set up SMTP in Settings first." }, { status: 400 });
    }

    const profile = await getProfile(user.id);
    const keywords = [detail.job.title, detail.job.company, "application", "interview", "offer"].filter(Boolean);

    // Use IMAP settings (derive from SMTP settings or separate IMAP settings)
    const imapHost = String(emailRow.smtp_host).replace("smtp.", "imap.");
    const imapPort = 993;
    const imapUser = String(emailRow.smtp_user);
    const imapPassword = decryptSecret(String(emailRow.smtp_password_enc));

    const replies = await checkForReplies(
      { host: imapHost, port: imapPort, user: imapUser, password: imapPassword, secure: true },
      keywords,
    );

    // Record any found replies as application events
    const recordedReplies: string[] = [];
    for (const reply of replies) {
      const eventDetail = JSON.stringify({
        from: reply.from,
        subject: reply.subject,
        date: reply.date,
        uid: reply.uid,
      });
      await run(
        "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.reply_detected', ?, ?, ?, ?)",
        [newId("evt"), id, user.id, detail.application.state, detail.application.state, eventDetail, nowIso()],
      );
      recordedReplies.push(reply.subject);
    }

    if (replies.length > 0) {
      await createNotification(
        user.id,
        "application",
        "Email reply detected",
        `${replies.length} potential reply(ies) found for ${detail.job.title} at ${detail.job.company}.`,
        `/applications/${id}`,
      );
    }

    return NextResponse.json({
      ok: true,
      repliesFound: replies.length,
      replies: replies.map((r) => ({ from: r.from, subject: r.subject, date: r.date })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check for replies." },
      { status: 400 },
    );
  }
}
