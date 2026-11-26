import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  dbGet: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ get: mocks.dbGet }));

import { workerIsOnline, workerOnlineWindowMs, DEFAULT_WORKER_ONLINE_WINDOW_MS } from "@/lib/automation";

// The workflow is scheduled every 10 minutes with a 10-minute timeout, so a
// healthy run plus grace justifies a 30-minute (3x interval) lease — not 12h.
const LEASE_MS = 30 * 60 * 1000;

describe("worker online window configuration", () => {
  it("defaults to a 30-minute lease derived from schedule/runtime/grace", () => {
    expect(DEFAULT_WORKER_ONLINE_WINDOW_MS).toBe(LEASE_MS);
    expect(workerOnlineWindowMs({})).toBe(LEASE_MS);
  });

  it("accepts a positive finite override", () => {
    expect(workerOnlineWindowMs({ WORKER_ONLINE_WINDOW_MS: "600000" })).toBe(600_000);
  });

  it("ignores invalid overrides", () => {
    expect(workerOnlineWindowMs({ WORKER_ONLINE_WINDOW_MS: "0" })).toBe(LEASE_MS);
    expect(workerOnlineWindowMs({ WORKER_ONLINE_WINDOW_MS: "-1" })).toBe(LEASE_MS);
    expect(workerOnlineWindowMs({ WORKER_ONLINE_WINDOW_MS: "not-a-number" })).toBe(LEASE_MS);
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
    mocks.dbGet.mockResolvedValue({ status: "online", last_heartbeat: "2026-11-22T11:50:00.000Z" });
    await expect(workerIsOnline()).resolves.toBe(true);
  });

  it("reports offline for a heartbeat older than the configured window", async () => {
    mocks.dbGet.mockResolvedValue({ status: "online", last_heartbeat: "2026-11-22T11:29:59.000Z" });
    await expect(workerIsOnline()).resolves.toBe(false);
  });

  it("reports offline when the row is missing or not online", async () => {
    mocks.dbGet.mockResolvedValueOnce(null);
    await expect(workerIsOnline()).resolves.toBe(false);
    mocks.dbGet.mockResolvedValueOnce({ status: "offline", last_heartbeat: "2026-11-22T11:59:00.000Z" });
    await expect(workerIsOnline()).resolves.toBe(false);
  });
});
