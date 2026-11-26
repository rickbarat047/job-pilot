import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  destroySession: vi.fn(),
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
  nowIso: vi.fn(() => "2026-02-01T00:00:00.000Z"),
  deleteFile: vi.fn(),
  getProfile: vi.fn(),
  getPreferences: vi.fn(),
  consoleError: vi.fn(),
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

import { DELETE } from "../app/api/settings/account/route";

const USER = "usr_1";

function seedRows(rows: {
  resumes?: unknown[];
  versions?: unknown[];
  documents?: unknown[];
} = {}) {
  mocks.dbAll.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM uploaded_resumes")) return rows.resumes ?? [];
    if (sql.includes("FROM resume_versions")) return rows.versions ?? [];
    if (sql.includes("FROM application_documents")) return rows.documents ?? [];
    return [];
  });
}

describe("account cleanup — user-owned file removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: USER, email: "user@example.com", name: "User" });
    mocks.destroySession.mockResolvedValue(undefined);
    mocks.dbAll.mockResolvedValue([]);
    mocks.dbGet.mockResolvedValue({ c: 0 });
    mocks.dbRun.mockResolvedValue(undefined);
    mocks.deleteFile.mockResolvedValue(undefined);
    mocks.getProfile.mockResolvedValue({});
    mocks.getPreferences.mockResolvedValue({});
    vi.spyOn(console, "error").mockImplementation(mocks.consoleError);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes CVs, generated resume/cover-letter files and application documents once each", async () => {
    seedRows({
      resumes: [
        { storage_path: "users/usr_1/cv/cv-1.pdf" },
        { storage_path: "users/usr_1/cv/cv-2.docx" },
      ],
      versions: [
        {
          file_pdf_path: "users/usr_1/applications/app_1/resume/engineer.pdf",
          file_docx_path: "users/usr_1/applications/app_1/resume/engineer.docx",
        },
      ],
      documents: [
        { path: "users/usr_1/applications/app_1/cover-letter/acme.pdf" },
        { path: "users/usr_1/applications/app_1/resume/engineer.pdf" }, // duplicate of the resume version path
      ],
    });

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(mocks.deleteFile).toHaveBeenCalledTimes(5);
    expect(mocks.deleteFile.mock.calls.map((call) => call[0]).sort()).toEqual([
      "users/usr_1/applications/app_1/cover-letter/acme.pdf",
      "users/usr_1/applications/app_1/resume/engineer.docx",
      "users/usr_1/applications/app_1/resume/engineer.pdf",
      "users/usr_1/cv/cv-1.pdf",
      "users/usr_1/cv/cv-2.docx",
    ]);
    const statements = mocks.dbRun.mock.calls.map((call) => String(call[0]));
    expect(statements.some((s) => /DELETE FROM uploaded_resumes WHERE user_id = \?/.test(s))).toBe(true);
    expect(statements.some((s) => /DELETE FROM resume_versions WHERE user_id = \?/.test(s))).toBe(true);
    expect(statements.some((s) => /DELETE FROM application_documents/.test(s))).toBe(true);
    expect(statements.some((s) => /UPDATE users SET deleted_at/.test(s))).toBe(true);
    expect(mocks.destroySession).toHaveBeenCalledTimes(1);
  });

  it("keeps account deletion consistent when only some storage files fail", async () => {
    seedRows({
      resumes: [
        { storage_path: "users/usr_1/cv/ok.pdf" },
        { storage_path: "users/usr_1/cv/broken.pdf" },
      ],
    });
    mocks.deleteFile.mockImplementation(async (relativePath: string) => {
      if (relativePath.endsWith("broken.pdf")) throw new Error("storage 500: bucket-token-abc");
      return undefined;
    });

    const res = await DELETE();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("bucket-token-abc");
    expect(mocks.deleteFile).toHaveBeenCalledWith("users/usr_1/cv/ok.pdf");
    expect(mocks.deleteFile).toHaveBeenCalledWith("users/usr_1/cv/broken.pdf");
    const statements = mocks.dbRun.mock.calls.map((call) => String(call[0]));
    expect(statements.some((s) => /DELETE FROM uploaded_resumes WHERE user_id = \?/.test(s))).toBe(true);
    expect(statements.some((s) => /UPDATE users SET deleted_at/.test(s))).toBe(true);
    expect(mocks.destroySession).toHaveBeenCalledTimes(1);
    expect(mocks.consoleError).toHaveBeenCalled();
    expect(JSON.stringify(mocks.consoleError.mock.calls)).toContain("users/usr_1/cv/broken.pdf");
  });

  it("never deletes files that are not owned by the authenticated user", async () => {
    seedRows({
      resumes: [
        { storage_path: "users/usr_1/cv/own.pdf" },
        { storage_path: "users/usr_999/cv/someone-else.pdf" },
        { storage_path: "users/usr_1/../usr_999/cv/traversal.pdf" },
        { storage_path: "users/usr_1x/cv/prefix-confusion.pdf" },
        { storage_path: "/absolute/secret.pdf" },
      ],
      versions: [{ file_pdf_path: "users/usr_999/applications/x/other.pdf", file_docx_path: null }],
      documents: [{ path: "users/usr_1/..\\usr_999/windows.pdf" }],
    });

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(mocks.deleteFile).toHaveBeenCalledTimes(1);
    expect(mocks.deleteFile).toHaveBeenCalledWith("users/usr_1/cv/own.pdf");
  });
});
