import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

describe("dev seed route", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    (process.env as any).NODE_ENV = "test";
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete (process.env as any).NODE_ENV;
    else (process.env as any).NODE_ENV = originalNodeEnv;
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("is unavailable in production", async () => {
    (process.env as any).NODE_ENV = "production";
    const response = await POST(new Request("http://localhost/api/dev/seed", { method: "POST" }));
    expect(response.status).toBe(404);
  });

  it("rejects requests when no secret is configured", async () => {
    const response = await POST(new Request("http://localhost/api/dev/seed", { method: "POST" }));
    expect(response.status).toBe(403);
  });

  it("rejects requests with the wrong secret", async () => {
    process.env.CRON_SECRET = "expected-secret";
    const response = await POST(
      new Request("http://localhost/api/dev/seed", {
        method: "POST",
        headers: { "x-cron-secret": "wrong-secret" },
      }),
    );
    expect(response.status).toBe(403);
  });
});