import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const limitMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor() {}
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    limit = limitMock;
    constructor() {}
    static slidingWindow() {
      return "limiter";
    }
  },
}));

import { checkRateLimit } from "./rate-limit";

describe("shared Upstash rate limiting", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    (process.env as any).NODE_ENV = "production";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret-token";
    limitMock.mockReset();
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete (process.env as any).NODE_ENV;
    else (process.env as any).NODE_ENV = originalNodeEnv;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it("allows requests when Upstash reports success", async () => {
    limitMock.mockResolvedValue({ success: true, reset: Date.now() + 1000 });

    const result = await checkRateLimit("shared:key", 10, 60_000);

    expect(result).toEqual({ ok: true, retryAfter: 0 });
  });

  it("denies requests with retryAfter when Upstash reports failure", async () => {
    const reset = Date.now() + 5000;
    limitMock.mockResolvedValue({ success: false, reset });

    const result = await checkRateLimit("shared:key", 10, 60_000);

    expect(result.ok).toBe(false);
    expect(result.unavailable).toBeUndefined();
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("fails closed when Upstash throws", async () => {
    limitMock.mockRejectedValue(new Error("redis unavailable"));

    const result = await checkRateLimit("shared:key", 10, 60_000);

    expect(result).toEqual({ ok: false, retryAfter: 0, unavailable: true });
  });
});