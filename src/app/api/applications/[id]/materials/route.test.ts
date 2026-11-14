import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getApplicationDetail: vi.fn(),
  transaction: vi.fn(),
  generateResumeDocuments: vi.fn(),
  generateCoverLetterDocuments: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/lib/repositories", () => ({ getApplicationDetail: mocks.getApplicationDetail }));
vi.mock("@/lib/db", () => ({ nowIso: () => "2026-11-14T00:00:00.000Z", newId: (prefix: string) => `${prefix}_test`, transaction: mocks.transaction }));
vi.mock("@/lib/documents/generate", () => ({ generateResumeDocuments: mocks.generateResumeDocuments, generateCoverLetterDocuments: mocks.generateCoverLetterDocuments }));
vi.mock("@/lib/storage", () => ({ deleteFile: mocks.deleteFile }));

import { PATCH } from "./route";

const originalDetail = {
  application: { id: "app_1", state: "Draft Ready" },
  resume: {
    id: "resume_1",
    content: { header: { name: "Candidate" }, summary: "Old summary", targetRole: "Engineer", company: "Example", skills: [], experience: [], internships: [], projects: [], education: [], certifications: [], languages: [] },
    pdf: "users/usr_1/applications/app_1/resume/old.pdf",
    docx: "users/usr_1/applications/app_1/resume/old.docx",
  },
  coverLetter: {
    id: "cover_1",
    content: { text: "Old letter", targetRole: "Engineer", company: "Example", tone: "professional" },
    pdf: "users/usr_1/applications/app_1/cover/old.pdf",
    docx: "users/usr_1/applications/app_1/cover/old.docx",
  },
  email: { id: "email_1", status: "draft", subject: "Old subject", body: "Old email", to: "jobs@example.com" },
};

function request(body: unknown) {
  return new Request("https://jobpilot.example/api/applications/app_1/materials", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("application materials editing", () => {
  const database = { run: vi.fn().mockResolvedValue({ rowCount: 1 }) };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "usr_1" });
    mocks.getApplicationDetail.mockResolvedValue(originalDetail);
    mocks.transaction.mockImplementation(async (callback: (db: typeof database) => Promise<unknown>) => callback(database));
    mocks.generateResumeDocuments.mockResolvedValue({ pdfPath: "new/resume.pdf", docxPath: "new/resume.docx" });
    mocks.generateCoverLetterDocuments.mockResolvedValue({ pdfPath: "new/cover.pdf", docxPath: "new/cover.docx" });
    mocks.deleteFile.mockResolvedValue(undefined);
  });

  it("rejects edits after approval", async () => {
    mocks.getApplicationDetail.mockResolvedValue({ ...originalDetail, application: { ...originalDetail.application, state: "Approved" } });
    const response = await PATCH(request({ summary: "Updated summary" }), { params: Promise.resolve({ id: "app_1" }) });
    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("saves edited materials transactionally and replaces the old private files", async () => {
    const response = await PATCH(request({ summary: "Reviewed summary", coverLetterText: "Reviewed cover letter", emailSubject: "Application", emailBody: "Reviewed email" }), { params: Promise.resolve({ id: "app_1" }) });
    expect(response.status).toBe(200);
    expect(mocks.generateResumeDocuments).toHaveBeenCalledWith(expect.stringMatching(/^users\/usr_1\/applications\/app_1\/revisions\/rev_/), expect.objectContaining({ summary: "Reviewed summary" }));
    expect(mocks.generateCoverLetterDocuments).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ text: "Reviewed cover letter" }), "Candidate");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(database.run).toHaveBeenCalledWith(expect.stringContaining("UPDATE email_messages"), ["Application", "Reviewed email", "email_1", "usr_1", "app_1"]);
    expect(mocks.deleteFile).toHaveBeenCalledTimes(4);
  });

  it("rejects an oversized summary without generating files", async () => {
    const response = await PATCH(request({ summary: "x".repeat(2001) }), { params: Promise.resolve({ id: "app_1" }) });
    expect(response.status).toBe(400);
    expect(mocks.generateResumeDocuments).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("cleans up newly generated files and retains old files when the database transaction fails", async () => {
    mocks.transaction.mockRejectedValue(new Error("database unavailable"));
    const response = await PATCH(request({ summary: "Reviewed summary" }), { params: Promise.resolve({ id: "app_1" }) });
    expect(response.status).toBe(400);
    expect(mocks.deleteFile).toHaveBeenCalledWith("new/resume.pdf");
    expect(mocks.deleteFile).toHaveBeenCalledWith("new/resume.docx");
    expect(mocks.deleteFile).toHaveBeenCalledWith("new/cover.pdf");
    expect(mocks.deleteFile).toHaveBeenCalledWith("new/cover.docx");
    expect(mocks.deleteFile).not.toHaveBeenCalledWith("users/usr_1/applications/app_1/resume/old.pdf");
  });
});
