import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  assertSameOrigin: vi.fn(),
  getApplicationDetail: vi.fn(),
  canTransition: vi.fn(() => true),
  affectedRows: vi.fn(() => 1),
  newId: vi.fn(() => "evt_test"),
  nowIso: vi.fn(() => "2026-11-14T00:00:00.000Z"),
  transaction: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireApiUser: mocks.requireApiUser, assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/repositories", () => ({ getApplicationDetail: mocks.getApplicationDetail }));
vi.mock("@/lib/permissions", () => ({ canTransition: mocks.canTransition }));
vi.mock("@/lib/db", () => ({
  affectedRows: mocks.affectedRows,
  newId: mocks.newId,
  nowIso: mocks.nowIso,
  transaction: mocks.transaction,
}));

import { POST } from "./route";

const detail = { application: { state: "Approved" } };
const context = { params: Promise.resolve({ id: "app_1" }) };

async function post(body: unknown) {
  return POST(new Request("https://jobpilot.test/api/applications/app_1/confirm-applied", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), context);
}

describe("confirm-applied route", () => {
  beforeEach(() => {
    mocks.requireApiUser.mockReset().mockResolvedValue({ id: "user_1" });
    mocks.getApplicationDetail.mockReset().mockResolvedValue(detail);
    mocks.canTransition.mockReset().mockReturnValue(true);
    mocks.affectedRows.mockReset().mockReturnValue(1);
    mocks.newId.mockReset().mockReturnValue("evt_test");
    mocks.nowIso.mockReset().mockReturnValue("2026-11-14T00:00:00.000Z");
    mocks.dbRun.mockReset().mockResolvedValue({ changes: 1 });
    mocks.transaction.mockReset().mockImplementation(async (fn) => fn({ run: mocks.dbRun }));
  });

  it("prevents duplicate confirmation", async () => {
    mocks.getApplicationDetail.mockResolvedValue({ application: { state: "Applied" } });
    const response = await post({ note: "Already submitted" });
    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("bounds confirmation notes", async () => {
    const response = await post({ note: "x".repeat(2001) });
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("updates application state and writes its event atomically", async () => {
    const response = await post({ note: "Submitted on company site" });
    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.dbRun).toHaveBeenCalledTimes(2);
    expect(mocks.dbRun.mock.calls[0][0]).toContain("AND state=?");
    expect(mocks.dbRun.mock.calls[1][1]).toContain(JSON.stringify({ note: "Submitted on company site" }));
  });
});
