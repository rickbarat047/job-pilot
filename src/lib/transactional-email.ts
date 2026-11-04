import { Resend } from "resend";
import { get, run } from "./db";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || "JobPilot AI <noreply@jobpilot.ai>";
const resend = apiKey ? new Resend(apiKey) : null;

export interface SystemEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export async function sendSystemEmail(input: SystemEmailInput): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured." };
  if (!input.to) return { ok: false, error: "No recipient." };
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html || `<p>${escapeHtml(input.text || "")}</p>`,
      text: input.text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Best-effort: send a transactional email for a notification if Resend is
 * configured and the user has an email address. Never throws.
 */
export async function emailNotification(userId: string, title: string, body: string, actionUrl?: string): Promise<void> {
  if (!resend) return;
  try {
    const user = await get<{ email: string }>("SELECT email FROM users WHERE id = ?", [userId]);
    if (!user?.email) return;
    const link = actionUrl ? `${process.env.APP_URL || ""}${actionUrl}` : "";
    await sendSystemEmail({
      to: user.email,
      subject: title,
      text: body + (link ? `\n\n${link}` : ""),
      html: `<p>${escapeHtml(body)}</p>${link ? `<p><a href="${link}">Open in JobPilot</a></p>` : ""}`,
    });
  } catch {
    // Never let email failures break notification creation.
  }
}
