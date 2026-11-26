import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  dbGet: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ get: mocks.dbGet }));

import {
  DEFAULT_WORKER_ONLINE_WINDOW_MS,
  workerIsOnline,
  workerIsProcessing,
  workerOnlineWindowMs,
  workerStatusSnapshot,
} from "@/lib/automation";

const NOW = new Date("2026-11-26T12:00:00.000Z").getTime();
const freshHeartbeat = new Date(NOW - 5 * 60_000).toISOString();
const staleHeartbeat = new Date(NOW - 45 * 60_000).toISOString();
const futureHeartbeat = new Date(NOW + 5 * 60_000).toISOString();

const row = (overrides: Record<string, unknown> = {}) => ({
  status: "online",
  last_heartbeat: freshHeartbeat,
  meta: JSON.stringify({ worker: "playwright" }),
  ...overrides,
});

describe("worker status snapshot - lease semantics", () => {
  const originalWindow = process.env.WORKER_ONLINE_WINDOW_MS;

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    mocks.dbGet.mockReset();
    delete process.env.WORKER_ONLINE_WINDOW_MS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWindow === undefined) delete process.env.WORKER_ONLINE_WINDOW_MS;
    else process.env.WORKER_ONLINE_WINDOW_MS = originalWindow;
  });

  it("reports a valid fresh heartbeat as online with a computed lease expiry", async () => {
    mocks.dbGet.mockResolvedValue(row());
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.status).toBe("online");
    expect(snapshot.lastHeartbeat).toBe(freshHeartbeat);
    expect(snapshot.meta).toEqual({ worker: "playwright" });
    expect(snapshot.online).toBe(true);
    expect(snapshot.recentlySeen).toBe(true);
    expect(snapshot.processing).toBe(false);
    expect(snapshot.leaseExpiresAt).toBe(
      new Date(new Date(freshHeartbeat).getTime() + DEFAULT_WORKER_ONLINE_WINDOW_MS).toISOString(),
    );
    await expect(workerIsOnline()).resolves.toBe(true);
  });

  it("reports active processing only when a fresh lease says processing:true", async () => {
    mocks.dbGet.mockResolvedValue(row({ meta: JSON.stringify({ worker: "playwright", processing: true }) }));
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.online).toBe(true);
    expect(snapshot.meta.processing).toBe(true);
    expect(snapshot.processing).toBe(true);
    await expect(workerIsProcessing()).resolves.toBe(true);
  });

  it("treats a stale heartbeat as recently seen but offline, even with processing:true (crash)", async () => {
    mocks.dbGet.mockResolvedValue(
      row({
        last_heartbeat: staleHeartbeat,
        meta: JSON.stringify({ worker: "playwright", processing: true }),
      }),
    );
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.recentlySeen).toBe(true);
    expect(snapshot.online).toBe(false);
    expect(snapshot.processing).toBe(false);
    expect(snapshot.leaseExpiresAt).toBe(
      new Date(new Date(staleHeartbeat).getTime() + DEFAULT_WORKER_ONLINE_WINDOW_MS).toISOString(),
    );
    await expect(workerIsOnline()).resolves.toBe(false);
    await expect(workerIsProcessing()).resolves.toBe(false);
  });

  it("does not treat a future-dated heartbeat as a valid lease", async () => {
    mocks.dbGet.mockResolvedValue(row({ last_heartbeat: futureHeartbeat }));
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.recentlySeen).toBe(true);
    expect(snapshot.online).toBe(false);
    expect(snapshot.leaseExpiresAt).toBeNull();
    await expect(workerIsOnline()).resolves.toBe(false);
  });

  it("reports a missing worker row as unseen, offline and not processing", async () => {
    mocks.dbGet.mockResolvedValue(undefined);
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.status).toBe("offline");
    expect(snapshot.lastHeartbeat).toBeNull();
    expect(snapshot.meta).toEqual({});
    expect(snapshot.online).toBe(false);
    expect(snapshot.recentlySeen).toBe(false);
    expect(snapshot.processing).toBe(false);
    expect(snapshot.leaseExpiresAt).toBeNull();
    await expect(workerIsOnline()).resolves.toBe(false);
    await expect(workerIsProcessing()).resolves.toBe(false);
  });

  it("does not treat an explicit offline status as online, but keeps it recently seen", async () => {
    mocks.dbGet.mockResolvedValue(row({ status: "offline" }));
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.status).toBe("offline");
    expect(snapshot.recentlySeen).toBe(true);
    expect(snapshot.online).toBe(false);
    expect(snapshot.processing).toBe(false);
    expect(snapshot.leaseExpiresAt).toBeNull();
  });

  it("accepts a Postgres timestamptz heartbeat (Date object) as fresh", async () => {
    // supabase/migrations/0001_schema.sql declares last_heartbeat timestamptz,
    // so the pg driver returns a Date here — not the ISO string SQLite returns.
    mocks.dbGet.mockResolvedValue(row({ last_heartbeat: new Date(freshHeartbeat), meta: { worker: "playwright" } }));
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.lastHeartbeat).toBe(freshHeartbeat);
    expect(snapshot.meta).toEqual({ worker: "playwright" });
    expect(snapshot.recentlySeen).toBe(true);
    expect(snapshot.online).toBe(true);
    expect(snapshot.leaseExpiresAt).toBe(
      new Date(new Date(freshHeartbeat).getTime() + DEFAULT_WORKER_ONLINE_WINDOW_MS).toISOString(),
    );
    await expect(workerIsOnline()).resolves.toBe(true);
  });

  it("treats a stale Date-object heartbeat as seen but offline (crashed Postgres worker)", async () => {
    mocks.dbGet.mockResolvedValue(
      row({ last_heartbeat: new Date(staleHeartbeat), meta: { processing: true } }),
    );
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.recentlySeen).toBe(true);
    expect(snapshot.online).toBe(false);
    expect(snapshot.processing).toBe(false);
    await expect(workerIsProcessing()).resolves.toBe(false);
  });

  it("does not treat a future-dated Date object as a valid lease", async () => {
    mocks.dbGet.mockResolvedValue(row({ last_heartbeat: new Date(futureHeartbeat) }));
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.recentlySeen).toBe(true);
    expect(snapshot.online).toBe(false);
    expect(snapshot.leaseExpiresAt).toBeNull();
  });

  it("uses the env override for lease freshness without changing recentlySeen", async () => {
    mocks.dbGet.mockResolvedValue(row({ last_heartbeat: new Date(NOW - 20 * 60_000).toISOString() }));
    process.env.WORKER_ONLINE_WINDOW_MS = "600000"; // 10 minutes

    expect(workerOnlineWindowMs()).toBe(600_000);
    await expect(workerIsOnline()).resolves.toBe(false);
    expect((await workerStatusSnapshot()).recentlySeen).toBe(true);

    delete process.env.WORKER_ONLINE_WINDOW_MS;
    await expect(workerIsOnline()).resolves.toBe(true);
  });

  it("ignores malformed meta without marking the worker as processing", async () => {
    mocks.dbGet.mockResolvedValue(row({ meta: "{not-json" }));
    const snapshot = await workerStatusSnapshot();

    expect(snapshot.meta).toEqual({});
    expect(snapshot.online).toBe(true);
    expect(snapshot.processing).toBe(false);
  });

  it("keeps a 30-minute default lease matching the 10-minute schedule and runtime plus grace", () => {
    expect(DEFAULT_WORKER_ONLINE_WINDOW_MS).toBe(30 * 60 * 1000);
    expect(workerOnlineWindowMs({})).toBe(30 * 60 * 1000);
  });
});
