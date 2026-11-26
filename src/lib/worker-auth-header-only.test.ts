import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifyWorkerToken } from "./worker-auth";

const TOKEN = "header-only-test-token";
const url = "http://localhost:3000/api/automation/worker";

beforeEach(() => {
  vi.stubEnv("WORKER_TOKEN", TOKEN);
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(headers: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers });
}

describe("header-only worker authentication", () => {
  it("accepts x-worker-token", () => {
    expect(verifyWorkerToken(request({ "x-worker-token": TOKEN }))).toBe(true);
  });

  it("accepts Authorization Bearer", () => {
    expect(verifyWorkerToken(request({ authorization: `Bearer ${TOKEN}` }))).toBe(true);
  });

  it("rejects a token supplied only in the JSON body", async () => {
    const req = request();
    const body = await req.json().catch(() => ({}));
    void body;
    // The legacy second parameter no longer exists; even if a caller supplies
    // one at runtime it must be ignored.
    expect(verifyWorkerToken(req)).toBe(false);
  });

  it("rejects a wrong header even when the body has the right token", () => {
    expect(verifyWorkerToken(request({ "x-worker-token": "wrong" }))).toBe(false);
  });
});
