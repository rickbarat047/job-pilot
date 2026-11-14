import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
  newId: vi.fn(),
  nowIso: vi.fn(),
  parseJson: vi.fn(),
  fetchHead: vi.fn(),
}));

vi.mock("./db", () => ({
  all: mocks.all,
  get: mocks.get,
  run: mocks.run,
  newId: mocks.newId,
  nowIso: mocks.nowIso,
  parseJson: mocks.parseJson,
}));
vi.mock("./sources/http", () => ({
  fetchHead: mocks.fetchHead,
  mapWithConcurrency: async <T, R>(items: T[], _limit: number, fn: (item: T) => Promise<R>) => Promise.all(items.map(fn)),
}));
vi.mock("./job-verification", () => ({ isDefinitivelyClosedPostingStatus: (status: number) => status === 404 || status === 410 }));

import { verifyActiveJobs } from "./automation";

describe("active job verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.all.mockResolvedValue([
      { id: "open", application_url: "https://example.com/open" },
      { id: "closed", application_url: "https://example.com/closed" },
      { id: "unavailable", application_url: "https://example.com/unavailable" },
      { id: "timeout", application_url: "https://example.com/timeout" },
    ]);
    mocks.run.mockResolvedValue({ changes: 1 });
    mocks.nowIso.mockReturnValue("2026-11-14T00:00:00.000Z");
    mocks.fetchHead.mockImplementation(async (url: string) => {
      if (url.endsWith("/open")) return { status: 200, finalUrl: url };
      if (url.endsWith("/closed")) return { status: 404, finalUrl: url };
      if (url.endsWith("/unavailable")) return { status: 503, finalUrl: url };
      throw new Error("Request timed out.");
    });
  });

  it("expires confirmed closed jobs, refreshes open jobs, and preserves uncertain listings", async () => {
    const result = await verifyActiveJobs(12);

    expect(result).toEqual({ checked: 4, refreshed: 1, expired: 1, unchanged: 2 });
    expect(mocks.all).toHaveBeenCalledWith(expect.stringContaining("ORDER BY last_verified_at ASC"), [12]);
    expect(mocks.run).toHaveBeenCalledTimes(2);
    const expireCall = mocks.run.mock.calls.find(([sql]) => String(sql).includes("status='expired'"));
    const refreshCall = mocks.run.mock.calls.find(([sql]) => String(sql).includes("last_verified_at=? WHERE id=? AND status='active'"));
    expect(expireCall?.[1]).toEqual(["2026-11-14T00:00:00.000Z", "closed"]);
    expect(refreshCall?.[1]).toEqual(["2026-11-14T00:00:00.000Z", "open"]);
  });

  it("clamps verification batches to a safe range", async () => {
    await verifyActiveJobs(0);
    expect(mocks.all).toHaveBeenCalledWith(expect.any(String), [1]);
  });
});
