import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  dbGet: vi.fn(),
  workerIsOnline: vi.fn(),
  isAIEnabled: vi.fn(),
  resolveStorageProvider: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ get: mocks.dbGet }));
vi.mock("@/lib/automation", () => ({ workerIsOnline: mocks.workerIsOnline }));
vi.mock("@/lib/ai/provider", () => ({ isAIEnabled: mocks.isAIEnabled }));
vi.mock("@/lib/storage", () => ({ resolveStorageProvider: mocks.resolveStorageProvider }));
vi.mock("@/lib/logger", () => ({
  logger: { info: mocks.loggerInfo, error: mocks.loggerError },
}));

import { GET, overallStatus, type HealthComponents } from "./route";

const healthy: HealthComponents = {
  frontend: "ok",
  database: "ok",
  authentication: "ok",
  storage: "ok",
  ai: "configured",
  worker: "online",
  email: "configured",
};

describe("overallStatus", () => {
  it("is ok when every component is healthy", () => {
    expect(overallStatus(healthy)).toBe("ok");
  });

  it("is error when the database is unavailable", () => {
    expect(overallStatus({ ...healthy, database: "unavailable" })).toBe("error");
  });

  it("is degraded when the browser worker is offline", () => {
    expect(overallStatus({ ...healthy, worker: "offline" })).toBe("degraded");
  });

  it("is degraded when AI is in deterministic fallback", () => {
    expect(overallStatus({ ...healthy, ai: "fallback" })).toBe("degraded");
  });

  it("is degraded when storage, authentication or email is unavailable", () => {
    expect(overallStatus({ ...healthy, storage: "unavailable" })).toBe("degraded");
    expect(overallStatus({ ...healthy, authentication: "unavailable" })).toBe("degraded");
    expect(overallStatus({ ...healthy, email: "unconfigured" })).toBe("degraded");
  });
});

describe("GET /api/health component status", () => {
  const saved = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbGet.mockResolvedValue({ ok: 1 });
    mocks.workerIsOnline.mockResolvedValue(true);
    mocks.isAIEnabled.mockReturnValue(true);
    mocks.resolveStorageProvider.mockReturnValue("supabase");
    process.env.RESEND_API_KEY = "test-key";
  });

  afterEach(() => {
    for (const key of ["RESEND_API_KEY", "SMTP_HOST", "SMTP_USER"] as const) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("reports ok with 200 when all probes pass", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(body.authentication).toBe("ok");
    expect(body.storage).toBe("ok");
    expect(body.worker).toBe("online");
    expect(body.ai).toBe("configured");
    expect(body.timestamp).toBeTruthy();
  });

  it("reports degraded with 200 when the worker is offline but the database is ok", async () => {
    mocks.workerIsOnline.mockResolvedValue(false);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.worker).toBe("offline");
    expect(body.database).toBe("ok");
  });

  it("reports degraded when AI is in fallback mode", async () => {
    mocks.isAIEnabled.mockReturnValue(false);
    const body = await (await GET()).json();
    expect(body.status).toBe("degraded");
    expect(body.ai).toBe("fallback");
  });

  it("reports degraded when storage is unconfigured", async () => {
    mocks.resolveStorageProvider.mockImplementation(() => {
      throw new Error("storage not configured");
    });
    const body = await (await GET()).json();
    expect(body.status).toBe("degraded");
    expect(body.storage).toBe("unavailable");
  });

  it("reports error with 503 when the database probe fails", async () => {
    mocks.dbGet.mockRejectedValue(new Error("db down"));
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("error");
    expect(body.database).toBe("unavailable");
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("logs the real status instead of an unconditional ok:true", async () => {
    mocks.workerIsOnline.mockResolvedValue(false);
    await GET();
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "Health check completed",
      expect.objectContaining({ status: "degraded", database: "ok", worker: "offline" }),
    );
    expect(mocks.loggerInfo).not.toHaveBeenCalledWith(
      "Health check completed",
      expect.objectContaining({ ok: true }),
    );
  });
});
