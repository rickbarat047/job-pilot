import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  requireApiUser: vi.fn(),
  getApplicationDetail: vi.fn(),
  canTransition: vi.fn(),
  txRun: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ assertSameOrigin: mocks.assertSameOrigin, requireApiUser: mocks.requireApiUser }));
vi.mock("@/lib/repositories", () => ({ getApplicationDetail: mocks.getApplicationDetail }));
vi.mock("@/lib/permissions", () => ({ canTransition: mocks.canTransition }));
vi.mock("@/lib/db", () => ({
  affectedRows: (result: { rowCount?: number; changes?: number }) => result?.rowCount ?? result?.changes ?? 0,
  newId: () => "event_test",
  nowIso: () => "2026-11-14T00:00:00.000Z",
  transaction: mocks.transaction,
}));

import { POST as withdraw } from "./[id]/withdraw/route";
import { POST as reject } from "./[id]/reject/route";
import { POST as retry } from "./[id]/retry/route";

const context = { params: Promise.resolve({ id: "app_1" }) };

function request(path: string, body: unknown = {}) {
  return new Request(`https://jobpilot.test/api/applications/app_1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("application state transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSameOrigin.mockImplementation(() => undefined);
    mocks.requireApiUser.mockResolvedValue({ id: "user_1" });
    mocks.getApplicationDetail.mockResolvedValue({ application: { state: "Approved" } });
    mocks.canTransition.mockReturnValue(true);
    mocks.txRun.mockResolvedValue({ rowCount: 1 });
    mocks.transaction.mockImplementation(async (callback) => callback({ run: mocks.txRun }));
  });

  it("withdraws and writes the timeline event atomically", async () => {
    const response = await withdraw(request("withdraw"), context);

    expect(response.status).toBe(200);
    expect(mocks.assertSameOrigin).toHaveBeenCalledOnce();
    expect(mocks.txRun).toHaveBeenCalledTimes(2);
    expect(mocks.txRun.mock.calls[0][0]).toContain("AND state=?");
    expect(mocks.txRun.mock.calls[1][0]).toContain("application.withdrawn");
  });

  it("rejects and stores only a bounded text note", async () => {
    const response = await reject(request("reject", { reason: "Role is not suitable" }), context);

    expect(response.status).toBe(200);
    expect(mocks.txRun).toHaveBeenCalledTimes(2);
    expect(mocks.txRun.mock.calls[1][1]).toContain(JSON.stringify({ reason: "Role is not suitable" }));
    expect(await (await reject(request("reject", { reason: "x".repeat(2001) }), context)).json()).toMatchObject({ error: expect.any(String) });
  });

  it("retries only from failure and records both state and event in one transaction", async () => {
    mocks.getApplicationDetail.mockResolvedValue({ application: { state: "Application Failed" } });
    const response = await retry(request("retry"), context);

    expect(response.status).toBe(200);
    expect(mocks.txRun).toHaveBeenCalledTimes(2);
    expect(mocks.txRun.mock.calls[0][0]).toContain("state='Application Failed'");
    expect(mocks.txRun.mock.calls[1][0]).toContain("application.retry");
  });

  it("does not write an event when a concurrent transition wins", async () => {
    mocks.txRun.mockResolvedValueOnce({ rowCount: 0 });
    const response = await withdraw(request("withdraw"), context);

    expect(response.status).toBe(400);
    expect(mocks.txRun).toHaveBeenCalledOnce();
  });
});
