import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  workerIsOnline: vi.fn(),
  isAIEnabled: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ get: mocks.get }));
vi.mock("@/lib/automation", () => ({ workerIsOnline: mocks.workerIsOnline }));
vi.mock("@/lib/ai/provider", () => ({ isAIEnabled: mocks.isAIEnabled }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.loggerError, info: mocks.loggerInfo } }));

import { GET } from "./route";

describe("health route readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ ok: 1 });
    mocks.workerIsOnline.mockResolvedValue(true);
    mocks.isAIEnabled.mockReturnValue(true);
  });

  it("returns ready only when database, AI and worker are available", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", database: "ok", ai: "configured", worker: "online" });
  });

  it("uses a failing HTTP status when the browser worker is offline", async () => {
    mocks.workerIsOnline.mockResolvedValue(false);
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", database: "ok", ai: "configured", worker: "offline" });
  });

  it("uses a failing HTTP status when AI is not configured", async () => {
    mocks.isAIEnabled.mockReturnValue(false);
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", database: "ok", ai: "fallback", worker: "online" });
  });

  it("returns unavailable when the database check fails", async () => {
    mocks.get.mockRejectedValue(new Error("database unavailable"));
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ status: "error", database: "unavailable" });
    expect(mocks.loggerError).toHaveBeenCalledOnce();
  });
});
