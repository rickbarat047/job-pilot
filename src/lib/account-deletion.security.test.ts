import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  destroySession: vi.fn(),
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
  nowIso: vi.fn(() => "2026-01-01T00:00:00.000Z"),
  deleteFile: vi.fn(),
  getProfile: vi.fn(),
  getPreferences: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireApiUser: mocks.requireApiUser,
  destroySession: mocks.destroySession,
}));
vi.mock("@/lib/db", () => ({
  all: mocks.dbAll,
  get: mocks.dbGet,
  run: mocks.dbRun,
  nowIso: mocks.nowIso,
}));
vi.mock("@/lib/storage", () => ({ deleteFile: mocks.deleteFile }));
vi.mock("@/lib/repositories", () => ({
  getProfile: mocks.getProfile,
  getPreferences: mocks.getPreferences,
}));

import { DELETE, GET } from "../app/api/settings/account/route";

describe("account deletion removes uploaded CV PII", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "usr_1", email: "user@example.com", name: "User" });
    mocks.destroySession.mockResolvedValue(undefined);
    mocks.dbAll.mockResolvedValue([]);
    mocks.dbGet.mockResolvedValue({ c: 0 });
    mocks.dbRun.mockResolvedValue(undefined);
    mocks.deleteFile.mockResolvedValue(undefined);
    mocks.getProfile.mockResolvedValue({});
    mocks.getPreferences.mockResolvedValue({});
  });

  it("deletes every uploaded CV file and its rows before soft-deleting the user", async () => {
    mocks.dbAll.mockResolvedValueOnce([
      { storage_path: "users/usr_1/cv/one.pdf" },
      { storage_path: "users/usr_1/cv/two.docx" },
    ]);

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(mocks.dbAll.mock.calls[0][1]).toEqual(["usr_1"]);
    expect(mocks.deleteFile).toHaveBeenCalledTimes(2);
    expect(mocks.deleteFile).toHaveBeenCalledWith("users/usr_1/cv/one.pdf");
    expect(mocks.deleteFile).toHaveBeenCalledWith("users/usr_1/cv/two.docx");
    const statements = mocks.dbRun.mock.calls.map((call) => String(call[0]));
    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatch(/DELETE FROM uploaded_resumes WHERE user_id = \?/);
    expect(statements[1]).toMatch(/UPDATE users SET deleted_at/);
    expect(mocks.dbRun.mock.calls[1][1]).toContain("usr_1");
    expect(mocks.destroySession).toHaveBeenCalledTimes(1);
  });

  it("does not soft-delete when resume lookup fails and returns a generic error", async () => {
    mocks.dbAll.mockRejectedValueOnce(new Error("db secret detail: /srv/private"));

    const res = await DELETE();

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unable to delete account.");
    expect(JSON.stringify(body)).not.toContain("secret detail");
    expect(mocks.dbRun).not.toHaveBeenCalled();
    expect(mocks.destroySession).not.toHaveBeenCalled();
  });

  it("does not soft-delete when resume row deletion fails", async () => {
    mocks.dbAll.mockResolvedValueOnce([{ storage_path: "users/usr_1/cv/one.pdf" }]);
    mocks.dbRun.mockRejectedValueOnce(new Error("row delete failed: secret detail"));

    const res = await DELETE();

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Unable to delete account.");
    expect(mocks.deleteFile).toHaveBeenCalledWith("users/usr_1/cv/one.pdf");
    const statements = mocks.dbRun.mock.calls.map((call) => String(call[0]));
    expect(statements.some((s) => /UPDATE users SET deleted_at/.test(s))).toBe(false);
    expect(mocks.destroySession).not.toHaveBeenCalled();
  });

  it("returns a generic error when authentication fails", async () => {
    mocks.requireApiUser.mockRejectedValueOnce(new Error("Sign in to continue. secret detail"));

    const res = await DELETE();

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unable to delete account.");
    expect(JSON.stringify(body)).not.toContain("secret detail");
    expect(mocks.dbRun).not.toHaveBeenCalled();
  });

  it("does not leak raw exception messages from the export endpoint either", async () => {
    mocks.dbGet.mockRejectedValueOnce(new Error("database secret detail"));

    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(JSON.stringify(body)).not.toContain("secret detail");
  });
});
