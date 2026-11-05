import { Resend } from "resend";
import { get, all, run } from "./db";

// ... (existing code) ...

/**
 * Send a daily digest of new high-match jobs to the user via Resend.
 * Returns true if an email was sent.
 */
export async function sendMatchDigest(userId: string): Promise<boolean> {
  if (!resend) return false;
  try {
    const user = await get<{ email: string; name: string }>("SELECT email, name FROM users WHERE id = ?", [userId]);
    if (!user?.email) return false;

    // New matches in the last 24h with score >= 50
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const matches = await all<{ title: string; company_name: string; overall_score: number; application_url: string | null }>(
      `SELECT j.title, j.company_name, jm.overall_score, j.application_url
       FROM job_matches jm JOIN jobs j ON j.id = jm.job_id
       WHERE jm.user_id = ? AND jm.created_at >= ? AND jm.overall_score >= 50
       ORDER BY jm.overall_score DESC LIMIT 8`,
      [userId, since],
    );
    if (matches.length === 0) return false;

    const appUrl = process.env.APP_URL || "https://jobpilot-ai-sand.vercel.app";
    const rows = matches.map((m) =>
      `<li><strong>${escapeHtml(m.title)}</strong> at ${escapeHtml(m.company_name)} — ${Math.round(m.overall_score)}% match${m.application_url ? ` · <a href="${m.application_url}">Apply</a>` : ""}</li>`,
    ).join("");
    const html = `<p>Hi ${escapeHtml(user.name || "there")},</p>
<p>Here are your top new job matches from the last 24 hours:</p>
<ul>${rows}</ul>
<p><a href="${appUrl}/jobs">View all matches in JobPilot</a></p>`;
    const text = `Hi ${user.name || "there"},\n\nTop new matches:\n${matches.map((m) => `- ${m.title} at ${m.company_name} (${Math.round(m.overall_score)}%)`).join("\n")}\n\nView all: ${appUrl}/jobs`;

    const res = await sendSystemEmail({ to: user.email, subject: `Your JobPilot matches: ${matches.length} new role${matches.length === 1 ? "" : "s"}`, html, text });
    return res.ok;
  } catch {
    return false;
  }
}

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
