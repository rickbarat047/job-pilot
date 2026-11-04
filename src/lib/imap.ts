import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
}

export interface EmailReply {
  uid: number;
  from: string;
  subject: string;
  date: string;
  body: string;
}

/**
 * Derive an IMAP host from the SMTP host saved in Settings.
 *
 * Most providers expose the same mailbox over IMAP with a predictable host
 * name. `IMAP_HOST` can be used to override this for a custom mail server.
 */
export function deriveImapHost(smtpHost: string): string {
  const override = process.env.IMAP_HOST?.trim();
  if (override) return override;

  const host = smtpHost.trim().toLowerCase().replace(/\.$/, "");
  const known: Record<string, string> = {
    "smtp.gmail.com": "imap.gmail.com",
    "smtp.googlemail.com": "imap.gmail.com",
    "smtp-mail.outlook.com": "outlook.office365.com",
    "smtp.office365.com": "outlook.office365.com",
    "smtp.live.com": "outlook.office365.com",
    "smtp.zoho.com": "imap.zoho.com",
    "smtp.zoho.in": "imap.zoho.in",
    "smtp.zoho.eu": "imap.zoho.eu",
    "smtp.zoho.com.au": "imap.zoho.com.au",
    "smtp.mail.yahoo.com": "imap.mail.yahoo.com",
    "smtp.mail.me.com": "imap.mail.me.com",
    "smtp.163.com": "imap.163.com",
    "smtp.126.com": "imap.126.com",
    "smtp.qq.com": "imap.qq.com",
    "smtp.yandex.com": "imap.yandex.com",
    "smtp.yandex.ru": "imap.yandex.ru",
    "smtp.fastmail.com": "imap.fastmail.com",
    "smtp.protonmail.com": "127.0.0.1",
  };
  if (known[host]) return known[host];
  if (host.startsWith("smtp.")) return `imap.${host.slice(5)}`;
  if (host.startsWith("smtp-")) return `imap-${host.slice(5)}`;
  return host;
}

export function imapConfigFromSmtp(smtpHost: string, user: string, password: string): ImapConfig {
  const port = Number(process.env.IMAP_PORT || 993);
  return {
    host: deriveImapHost(smtpHost),
    port: Number.isInteger(port) && port > 0 ? port : 993,
    user,
    password,
    // IMAP over TLS (993) is the default. Set IMAP_SECURE=false for STARTTLS
    // servers that listen on 143.
    secure: process.env.IMAP_SECURE !== "false",
  };
}

/**
 * Read recent messages from INBOX and return the ones whose sender, subject or
 * body mention one of the supplied keywords (company name, job title, ...).
 *
 * Only new messages are fetched (since `days`, capped at `limit`) and any
 * message that does not match is ignored. The full body is never stored; the
 * caller decides what to persist.
 */
export async function checkForReplies(
  config: ImapConfig,
  keywords: string[],
  options: { days?: number; limit?: number } = {},
): Promise<EmailReply[]> {
  const needles = keywords
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword) => keyword.length >= 3);
  if (!needles.length) return [];

  const days = Math.max(1, Math.min(options.days ?? 7, 30));
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    // Some shared hosts present an incomplete chain. We never send credentials
    // over an unverified connection when `secure` is true, but tolerate the
    // chain issue so self-hosted mailboxes keep working.
    tls: { rejectUnauthorized: false, servername: config.host },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 90_000,
  });

  // ImapFlow emits error events for connection problems; log them instead of
  // letting them crash the request (they are also surfaced by connect()).
  client.on("error", (error: Error) => {
    console.error("IMAP client error:", error.message);
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - days * 86_400_000);
      const found = await client.search({ since }, { uid: true });
      if (!found || found.length === 0) return [];

      const uids = found.slice(-limit);
      const replies: EmailReply[] = [];

      for await (const message of client.fetch(uids, { uid: true, envelope: true, source: true }, { uid: true })) {
        const parsed = message.source ? await simpleParser(message.source) : null;

        const envelopeFrom = message.envelope?.from?.[0];
        const parsedFrom = parsed?.from?.value?.[0];
        const fromAddress = envelopeFrom?.address || parsedFrom?.address || "";
        const fromName = envelopeFrom?.name || parsedFrom?.name || "";
        const from = fromName && fromAddress ? `${fromName} <${fromAddress}>` : fromAddress;

        const subject = message.envelope?.subject || parsed?.subject || "(no subject)";
        const rawDate = message.envelope?.date || parsed?.date || new Date();
        const dateValue = rawDate instanceof Date ? rawDate : new Date(rawDate);
        const date = Number.isNaN(dateValue.getTime()) ? new Date().toISOString() : dateValue.toISOString();
        const body = (parsed?.text || "").trim();

        const haystack = `${from}\n${subject}\n${body}`.toLowerCase();
        if (needles.some((needle) => haystack.includes(needle))) {
          replies.push({
            uid: Number(message.uid),
            from,
            subject,
            date,
            // Keep enough context for the UI but avoid storing huge newsletters.
            body: body.slice(0, 10_000),
          });
        }
      }

      return replies;
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      // The connection may already be closed; nothing else to clean up.
    }
  }
}
