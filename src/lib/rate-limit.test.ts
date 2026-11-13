import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkRateLimit, clearRateLimits, clientIp } from "./rate-limit";

describe("rate limiting", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUrl = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

  beforeEach(() => {
    clearRateLimits();
    delete process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
    (process.env as any).NODE_ENV = "test";
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete (process.env as any).NODE_ENV;
    else (process.env as any).NODE_ENV = originalNodeEnv;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
    else process.env.UPSTASH_REDIS_REST_KV_REST_API_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
    else process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN = originalToken;
    clearRateLimits();
  });

  it("uses the bounded local fallback outside production", async () => {
    const first = await checkRateLimit("local:key", 1, 60_000);
    const second = await checkRateLimit("local:key", 1, 60_000);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.retryAfter).toBeGreaterThan(0);
  });

  it("fails closed in production when shared rate limiting is not configured", async () => {
    (process.env as any).NODE_ENV = "production";
    const result = await checkRateLimit("prod:key", 1, 60_000);
    expect(result.ok).toBe(false);
    expect(result.unavailable).toBe(true);
  });

  it("clears local buckets", async () => {
    await checkRateLimit("clear:key", 1, 60_000);
    clearRateLimits();
    const result = await checkRateLimit("clear:key", 1, 60_000);
    expect(result.ok).toBe(true);
  });

  it("prefers x-real-ip for client identification", () => {
    const request = new Request("http://localhost", { headers: { "x-real-ip": "203.0.113.10", "x-forwarded-for": "198.51.100.1" } });
    expect(clientIp(request)).toBe("203.0.113.10");
  });
});