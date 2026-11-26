import { readFileSync } from "node:fs";
import { buildNormalizedJob } from "../normalize";
import type { JobSourceAdapter, NormalizedJob } from "../types";

interface FixtureJob {
  sourceJobId?: string;
  title?: string;
  companyName?: string;
  descriptionText?: string;
  location?: string;
  applicationUrl?: string;
}

/**
 * Test-only source adapter. It is never enabled for automatic discovery: the
 * E2E harness selects it explicitly with `sourceKeys: ["fixture"]` and points
 * its job URLs at a local fake employer server.
 */
export const fixtureAdapter: JobSourceAdapter = {
  meta: {
    key: "fixture",
    name: "E2E fixture source",
    category: "manual",
    description: "Deterministic jobs for isolated end-to-end tests only.",
    enabled: false,
    available: true,
    reliability: 0.8,
    requiresCredentials: false,
  },

  async fetchJobs(ctx) {
    // Explicit opt-in is required even when NODE_ENV is production (Next.js
    // `next start` forces production). The live deployment never sets these vars.
    if (process.env.E2E_ALLOW_FIXTURE !== "1") {
      return { jobs: [], errors: [], unavailable: "Fixture source requires E2E_ALLOW_FIXTURE=1." };
    }
    const fixturePath = process.env.E2E_FIXTURE_JOBS;
    if (!fixturePath) {
      return { jobs: [], errors: ["E2E_FIXTURE_JOBS is not configured."] };
    }
    try {
      const parsed = JSON.parse(readFileSync(fixturePath, "utf8"));
      if (!Array.isArray(parsed)) throw new Error("fixture file must contain an array of jobs");
      const limit = Math.max(0, ctx?.limit ?? parsed.length);
      const jobs: NormalizedJob[] = parsed.slice(0, limit).map((item: FixtureJob, index: number) => {
        if (!item.applicationUrl || !/^https?:\/\//i.test(item.applicationUrl)) {
          throw new Error(`fixture job ${index} has no valid applicationUrl`);
        }
        return buildNormalizedJob({
          source: "fixture",
          sourceJobId: item.sourceJobId || `e2e-${index + 1}`,
          title: item.title || "Software Engineer",
          companyName: item.companyName || "Fixture Technologies",
          descriptionText: item.descriptionText || "Role with Python, React and SQL.",
          location: item.location || "Bengaluru, India",
          applicationUrl: item.applicationUrl,
          applicationMethod: "external",
          reliability: 0.8,
          raw: { fixture: true },
        });
      });
      return { jobs, errors: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { jobs: [], errors: [`E2E_FIXTURE_JOBS could not be read: ${message}`] };
    }
  },
};
