import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  dbGet: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ get: mocks.dbGet }));

import { workerIsOnline, workerOnlineWindowMs } from "@/lib/automation";

describe("worker online window configuration", () => {
  it("defaults to twelve hours so scheduled runs stay available between invocations", () => {
    expect(workerOnlineWindowMs({})).toBe(12 * 60 * 60 * 1000);
  });

  it("accepts a positive finite override", () => {
    expect(workerOnlineWindowMs({ WORKER_ONLINE_WINDOW_MS: "600000" })).toBe(600_000);
  });

  it("ignores invalid overrides", () => {
    expect(workerOnlineWindowMs({ WORKER_ONLINE_WINDOW_MS: "0" })).toBe(12 * 60 * 60 * 1000);
    expect(workerOnlineWindowMs({ WORKER_ONLINE_WINDOW_MS: "-1" })).toBe(12 * 60 * 60 * 1000);
    expect(workerOnlineWindowMs({ WORKER_ONLINE_WINDOW_MS: "not-a-number" })).toBe(12 * 60 * 60 * 1000);
  });
});

describe("workerIsOnline", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-11-22T12:00:00.000Z").getTime());
    mocks.dbGet.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports online for a heartbeat inside the configured window", async () => {
    mocks.dbGet.mockResolvedValue({ status: "online", last_heartbeat: "2026-11-22T08:00:00.000Z" });
    await expect(workerIsOnline()).resolves.toBe(true);
  });

  it("reports offline for a heartbeat older than the configured window", async () => {
    mocks.dbGet.mockResolvedValue({ status: "online", last_heartbeat: "2026-11-21T23:59:59.000Z" });
    await expect(workerIsOnline()).resolves.toBe(false);
  });

  it("reports offline when the row is missing or not online", async () => {
    mocks.dbGet.mockResolvedValueOnce(null);
    await expect(workerIsOnline()).resolves.toBe(false);
    mocks.dbGet.mockResolvedValueOnce({ status: "offline", last_heartbeat: "2026-11-22T11:59:00.000Z" });
    await expect(workerIsOnline()).resolves.toBe(false);
  });
});
