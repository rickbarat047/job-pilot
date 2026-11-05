import webpush from "web-push";
import { all, get } from "./db";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:noreply@jobpilot.ai";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!publicKey || !privateKey) return 0;
  const subs = await all<{ endpoint: string; p256dh: string; auth: string }>(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    [userId],
  );
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (err: any) {
      // 410 Gone / 404 → subscription expired, remove it
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await (await import("./db")).run("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?", [userId, sub.endpoint]);
      }
    }
  }
  return sent;
}