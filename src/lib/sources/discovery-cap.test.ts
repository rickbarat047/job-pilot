import { describe, expect, it } from "vitest";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";

describe("India job source result limits", () => {
  it("does not let the Greenhouse result limit discard eligible jobs behind foreign roles", async () => {
    const jobs = [
      ...Array.from({ length: 35 }, (_, index) => ({
        id: index + 1,
        title: `Foreign role ${index + 1}`,
        absolute_url: `https://jobs.example/foreign-${index + 1}`,
        location: { name: "United States" },
      })),
      { id: 100, title: "India role", absolute_url: "https://jobs.example/india", location: { name: "Bengaluru, India" } },
    ];
    const result = await greenhouseAdapter.fetchJobs({ fetchImpl: async () => Response.json({ jobs }) });
    expect(result.jobs.some((job) => job.sourceJobId === "100")).toBe(true);
  });

  it("does not let the Lever result limit discard eligible jobs behind foreign roles", async () => {
    const postings = [
      ...Array.from({ length: 15 }, (_, index) => ({
        id: `foreign-${index + 1}`,
        text: `Foreign role ${index + 1}`,
        categories: { location: "United States" },
        country: "US",
      })),
      { id: "india", text: "India role", categories: { location: "Bengaluru, India" }, country: "IN" },
    ];
    const result = await leverAdapter.fetchJobs({ fetchImpl: async () => Response.json(postings) });
    expect(result.jobs.some((job) => job.sourceJobId === "india")).toBe(true);
  });

  it("does not let the Ashby result limit discard eligible jobs behind foreign roles", async () => {
    const jobs = [
      ...Array.from({ length: 45 }, (_, index) => ({
        id: `foreign-${index + 1}`,
        title: `Foreign role ${index + 1}`,
        location: "United States",
        jobUrl: `https://jobs.example/foreign-${index + 1}`,
      })),
      { id: "india", title: "India role", location: "Pune, India", jobUrl: "https://jobs.example/india" },
    ];
    const result = await ashbyAdapter.fetchJobs({ fetchImpl: async () => Response.json({ jobs }) });
    expect(result.jobs.some((job) => job.sourceJobId === "india")).toBe(true);
  });
});
