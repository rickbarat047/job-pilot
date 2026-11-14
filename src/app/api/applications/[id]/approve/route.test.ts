import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  assertSameOrigin: vi.fn((request: Request) => {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) throw Object.assign(new Error("Cross-site request blocked."), { status: 403 });
  }),
  getApplicationDetail: vi.fn(),
  getPermissionsForUser: vi.fn(),
  assertPermission: vi.fn(),
  canTransition: vi.fn(),
  newId: vi.fn(),
  nowIso: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn(),
  txRun: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireApiUser: mocks.requireApiUser, assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/repositories", () => ({ getApplicationDetail: mocks.getApplicationDetail, getPermissionsForUser: mocks.getPermissionsForUser }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission, canTransition: mocks.canTransition }));
vi.mock("@/lib/db", () => ({
  affectedRows: (result: { changes?: number; rowCount?: number }) => result?.rowCount ?? result?.changes ?? 0,
  newId: mocks.newId,
  nowIso: mocks.nowIso,
  run: mocks.run,
  transaction: mocks.transaction,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "app_1" }) };

function request(body: unknown) {
  return new Request("https://jobpilot.test/api/applications/app_1/approve", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://jobpilot.test", host: "jobpilot.test" },
    body: JSON.stringify(body),
  });
}

describe("application approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user_1" });
    mocks.getApplicationDetail.mockResolvedValue({ application: { state: "Draft Ready" } });
    mocks.getPermissionsForUser.mockResolvedValue({});
    mocks.canTransition.mockReturnValue(true);
    mocks.newId.mockReturnValue("evt_1");
    mocks.nowIso.mockReturnValue("2026-11-14T00:00:00.000Z");
    mocks.run.mockResolvedValue({ changes: 1 });
    mocks.txRun.mockResolvedValue({ rowCount: 1 });
    mocks.transaction.mockImplementation(async (callback) => callback({ run: mocks.txRun }));
  });

  it("requires an explicit review confirmation before advancing the application", async () => {
    const response = await POST(request({}), context);
    expect(response.status).toBe(400);
    expect(mocks.getPermissionsForUser).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("blocks a cross-site request before reading or changing the application", async () => {
    const crossSite = request({ reviewed: true });
    const hostile = new Request(crossSite.url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example", host: "jobpilot.test" },
      body: JSON.stringify({ reviewed: true }),
    });

    const response = await POST(hostile, context);

    expect(response.status).toBe(403);
    expect(mocks.requireApiUser).not.toHaveBeenCalled();
    expect(mocks.getApplicationDetail).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("records an approved application only after review confirmation", async () => {
    const response = await POST(request({ reviewed: true }), context);
    expect(response.status).toBe(200);
    expect(mocks.assertPermission).toHaveBeenCalledWith({}, "submit_application");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.txRun).toHaveBeenCalledTimes(2);
    expect(mocks.txRun.mock.calls[0][0]).toContain("state='Approved'");
    expect(mocks.txRun.mock.calls[0][0]).toContain("AND state=?");
    expect(mocks.txRun.mock.calls[1][0]).toContain("application.approved");
  });

  it("does not add an approval event when the state changed concurrently", async () => {
    mocks.txRun.mockResolvedValueOnce({ rowCount: 0 });
    const response = await POST(request({ reviewed: true }), context);

    expect(response.status).toBe(400);
    expect(mocks.txRun).toHaveBeenCalledOnce();
  });
});
