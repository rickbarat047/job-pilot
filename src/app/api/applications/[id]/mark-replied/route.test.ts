import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getApplicationDetail: vi.fn(),
  createNotification: vi.fn(),
  affectedRows: vi.fn(() => 1),
  newId: vi.fn(() => "evt_test"),
  nowIso: vi.fn(() => "2026-11-14T00:00:00.000Z"),
  transaction: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/lib/repositories", () => ({ getApplicationDetail: mocks.getApplicationDetail, createNotification: mocks.createNotification }));
vi.mock("@/lib/db", () => ({
  affectedRows: mocks.affectedRows,
  newId: mocks.newId,
  nowIso: mocks.nowIso,
  transaction: mocks.transaction,
}));

import { POST } from "./route";

const detail = { application: { state: "Applied" }, job: { title: "Analyst", company: "Example Co" } };
const context = { params: Promise.resolve({ id: "app_1" }) };

async function post(body: unknown) {
  return POST(new Request("https://jobpilot.test/api/applications/app_1/mark-replied", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), context);
}

describe("mark-replied route", () => {
  beforeEach(() => {
    mocks.requireApiUser.mockReset().mockResolvedValue({ id: "user_1" });
    mocks.getApplicationDetail.mockReset().mockResolvedValue(detail);
    mocks.createNotification.mockReset().mockResolvedValue(undefined);
    mocks.affectedRows.mockReset().mockReturnValue(1);
    mocks.newId.mockReset().mockReturnValue("evt_test");
    mocks.nowIso.mockReset().mockReturnValue("2026-11-14T00:00:00.000Z");
    mocks.dbRun.mockReset().mockResolvedValue({ changes: 1 });
    mocks.transaction.mockReset().mockImplementation(async (fn) => fn({ run: mocks.dbRun }));
  });

  it("rejects reply tracking before submission", async () => {
    mocks.getApplicationDetail.mockResolvedValue({ ...detail, application: { state: "Draft Ready" } });
    const response = await post({ note: "Recruiter replied" });
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects oversized or invalid reply details", async () => {
    expect((await post({ note: "x".repeat(2001) })).status).toBe(400);
    expect((await post({ channel: "made-up-channel" })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("updates activity and adds the reply event atomically", async () => {
    const response = await post({ note: "Recruiter asked for availability", channel: "email" });
    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.dbRun).toHaveBeenCalledTimes(2);
    expect(mocks.dbRun.mock.calls[0][0]).toContain("AND state=?");
    expect(mocks.dbRun.mock.calls[1][1]).toContain(JSON.stringify({ note: "Recruiter asked for availability", channel: "email" }));
    expect(mocks.createNotification).toHaveBeenCalledOnce();
  });
});
