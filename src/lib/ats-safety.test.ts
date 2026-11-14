import { describe, expect, it } from "vitest";
import { supportedAtsForUrl } from "./ats-safety";

describe("supportedAtsForUrl", () => {
  it.each([
    ["https://boards.greenhouse.io/acme", "greenhouse"],
    ["https://jobs.lever.co/acme", "lever"],
    ["https://jobs.ashbyhq.com/acme", "ashby"],
    ["https://careers.smartrecruiters.com/acme", "smartrecruiters"],
    ["https://acme.myworkdayjobs.com/en-US/careers", "workday"],
  ])("recognizes %s", (url, expected) => expect(supportedAtsForUrl(url)).toBe(expected));

  it.each([
    "https://greenhouse.io.attacker.example/apply",
    "https://attacker-greenhouse.io/apply",
    "http://boards.greenhouse.io/acme",
    "file:///etc/passwd",
    "https://user:pass@jobs.lever.co/acme",
    "https://example.com/jobs",
  ])("rejects unsupported URL %s", (url) => expect(supportedAtsForUrl(url)).toBeNull());
});
