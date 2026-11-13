import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
  unavailable?: boolean;
}

function localCheckRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size > 1000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
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

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  if (url && token) return { url, token };
  return null;
}

let redisClient: import("@upstash/redis").Redis | null = null;
let redisConfigKey: string | null = null;

function getRedisClient(): Redis | null {
  const config = upstashConfig();
  if (!config) return null;
  const key = `${config.url}:${config.token}`;
  if (!redisClient || redisConfigKey !== key) {
    redisClient = new Redis({ url: config.url, token: config.token });
    redisConfigKey = key;
  }
  return redisClient;
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === "production") {
    try {
      const redis = getRedisClient();
      if (!redis) {
        return { ok: false, retryAfter: 0, unavailable: true };
      }
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
        analytics: false,
        prefix: "jobpilot",
      });
      const result = await ratelimit.limit(key);
      if (result.success) return { ok: true, retryAfter: 0 };
      return {
        ok: false,
        retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    } catch {
      return { ok: false, retryAfter: 0, unavailable: true };
    }
  }
  return localCheckRateLimit(key, limit, windowMs);
}

export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "local";
}

export function clearRateLimits(): void {
  buckets.clear();
}