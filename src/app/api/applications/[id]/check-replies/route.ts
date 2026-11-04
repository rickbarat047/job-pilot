import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail, createNotification } from "@/lib/repositories";
import { all, get, run, newId, nowIso, parseJson } from "@/lib/db";
import { decryptSecret } from "@/lib/email";
import { checkForReplies, imapConfigFromSmtp } from "@/lib/imap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    const emailRow = await get<Record<string, unknown>>(
      "SELECT smtp_host, smtp_user, smtp_password_enc FROM email_integrations WHERE user_id = ?",
      [user.id],
    );
    if (!emailRow?.smtp_host || !emailRow?.smtp_user || !emailRow?.smtp_password_enc) {
      return NextResponse.json(
        { error: "Add your SMTP host, username and app password in Settings before checking for replies." },
        { status: 400 },
      );
    }

    let password: string;
    try {
      password = decryptSecret(String(emailRow.smtp_password_enc));
    } catch {
      return NextResponse.json(
        { error: "The saved email password could not be decrypted. Re-enter it in Settings and try again." },
        { status: 400 },
      );
    }
    if (!password) {
      return NextResponse.json(
        { error: "The saved email password is empty. Re-enter it in Settings and try again." },
        { status: 400 },
      );
    }

    // Company and role names are distinctive. Generic words like "application"
    // or "interview" would match newsletters and create false positives.
    const keywords = Array.from(
      new Set([detail.job.company, detail.job.title].map((value) => value.trim()).filter((value) => value.length >= 3)),
    );

    let replies;
    try {
      replies = await checkForReplies(
        imapConfigFromSmtp(String(emailRow.smtp_host), String(emailRow.smtp_user), password),
        keywords,
        { days: 14, limit: 25 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown IMAP error.";
      const hint = /auth|login|credentials|invalid/i.test(message)
        ? " Check that the username is your full email address and that you used an app password (not your normal password)."
        : "";
      return NextResponse.json({ error: `Could not connect to your mailbox.${hint}`, detail: message }, { status: 400 });
    }

    // A message may be present every time the user checks; record each UID once.
    const previous = await all<{ detail: string }>(
      "SELECT detail FROM application_events WHERE application_id = ? AND user_id = ? AND event_type = 'application.reply_detected'",
      [id, user.id],
    );
    const seen = new Set<number>();
    for (const row of previous) {
      const parsed = parseJson<{ uid?: number }>(row.detail, {});
      if (typeof parsed.uid === "number") seen.add(parsed.uid);
    }

    const fresh = replies.filter((reply) => !seen.has(reply.uid));
    const now = nowIso();
    for (const reply of fresh) {
      await run(
        "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.reply_detected', ?, ?, ?, ?)",
        [newId("evt"), id, user.id, detail.application.state, detail.application.state, JSON.stringify({
          uid: reply.uid,
          from: reply.from,
          subject: reply.subject,
          date: reply.date,
        }), now],
      );
    }

    if (fresh.length > 0) {
      await createNotification(
        user.id,
        "application",
        "Email reply detected",
        `${fresh.length} new ${fresh.length === 1 ? "reply" : "replies"} found for ${detail.job.title} at ${detail.job.company}.`,
        `/applications/${id}`,
      );
    }

    return NextResponse.json({
      ok: true,
      repliesFound: fresh.length,
      alreadyRecorded: replies.length - fresh.length,
      replies: fresh.map((reply) => ({ from: reply.from, subject: reply.subject, date: reply.date })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check for replies." },
      { status: 400 },
    );
  }
}
