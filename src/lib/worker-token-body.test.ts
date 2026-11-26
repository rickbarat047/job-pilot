import { describe, it, expect } from "vitest";
import { buildHeartbeatBody } from "../../scripts/browser-worker-lib.mjs";

const SECRET = "super-secret-token-123";

describe("heartbeat body never carries the worker token", () => {
  it("builds a body containing only status and meta", () => {
    const body = buildHeartbeatBody("online", { worker: "playwright" }) as Record<string, unknown>;
    expect(body).toEqual({ status: "online", meta: { worker: "playwright" } });
    expect(body).not.toHaveProperty("token");
  });

  it("does not copy a mistakenly supplied legacy token argument into the body", () => {
    // Callers that were not updated must still not leak the credential into JSON.
    const legacyCall = buildHeartbeatBody as unknown as (
      status: string,
      meta?: Record<string, unknown>,
      token?: string,
    ) => Record<string, unknown>;
    const body = legacyCall("offline", { worker: "playwright" }, SECRET);
    expect(body).not.toHaveProperty("token");
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("does not carry a token supplied inside meta", () => {
    const body = buildHeartbeatBody("online", { worker: "playwright", token: SECRET }) as Record<string, unknown>;
    expect(body.meta).not.toHaveProperty("token");
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });
});
