import { describe, it, expect } from "vitest";
import { parseLocation, parseSalary, stripHtml, jobFingerprint } from "./normalize";
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

  it("strips HTML", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("creates stable fingerprints", () => {
    expect(jobFingerprint("Groww", "Quality Engineer", "Bengaluru")).toBe(jobFingerprint("Groww", "Quality Engineer", "Bengaluru"));
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
