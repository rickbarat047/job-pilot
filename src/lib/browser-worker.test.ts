import { describe, it, expect } from "vitest";
import {
  validateEnv,
  buildHeartbeatBody,
  ApiError,
  createApiError,
  isEmptyQueueResult,
  isAuthFailure,
  shutdownExitCode,
  shouldFailWorkflowOnHttpStatus,
} from "../../scripts/browser-worker-lib.mjs";

describe("browser worker - env validation", () => {
  it("fails clearly when APP_URL is missing", () => {
    const r = validateEnv({ WORKER_TOKEN: "t" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/APP_URL is required/);
  });
  it("fails clearly when WORKER_TOKEN is missing", () => {
    const r = validateEnv({ APP_URL: "https://example.com" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/WORKER_TOKEN is required/);
  });
  it("passes when both are present", () => {
    const r = validateEnv({ APP_URL: "https://example.com", WORKER_TOKEN: "t" });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});

describe("browser worker - heartbeat payload", () => {
  it("sends status as a top-level property for online", () => {
    const body = buildHeartbeatBody("online", { worker: "playwright" }, "secret") as any;
    expect(body.status).toBe("online");
    expect(body.meta).toEqual({ worker: "playwright" });
    expect(body.token).toBe("secret");
    expect(body.meta.status).toBeUndefined();
  });
  it("sends offline status as a top-level property, not nested in meta", () => {
    const body = buildHeartbeatBody("offline", { worker: "playwright", status: "online" }, "secret") as any;
    expect(body.status).toBe("offline");
    expect(body.meta.status).toBeUndefined();
  });
  it("throws on invalid status", () => {
    expect(() => buildHeartbeatBody("bogus", {}, "secret")).toThrow(/Invalid worker status/);
  });
});

describe("browser worker - auth failures", () => {
  it("detects 401 from ApiError", () => {
    const err = createApiError(401, "POST", "/api/automation/worker", "Invalid worker token.");
    expect(isAuthFailure(err)).toBe(true);
    expect(err.status).toBe(401);
  });
  it("does not flag non-401 errors as auth failures", () => {
    const err = createApiError(500, "POST", "/x", "boom");
    expect(isAuthFailure(err)).toBe(false);
  });
  it("ApiError is an Error instance", () => {
    const err = new ApiError(404, "GET", "/x", "not found");
    expect(err instanceof Error).toBe(true);
    expect(err.status).toBe(404);
  });
});

describe("browser worker - empty queue", () => {
  it("treats missing task as empty queue (not an error)", () => {
    expect(isEmptyQueueResult({})).toBe(true);
    expect(isEmptyQueueResult({ task: null })).toBe(true);
    expect(isEmptyQueueResult(undefined)).toBe(true);
  });
  it("treats a present task as work", () => {
    expect(isEmptyQueueResult({ task: { id: "t1" } })).toBe(false);
  });
});

describe("browser worker - http status handling", () => {
  it("flags 401, 404, and 5xx as workflow-failing", () => {
    expect(shouldFailWorkflowOnHttpStatus(401)).toBe(true);
    expect(shouldFailWorkflowOnHttpStatus(404)).toBe(true);
    expect(shouldFailWorkflowOnHttpStatus(500)).toBe(true);
    expect(shouldFailWorkflowOnHttpStatus(503)).toBe(true);
  });
  it("does not flag 2xx/400 as workflow-failing", () => {
    expect(shouldFailWorkflowOnHttpStatus(200)).toBe(false);
    expect(shouldFailWorkflowOnHttpStatus(400)).toBe(false);
  });
});

describe("browser worker - shutdown exit code", () => {
  it("returns 1 when processing failed, even if offline heartbeat succeeded", () => {
    expect(shutdownExitCode(true, false)).toBe(1);
  });
  it("returns 1 when offline heartbeat failed", () => {
    expect(shutdownExitCode(false, true)).toBe(1);
  });
  it("returns 0 when both succeeded", () => {
    expect(shutdownExitCode(false, false)).toBe(0);
  });
  it("returns 1 when both failed", () => {
    expect(shutdownExitCode(true, true)).toBe(1);
  });
});
