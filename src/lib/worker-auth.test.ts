import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { verifyWorkerToken, configuredWorkerToken } from "./worker-auth";

function makeRequest(headers: Record<string, string> = {}, body?: unknown): Request {
  return new Request("http://localhost/api/automation/worker/tasks/claim", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("worker auth", () => {
  const originalToken = process.env.WORKER_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.WORKER_TOKEN = "super-secret-token-123";
    (process.env as any).NODE_ENV = "test";
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.WORKER_TOKEN;
    else process.env.WORKER_TOKEN = originalToken;
    if (originalNodeEnv === undefined) delete (process.env as any).NODE_ENV;
    else (process.env as any).NODE_ENV = originalNodeEnv;
  });

  it("accepts the x-worker-token header", () => {
    const request = makeRequest({ "x-worker-token": "super-secret-token-123" });
    expect(verifyWorkerToken(request)).toBe(true);
  });

  it("accepts a bearer token", () => {
    const request = makeRequest({ authorization: "Bearer super-secret-token-123" });
    expect(verifyWorkerToken(request)).toBe(true);
  });

  it("accepts a token in the request body", () => {
    const request = makeRequest({}, { token: "super-secret-token-123" });
    expect(verifyWorkerToken(request, "super-secret-token-123")).toBe(true);
  });

  it("rejects a missing token", () => {
    const request = makeRequest();
    expect(verifyWorkerToken(request)).toBe(false);
  });

  it("rejects a wrong token without leaking length", () => {
    const request = makeRequest({ "x-worker-token": "wrong" });
    expect(verifyWorkerToken(request)).toBe(false);
  });

  it("rejects a token that differs only at the end", () => {
    const request = makeRequest({ "x-worker-token": "super-secret-token-124" });
    expect(verifyWorkerToken(request)).toBe(false);
  });

  it("fails closed in production when no token is configured", () => {
    delete process.env.WORKER_TOKEN;
    (process.env as any).NODE_ENV = "production";
    expect(configuredWorkerToken()).toBe("");
    const request = makeRequest({ "x-worker-token": "anything" });
    expect(verifyWorkerToken(request)).toBe(false);
  });
});
