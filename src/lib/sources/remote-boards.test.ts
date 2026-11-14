import { describe, expect, it } from "vitest";
import { eligibleRemoteLocation, remoteBoardsAdapter } from "./remote-boards";

describe("remote job location eligibility", () => {
  it("accepts jobs explicitly open to India or candidates worldwide", () => {
    expect(eligibleRemoteLocation("India" )).toBe(true);
    expect(eligibleRemoteLocation("Remote — India and Singapore")).toBe(true);
    expect(eligibleRemoteLocation("Worldwide" )).toBe(true);
    expect(eligibleRemoteLocation("Anywhere in the world")).toBe(true);
  });

  it("fails closed when location eligibility is missing or excludes India", () => {
    expect(eligibleRemoteLocation("")).toBe(false);
    expect(eligibleRemoteLocation("Remote")).toBe(false);
    expect(eligibleRemoteLocation("United States, Canada" )).toBe(false);
    expect(eligibleRemoteLocation("Remote — India not eligible")).toBe(false);
    expect(eligibleRemoteLocation("Remote, excluding candidates from India")).toBe(false);
  });

  it("keeps India-restricted remote jobs classified as remote", async () => {
    let himalayasUrl = "";
    const result = await remoteBoardsAdapter.fetchJobs({
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.startsWith("https://remotive.com/")) {
          return new Response(JSON.stringify({ jobs: [] }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url.startsWith("https://himalayas.app/")) {
          himalayasUrl = url;
          return new Response(JSON.stringify({ jobs: [
            { title: "Remote Engineer", companyName: "Example Co", locationRestrictions: ["India"], description: "Remote role", guid: "india-remote", applicationLink: "https://example.com/apply" },
            { title: "Remote Engineer", companyName: "Other Co", locationRestrictions: ["Remote — India not eligible"], guid: "india-excluded", applicationLink: "https://example.com/apply" },
            { title: "Expired Engineer", companyName: "Closed Co", locationRestrictions: ["India"], expiryDate: Math.floor(Date.now() / 1000) - 60, guid: "india-expired", applicationLink: "https://example.com/apply" },
          ] }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ jobs: [] }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({ title: "Remote Engineer", country: "India", remoteStatus: "remote" });
    expect(result.jobs.some((job) => job.title === "Expired Engineer")).toBe(false);
    expect(result.skipped).toBe(2);
    expect(himalayasUrl).toContain("limit=20");
  });
});
