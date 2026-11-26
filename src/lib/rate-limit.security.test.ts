import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  RATE_LIMIT_MAX_BUCKETS,
  checkRateLimit,
  clearRateLimits,
  clientIp,
  rateLimitBucketCount,
} from "./rate-limit";

function requestWithIp(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("rate limit hardening", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalTrustProxy = process.env.TRUST_PROXY_HEADERS;
  const originalUrl = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

  beforeEach(() => {
    clearRateLimits();
    delete process.env.TRUST_PROXY_HEADERS;
    delete process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
    (process.env as any).NODE_ENV = "test";
  });

  afterEach(() => {
    clearRateLimits();
    vi.useRealTimers();
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY_HEADERS;
    else process.env.TRUST_PROXY_HEADERS = originalTrustProxy;
    if (originalNodeEnv === undefined) delete (process.env as any).NODE_ENV;
    else (process.env as any).NODE_ENV = originalNodeEnv;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
    else process.env.UPSTASH_REDIS_REST_KV_REST_API_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
    else process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN = originalToken;
  });

  it("ignores spoofable IP headers by default", () => {
    expect(clientIp(requestWithIp({}))).toBe("local");
    expect(clientIp(requestWithIp({ "x-real-ip": "203.0.113.10" }))).toBe("local");
    expect(clientIp(requestWithIp({ "x-forwarded-for": "198.51.100.1, 203.0.113.9" }))).toBe("local");
    expect(clientIp(requestWithIp({ "x-real-ip": "203.0.113.10", "x-forwarded-for": "198.51.100.1" }))).toBe("local");
  });

  it("does not allow rotating spoofed IP headers to bypass a login limit", async () => {
    let allowed = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const request = requestWithIp({
        "x-real-ip": `203.0.113.${attempt + 1}`,
        "x-forwarded-for": `198.51.100.${attempt + 1}`,
      });
      const result = await checkRateLimit(`login:${clientIp(request)}`, 2, 15 * 60_000);
      if (result.ok) allowed += 1;
    }
    expect(allowed).toBe(2);
  });

  it("honours proxy headers only with an explicit opt-in", () => {
    process.env.TRUST_PROXY_HEADERS = "1";
    expect(clientIp(requestWithIp({ "x-real-ip": "203.0.113.10", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.10");
    expect(clientIp(requestWithIp({ "x-forwarded-for": "198.51.100.1, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(requestWithIp({}))).toBe("local");
  });

  it("prunes expired buckets on every call", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await checkRateLimit("prune:a", 5, 1000);
    await checkRateLimit("prune:b", 5, 1000);
    expect(rateLimitBucketCount()).toBe(2);

    vi.setSystemTime(new Date("2026-01-01T00:00:02.000Z"));
    await checkRateLimit("prune:c", 5, 1000);
    expect(rateLimitBucketCount()).toBe(1);
  });

  it("caps bucket growth deterministically, evicting the oldest entry", async () => {
    await checkRateLimit("cap:first", 1, 60_000);
    for (let i = 1; i <= RATE_LIMIT_MAX_BUCKETS + 5; i += 1) {
      await checkRateLimit(`cap:${i}`, 1, 60_000);
    }
    expect(rateLimitBucketCount()).toBeLessThanOrEqual(RATE_LIMIT_MAX_BUCKETS);
    // The oldest bucket was evicted, so its quota starts over instead of being blocked.
    expect((await checkRateLimit("cap:first", 1, 60_000)).ok).toBe(true);
    expect((await checkRateLimit("cap:first", 1, 60_000)).ok).toBe(false);
  });

  it("still fails closed in production without shared rate limiting configured", async () => {
    (process.env as any).NODE_ENV = "production";
    const result = await checkRateLimit("prod:key", 1, 60_000);
    expect(result.ok).toBe(false);
    expect(result.unavailable).toBe(true);
  });
});
