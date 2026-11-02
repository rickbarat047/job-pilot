import { describe, it, expect } from "vitest";
import { evaluatePermission } from "./permissions";
import { hashPassword, verifyPassword, validatePasswordStrength } from "./password";

describe("permissions", () => {
  const base = {
    autonomyLevel: 3 as const, searchJobs: "automatic" as const, analyzeJobs: "automatic" as const, matchJobs: "automatic" as const,
    generateResumes: "automatic" as const, generateCoverLetters: "automatic" as const, saveDrafts: "automatic" as const,
    submitApplications: "approval" as const, sendRecruiterEmails: "approval" as const, answerSensitiveQuestions: "approval" as const,
    acceptOffers: "never" as const, sharePersonalInfo: "approval" as const, autoApplyCategories: [], autoApplyMinScore: 85,
    allowDuplicateApplications: false, demoMode: true,
  };

  it("requires approval for submissions at level 3", () => {
    const decision = evaluatePermission(base, "submit_application");
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });

  it("never allows accepting offers", () => {
    const decision = evaluatePermission({ ...base, autonomyLevel: 4 }, "accept_offer");
    expect(decision.allowed).toBe(false);
  });

  it("blocks auto-apply below level 4", () => {
    const decision = evaluatePermission(base, "auto_apply");
    expect(decision.allowed).toBe(false);
  });
});

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("Demo@12345");
    expect(await verifyPassword("Demo@12345", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("validates strength", () => {
    expect(validatePasswordStrength("short")).not.toBeNull();
    expect(validatePasswordStrength("longenough1")).toBeNull();
  });
});
