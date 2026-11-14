import { describe, it, expect } from "vitest";
import { parseLocation, parseSalary, stripHtml, jobFingerprint, isIndiaEligibleRemote } from "./normalize";
import { titleSimilarity, dedupeBatch, applicationDuplicateKey } from "./dedupe";
import type { NormalizedJob } from "./types";

describe("normalize", () => {
  it("detects Indian cities", () => {
    const result = parseLocation("Bengaluru, Karnataka");
    expect(result.country).toBe("India");
    expect(result.city).toBe("Bengaluru");
  });

  it("parses INR salary ranges", () => {
    const result = parseSalary("₹6-10 LPA");
    expect(result.minLpa).toBe(6);
    expect(result.maxLpa).toBe(10);
    expect(result.currency).toBe("INR");
  });

  it("converts monthly INR salary amounts into annual LPA for matching", () => {
    const range = parseSalary("₹50,000-₹1,00,000 per month");
    expect(range.minLpa).toBe(6);
    expect(range.maxLpa).toBe(12);
    expect(range.currency).toBe("INR");

    const single = parseSalary("₹60,000/month");
    expect(single.minLpa).toBe(7.2);

    expect(parseSalary("₹1 lakh per month").minLpa).toBe(12);
    expect(parseSalary("₹12 LPA").minLpa).toBe(12);
  });

  it("strips HTML", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("creates stable fingerprints", () => {
    expect(jobFingerprint("Groww", "Quality Engineer", "Bengaluru")).toBe(jobFingerprint("Groww", "Quality Engineer", "Bengaluru"));
  });
});

describe("India eligibility for remote roles", () => {
  it("accepts India-specific and clearly worldwide eligibility", () => {
    expect(isIndiaEligibleRemote("Remote — India")).toBe(true);
    expect(isIndiaEligibleRemote("Remote", "Candidates must be based in India.")).toBe(true);
    expect(isIndiaEligibleRemote("Remote", "This role is open to candidates worldwide.")).toBe(true);
    expect(isIndiaEligibleRemote("Remote", "Work from anywhere in the world.")).toBe(true);
  });

  it("rejects vague remote locations and listings that exclude India", () => {
    expect(isIndiaEligibleRemote("Remote")).toBe(false);
    expect(isIndiaEligibleRemote("Remote", "This is a remote role. Our India team works with the US team.")).toBe(false);
    expect(isIndiaEligibleRemote("Remote", "Work from anywhere except India.")).toBe(false);
    expect(isIndiaEligibleRemote("Remote", "Remote role, but candidates outside India only.")).toBe(false);
  });
});

describe("dedupe", () => {
  it("detects similar titles", () => {
    expect(titleSimilarity("Quality Engineer", "Senior Quality Engineer")).toBeGreaterThan(0.5);
  });

  it("removes exact duplicates", () => {
    const job: NormalizedJob = {
      id: "a", source: "x", sourceJobId: "1", title: "Quality Engineer", companyName: "Bosch", companySlug: "bosch",
      description: "desc", location: "Bengaluru", city: "Bengaluru", country: "India", remoteStatus: "onsite",
      employmentType: "full-time", skillsRequired: [], applicationUrl: "u", applicationMethod: "external",
      postedAt: null, lastVerifiedAt: new Date().toISOString(), status: "active", reliability: 1, fingerprint: jobFingerprint("Bosch", "Quality Engineer", "Bengaluru"),
    };
    const result = dedupeBatch([job, { ...job, id: "b", source: "y", fingerprint: job.fingerprint }]);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it("creates application duplicate keys", () => {
    expect(applicationDuplicateKey("u1", "Bosch", "Quality Engineer")).toBe(applicationDuplicateKey("u1", "Bosch", "Quality Engineer"));
  });
});
