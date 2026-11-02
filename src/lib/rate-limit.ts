type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Small in-process rate limiter for local/single-instance deployments.
 * Production on Vercel should replace this with Upstash/Redis or platform WAF.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}

export function clearRateLimits(): void {
  buckets.clear();
}

