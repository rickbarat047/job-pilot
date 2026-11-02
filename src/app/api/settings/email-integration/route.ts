import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/email";
import { get, run, nowIso } from "@/lib/db";

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = str(value);
    if (text) return text;
  }
  return "";
}

export async function GET() {
  try {
    const user = await requireApiUser();
    const row = await get<Record<string, unknown>>("SELECT provider, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password_enc, status FROM email_integrations WHERE user_id = ?", [user.id]);
    if (!row) {
      return NextResponse.json({
        integration: {
          provider: "smtp", fromEmail: null, host: null, port: null, secure: false,
          user: null, configured: false, hasPassword: false, status: "not_configured",
        },
      });
    }
    const hasPassword = Boolean(row.smtp_password_enc);
    return NextResponse.json({
      integration: {
        provider: String(row.provider ?? "smtp"),
        fromEmail: row.from_email ? String(row.from_email) : null,
        host: row.smtp_host ? String(row.smtp_host) : null,
        port: row.smtp_port === null || row.smtp_port === undefined ? null : Number(row.smtp_port),
        secure: Number(row.smtp_secure) === 1,
        user: row.smtp_user ? String(row.smtp_user) : null,
        configured: Boolean(row.smtp_host && row.smtp_user && hasPassword),
        hasPassword,
        status: String(row.status ?? "not_configured"),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json().catch(() => ({}));
    const now = nowIso();

    // Accept both the camelCase contract used by the app and the snake_case
    // names exposed by the database, so older clients keep working.
    const provider = firstString(body.provider) || "smtp";
    const fromEmail = firstString(body.fromEmail, body.from_email) || null;
    const host = firstString(body.host, body.smtp_host) || null;
    const userValue = firstString(body.user, body.smtp_user) || null;
    const rawPort = body.port ?? body.smtp_port;
    const port = rawPort === "" || rawPort === null || rawPort === undefined ? null : Number(rawPort);
    const secure = Boolean(body.secure ?? body.smtp_secure);
    const password = str(body.password);

    if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) {
      return NextResponse.json({ error: "SMTP port must be a number between 1 and 65535." }, { status: 400 });
    }
    if (host && !/^[a-z0-9.-]+$/i.test(host)) {
      return NextResponse.json({ error: "Enter a valid SMTP host, for example smtp.gmail.com." }, { status: 400 });
    }
    if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return NextResponse.json({ error: "Enter a valid from email address." }, { status: 400 });
    }

    const encrypted = password ? encryptSecret(password) : null;
    const existing = await get<{ user_id: string; smtp_password_enc: string | null }>("SELECT user_id, smtp_password_enc FROM email_integrations WHERE user_id = ?", [user.id]);
    const hasPassword = Boolean(encrypted || existing?.smtp_password_enc);
    const status = host && userValue && hasPassword ? "configured" : "not_configured";

    if (existing) {
      await run(
        `UPDATE email_integrations SET provider=?, from_email=?, smtp_host=?, smtp_port=?, smtp_secure=?, smtp_user=?,
         smtp_password_enc=COALESCE(?, smtp_password_enc), status=?, updated_at=? WHERE user_id=?`,
        [provider, fromEmail, host, port, secure ? 1 : 0, userValue, encrypted, status, now, user.id],
      );
    } else {
      await run(
        `INSERT INTO email_integrations (user_id, provider, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password_enc, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.id, provider, fromEmail, host, port, secure ? 1 : 0, userValue, encrypted, status, now],
      );
    }
    return NextResponse.json({ ok: true, status, configured: status === "configured" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save email integration." }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const user = await requireApiUser();
    await run("DELETE FROM email_integrations WHERE user_id = ?", [user.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove email integration." }, { status: 400 });
  }
}
