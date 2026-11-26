import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({ snapshot: vi.fn() }));
vi.mock("@/lib/automation", () => ({ workerStatusSnapshot: mocks.snapshot }));

import { GET } from "../app/api/automation/worker/route";

const base = {
  lastHeartbeat: "2026-11-26T00:00:00.000Z",
  meta: { worker: "playwright" },
  recentlySeen: true,
  processing: false,
  leaseExpiresAt: "2026-11-26T00:30:00.000Z",
};

describe("worker status endpoint lease honesty", () => {
  it("reports offline when the lease expired even if stored status is online", async () => {
    mocks.snapshot.mockResolvedValue({ ...base, status: "online", online: false });
    const body = await (await GET()).json();
    expect(body.status).toBe("offline");
    expect(body.online).toBe(false);
    expect(body.recentlySeen).toBe(true);
  });

  it("reports offline when no heartbeat has ever been recorded", async () => {
    mocks.snapshot.mockResolvedValue({
      ...base,
      status: "online",
      online: false,
      lastHeartbeat: null,
      recentlySeen: false,
    });
    const body = await (await GET()).json();
    expect(body.status).toBe("offline");
    expect(body.recentlySeen).toBe(false);
  });

  it("reports online only with a live lease", async () => {
    mocks.snapshot.mockResolvedValue({ ...base, status: "online", online: true });
    const body = await (await GET()).json();
    expect(body.status).toBe("online");
    expect(body.processing).toBe(false);
  });

  it("does not claim processing when the lease is expired", async () => {
    mocks.snapshot.mockResolvedValue({
      ...base,
      status: "online",
      online: false,
      processing: true,
    });
    const body = await (await GET()).json();
    expect(body.status).toBe("offline");
    expect(body.processing).toBe(false);
  });
});
