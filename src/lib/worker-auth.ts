import { timingSafeEqual } from "node:crypto";

export function configuredWorkerToken(): string {
  const configured = process.env.WORKER_TOKEN;
  if (configured) return configured;
  // Keep the local development default, but fail closed in production when the
  // operator forgot to configure a secret.
  return process.env.NODE_ENV === "production" ? "" : "change-me-local-worker-token";
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Authenticate the Playwright worker. The token can arrive as
 * `x-worker-token`, `Authorization: Bearer <token>`, or `token` in the body.
 */
export function verifyWorkerToken(request: Request, bodyToken?: unknown): boolean {
  const expected = configuredWorkerToken();
  if (!expected) return false;
  const header = request.headers.get("x-worker-token")
    ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? "";
  const provided = header || (typeof bodyToken === "string" ? bodyToken : "");
  if (!provided) return false;
  return safeEqual(provided, expected);
}
