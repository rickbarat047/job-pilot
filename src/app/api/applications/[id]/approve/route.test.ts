import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getApplicationDetail: vi.fn(),
  getPermissionsForUser: vi.fn(),
  assertPermission: vi.fn(),
  canTransition: vi.fn(),
  newId: vi.fn(),
  nowIso: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/lib/repositories", () => ({ getApplicationDetail: mocks.getApplicationDetail, getPermissionsForUser: mocks.getPermissionsForUser }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission, canTransition: mocks.canTransition }));
vi.mock("@/lib/db", () => ({ newId: mocks.newId, nowIso: mocks.nowIso, run: mocks.run }));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "app_1" }) };

function request(body: unknown) {
  return new Request("https://jobpilot.test/api/applications/app_1/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
  });

  it("requires an explicit review confirmation before advancing the application", async () => {
    const response = await POST(request({}), context);
    expect(response.status).toBe(400);
    expect(mocks.getPermissionsForUser).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("records an approved application only after review confirmation", async () => {
    const response = await POST(request({ reviewed: true }), context);
    expect(response.status).toBe(200);
    expect(mocks.assertPermission).toHaveBeenCalledWith({}, "submit_application");
    expect(mocks.run).toHaveBeenCalledTimes(2);
    expect(mocks.run.mock.calls[0][0]).toContain("state='Approved'");
    expect(mocks.run.mock.calls[1][0]).toContain("application.approved");
  });
});
