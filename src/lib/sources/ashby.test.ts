import { describe, expect, it } from "vitest";
import { ashbyAdapter } from "./ashby";

describe("Ashby India job eligibility", () => {
  it("keeps India-located roles and eligible worldwide remote roles only", async () => {
    const result = await ashbyAdapter.fetchJobs({
      fetchImpl: async () => new Response(JSON.stringify({ jobs: [
        { id: "us-only", title: "Remote US Engineer", location: "Remote — United States", isRemote: true, descriptionPlain: "US only" },
        { id: "worldwide", title: "Global Engineer", location: "Worldwide", isRemote: true, descriptionPlain: "Remote worldwide" },
        { id: "india-city", title: "Bengaluru Engineer", location: "Bengaluru", isRemote: false },
        { id: "india-excluded", title: "Remote Engineer", location: "Remote — India not eligible", isRemote: true },
      ] }), { status: 200, headers: { "content-type": "application/json" } }),
    });

    expect(result.jobs.map((job) => job.sourceJobId)).toEqual(["worldwide", "india-city"]);
    expect(result.jobs[0].remoteStatus).toBe("remote");
    expect(result.jobs[1].country).toBe("India");
    expect(result.skipped).toBe(2);
  });
});
