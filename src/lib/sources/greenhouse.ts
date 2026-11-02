import type { JobSourceAdapter, NormalizedJob, SourceFetchContext, SourceFetchResult } from "../types";
import { COMPANY_REGISTRY } from "../companies/registry";
import { buildNormalizedJob, decodeEntities, isIndiaEligibleRemote, parseLocation } from "../normalize";
import { fetchJson, mapWithConcurrency } from "./http";

interface GreenhouseJob {
  id: number;
  title: string;
  company_name?: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  updated_at?: string;
  first_published?: string;
  metadata?: { name: string; value: string | number | boolean | null }[];
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

const PER_BOARD_LIMIT = 30;

export const greenhouseAdapter: JobSourceAdapter = {
  meta: {
    key: "greenhouse",
    name: "Greenhouse Job Boards",
    category: "ats",
    description: "Public job-board API for companies using Greenhouse. Only verified company board tokens are polled.",
    available: true,
    docsUrl: "https://developers.greenhouse.io/job-board.html",
    reliability: 0.95,
    enabled: true,
  },
  async fetchJobs(ctx: SourceFetchContext = {}): Promise<SourceFetchResult> {
    const boards = COMPANY_REGISTRY.filter((c) => c.ats?.type === "greenhouse");
    const errors: string[] = [];
    const jobs: NormalizedJob[] = [];
    let skipped = 0;
    const boardResults = await mapWithConcurrency(boards, 4, async (company) => {
      const localJobs: NormalizedJob[] = [];
      const localErrors: string[] = [];
      let localSkipped = 0;
      try {
        const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.ats!.identifier)}/jobs?content=true`;
        const data = await fetchJson<GreenhouseResponse>(url, { fetchImpl: ctx.fetchImpl, timeoutMs: 25_000 });
        const boardJobs = (data.jobs ?? []).slice(0, PER_BOARD_LIMIT);
        for (const job of boardJobs) {
          const location = job.location?.name ?? "";
          const parsed = parseLocation(location);
          if (parsed.country !== "India" && !isIndiaEligibleRemote(location, job.content ?? "")) {
            localSkipped++;
            continue;
          }
          const html = decodeEntities(job.content ?? "");
          localJobs.push(
            buildNormalizedJob({
              source: "greenhouse",
              sourceJobId: String(job.id),
              title: job.title,
              companyName: company.name,
              companyWebsite: company.website,
              careerPageUrl: company.careersUrl,
              descriptionHtml: html,
              location,
              applicationUrl: job.absolute_url,
              applicationMethod: "external",
              postedAt: job.first_published ?? job.updated_at,
              reliability: 0.95,
              raw: { board: company.ats!.identifier, id: job.id },
            }),
          );
        }
      } catch (error) {
        localErrors.push(`${company.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
      return { localJobs, localErrors, localSkipped };
    });
    for (const result of boardResults) {
      jobs.push(...result.localJobs);
      errors.push(...result.localErrors);
      skipped += result.localSkipped;
    }
    return { jobs, errors, skipped };
  },
};
