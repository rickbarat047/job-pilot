import { describe, expect, it } from "vitest";
import { isActiveForAutomatedApplication, isDefinitivelyClosedPostingStatus } from "./job-verification";

describe("job posting verification", () => {
  it("only expires listings with definitive not-found or gone responses", () => {
    expect(isDefinitivelyClosedPostingStatus(404)).toBe(true);
    expect(isDefinitivelyClosedPostingStatus(410)).toBe(true);
    for (const status of [200, 301, 403, 405, 429, 500, 503]) {
      expect(isDefinitivelyClosedPostingStatus(status)).toBe(false);
    }
  });

  it("allows automated applications only for listings still marked active", () => {
    expect(isActiveForAutomatedApplication("active")).toBe(true);
    for (const status of ["expired", "unverified", "", null, undefined]) {
      expect(isActiveForAutomatedApplication(status)).toBe(false);
    }
  });
});
