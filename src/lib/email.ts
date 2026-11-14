import nodemailer, { type TransportOptions } from "nodemailer";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { get, run, nowIso, newId } from "./db";
import { readFile } from "./storage";

type Row2 = Record<string, unknown>;

function encryptionKey(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  } catch { /* ignore */ }
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(value: string): string {
  const key = encryptionKey();
  if (!key) throw new Error("APP_ENCRYPTION_KEY is required to store email credentials.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(value: string): string {
  const key = encryptionKey();
  if (!key) throw new Error("APP_ENCRYPTION_KEY is required to read email credentials.");
  const [ivHex, tagHex, dataHex] = value.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(dataHex, "hex")) + decipher.final("utf8");
}

export interface SendEmailInput {
  userId: string;
  applicationId?: string | null;
  to: string;
  subject: string;
  body: string;
  attachments?: { filename: string; path: string }[];
  demoMode?: boolean;
}

export interface SendEmailResult {
  ok: boolean;
  status: "sent" | "simulated" | "blocked" | "failed";
  messageId?: string;
  error?: string;
  emailId: string;
}

export async function sendApplicationEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const row = await get<Record<string, unknown>>("SELECT * FROM email_integrations WHERE user_id = ?", [input.userId]);
  const envConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
  const hasIntegration = Boolean(row?.smtp_password_enc && row?.smtp_host);
  const emailId = newId("eml");

  if (input.demoMode) {
    await run(
      "INSERT INTO email_messages (id, user_id, application_id, to_email, subject, body, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, 'simulated', 'Demo mode is enabled; no email was sent.', ?)",
      [emailId, input.userId, input.applicationId ?? null, input.to, input.subject, input.body, nowIso()],
    );
    return { ok: false, status: "simulated", error: "Demo mode is enabled; no email was sent.", emailId };
  }

  let transportConfig: TransportOptions | null = null;
  let from = process.env.SMTP_FROM || "JobPilot AI <no-reply@example.com>";
  if (hasIntegration) {
    const password = decryptSecret(String(row!.smtp_password_enc));
    transportConfig = {
      host: String(row!.smtp_host),
      port: Number(row!.smtp_port || 587),
      secure: Number(row!.smtp_secure) === 1,
      auth: { user: String(row!.smtp_user), pass: password },
    } as TransportOptions;
    if (row!.from_email) from = String(row!.from_email);
  } else if (envConfigured) {
    transportConfig = {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    } as TransportOptions;
    if (process.env.SMTP_FROM) from = process.env.SMTP_FROM;
  }

  if (!transportConfig) {
    await run(
      "INSERT INTO email_messages (id, user_id, application_id, to_email, subject, body, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, 'blocked', 'No email integration is configured.', ?)",
      [emailId, input.userId, input.applicationId ?? null, input.to, input.subject, input.body, nowIso()],
    );
    return { ok: false, status: "blocked", error: "No email integration is configured.", emailId };
  }

  await run(
    "INSERT INTO email_messages (id, user_id, application_id, to_email, subject, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)",
    [emailId, input.userId, input.applicationId ?? null, input.to, input.subject, input.body, nowIso()],
  );

  try {
    const transporter = nodemailer.createTransport(transportConfig);
    // Storage is async and may be backed by Supabase, so load every attachment
    // before handing the message to nodemailer. Never expose a filesystem path.
    const attachments = await Promise.all(
      (input.attachments ?? []).map(async (attachment) => ({
        filename: attachment.filename,
        content: await readFile(attachment.path),
      })),
    );
    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
      attachments,
    });
    await run(
      "UPDATE email_messages SET status='sent', provider_id=?, sent_at=? WHERE id=?",
      [info.messageId, nowIso(), emailId],
    );
    return { ok: true, status: "sent", messageId: info.messageId, emailId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await run("UPDATE email_messages SET status='failed', error=? WHERE id=?", [message, emailId]);
    return { ok: false, status: "failed", error: message, emailId };
  }
}






