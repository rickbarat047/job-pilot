import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  assertSameOrigin: vi.fn(),
  getPermissionsForUser: vi.fn(),
  savePermissions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireApiUser: mocks.requireApiUser, assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/repositories", () => ({ getPermissionsForUser: mocks.getPermissionsForUser, savePermissions: mocks.savePermissions }));

import { PUT } from "./route";

const validPermissions = {
  autonomyLevel: 4,
  searchJobs: "automatic",
  analyzeJobs: "automatic",
  matchJobs: "automatic",
  generateResumes: "automatic",
  generateCoverLetters: "automatic",
  saveDrafts: "automatic",
  submitApplications: "automatic",
  sendRecruiterEmails: "approval",
  answerSensitiveQuestions: "approval",
  acceptOffers: "never",
  sharePersonalInfo: "approval",
  autoApplyCategories: ["Software Engineering & QA"],
  autoApplyMinScore: 90,
  allowDuplicateApplications: false,
  demoMode: true,
};

function request(body: unknown, origin = "https://jobpilot.test") {
  return new Request("https://jobpilot.test/api/settings/permissions", {
    method: "PUT",
    headers: { origin, host: "jobpilot.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("permissions update route", () => {
  beforeEach(() => {
    mocks.requireApiUser.mockReset().mockResolvedValue({ id: "usr_123" });
    mocks.assertSameOrigin.mockReset().mockImplementation((request: Request) => {
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");
      if (!origin || !host || new URL(origin).host !== host) {
        throw Object.assign(new Error("Cross-site request blocked."), { status: 403 });
      }
    });
    mocks.getPermissionsForUser.mockReset();
    mocks.savePermissions.mockReset().mockResolvedValue(undefined);
  });

  it("persists a valid explicit auto-apply configuration", async () => {
    const response = await PUT(request(validPermissions));

    expect(response.status).toBe(200);
    expect(mocks.savePermissions).toHaveBeenCalledWith("usr_123", validPermissions);
  });

  it("rejects unsafe score thresholds and unknown role categories", async () => {
    const lowScore = await PUT(request({ ...validPermissions, autoApplyMinScore: 1 }));
    const unsupportedCategory = await PUT(request({ ...validPermissions, autoApplyCategories: ["All roles"] }));

    expect(lowScore.status).toBe(400);
    expect(unsupportedCategory.status).toBe(400);
    expect(mocks.savePermissions).not.toHaveBeenCalled();
  });

  it("rejects cross-site permission changes", async () => {
    const response = await PUT(request(validPermissions, "https://attacker.test"));

    expect(response.status).toBe(403);
    expect(mocks.savePermissions).not.toHaveBeenCalled();
  });
});
