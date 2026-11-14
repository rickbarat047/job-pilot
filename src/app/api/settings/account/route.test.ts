import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  destroySession: vi.fn(),
  assertSameOrigin: vi.fn(),
  getProfile: vi.fn(),
  getPreferences: vi.fn(),
  all: vi.fn(),
  get: vi.fn(),
  affectedRows: vi.fn((result: { changes?: number; rowCount?: number }) => result.changes ?? result.rowCount ?? 0),
  nowIso: vi.fn(() => "2026-11-14T00:00:00.000Z"),
  transaction: vi.fn(),
  dbRun: vi.fn(),
  deleteUserFiles: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireApiUser: mocks.requireApiUser,
  destroySession: mocks.destroySession,
  assertSameOrigin: mocks.assertSameOrigin,
}));
vi.mock("@/lib/db", () => ({
  affectedRows: mocks.affectedRows,
  get: mocks.get,
  all: mocks.all,
  nowIso: mocks.nowIso,
  transaction: mocks.transaction,
}));
vi.mock("@/lib/repositories", () => ({ getProfile: mocks.getProfile, getPreferences: mocks.getPreferences }));
vi.mock("@/lib/storage", () => ({ deleteUserFiles: mocks.deleteUserFiles }));

import { DELETE } from "./route";

function request(origin = "https://jobpilot.test") {
  return new Request("https://jobpilot.test/api/settings/account", {
    method: "DELETE",
    headers: { origin, host: "jobpilot.test" },
  });
}

describe("account deletion route", () => {
  beforeEach(() => {
    mocks.requireApiUser.mockReset().mockResolvedValue({ id: "usr_123" });
    mocks.destroySession.mockReset().mockResolvedValue(undefined);
    mocks.assertSameOrigin.mockReset().mockImplementation((request: Request) => {
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");
      if (!origin || !host || new URL(origin).host !== host) {
        throw Object.assign(new Error("Cross-site request blocked."), { status: 403 });
      }
    });
    mocks.transaction.mockReset().mockImplementation(async (fn) => fn({ run: mocks.dbRun }));
    mocks.dbRun.mockReset().mockResolvedValue({ changes: 1 });
    mocks.deleteUserFiles.mockReset().mockResolvedValue(undefined);
    mocks.getProfile.mockReset().mockResolvedValue({ fullName: "Test Candidate" });
    mocks.getPreferences.mockReset().mockResolvedValue({ targetRoles: ["Engineer"] });
    mocks.all.mockReset().mockResolvedValue([]);
    mocks.get.mockReset().mockResolvedValue(undefined);
    mocks.affectedRows.mockClear();
  });

  it("downloads a full account export with private document links and no stored mail secret", async () => {
    mocks.get.mockImplementation(async (sql: string) => {
      if (String(sql).includes("user_permissions")) return { autonomy_level: 3 };
      if (String(sql).includes("email_integrations")) return { provider: "smtp", smtp_host: "mail.example.com" };
      return { daily_digest: 1 };
    });
    mocks.all.mockImplementation(async (sql: string) => {
      if (String(sql).includes("uploaded_resumes")) {
        return [{ id: "res_1", filename: "cv.pdf", mime_type: "application/pdf", size: 12, parsed_text: "CV text", parse_status: "parsed", parse_error: null, created_at: "2026-11-14", storage_path: "users/usr_123/cv/cv.pdf" }];
      }
      return [];
    });

    const response = await (await import("./route")).GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("jobpilot-account-export-");
    expect(body.profile.fullName).toBe("Test Candidate");
    expect(body.preferences.targetRoles).toEqual(["Engineer"]);
    expect(body.files[0].download_url).toBe("/api/documents/users/usr_123/cv/cv.pdf");
    expect(JSON.stringify(body)).not.toContain("smtp_password_enc");
  });

  it("removes account files before deleting database records and ending the session", async () => {
    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect(mocks.deleteUserFiles).toHaveBeenCalledWith("usr_123");
    expect(mocks.dbRun).toHaveBeenCalledWith("DELETE FROM users WHERE id=?", ["usr_123"]);
    expect(mocks.deleteUserFiles.mock.invocationCallOrder[0]).toBeLessThan(mocks.transaction.mock.invocationCallOrder[0]);
    expect(mocks.transaction.mock.invocationCallOrder[0]).toBeLessThan(mocks.destroySession.mock.invocationCallOrder[0]);
  });

  it("does not delete the account when private-file cleanup fails", async () => {
    mocks.deleteUserFiles.mockRejectedValue(new Error("storage unavailable"));

    const response = await DELETE(request());

    expect(response.status).toBe(500);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.destroySession).not.toHaveBeenCalled();
  });

  it("rejects a cross-site request before removing account data", async () => {
    const response = await DELETE(request("https://attacker.test"));

    expect(response.status).toBe(403);
    expect(mocks.deleteUserFiles).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not clear the session when the account row was not deleted", async () => {
    mocks.dbRun.mockResolvedValue({ changes: 0 });

    const response = await DELETE(request());

    expect(response.status).toBe(500);
    expect(mocks.destroySession).not.toHaveBeenCalled();
  });
});
