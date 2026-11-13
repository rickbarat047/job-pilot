import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor() {
      throw new Error("UPSTASH_REDIS_REST_KV_REST_API_URL=secret-token");
    }
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    limit = vi.fn();
    constructor() {}
    static slidingWindow() {
      return "limiter";
    }
  },
}));

import { checkRateLimit } from "./rate-limit";

describe("shared Upstash Redis construction failure", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUrl = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

  beforeEach(() => {
    (process.env as any).NODE_ENV = "production";
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN = "secret-token";
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete (process.env as any).NODE_ENV;
    else (process.env as any).NODE_ENV = originalNodeEnv;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
    else process.env.UPSTASH_REDIS_REST_KV_REST_API_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
    else process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN = originalToken;
  });

  it("fails closed without exposing Redis constructor details", async () => {
    const result = await checkRateLimit("shared:key", 10, 60_000);
    expect(result).toEqual({ ok: false, retryAfter: 0, unavailable: true });
  });
});