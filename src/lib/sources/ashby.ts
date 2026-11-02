import type { JobSourceAdapter, NormalizedJob, SourceFetchContext, SourceFetchResult } from "../types";
import { COMPANY_REGISTRY } from "../companies/registry";
import { buildNormalizedJob, parseLocation } from "../normalize";
import { fetchJson, mapWithConcurrency } from "./http";

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: string[];
  publishedAt?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
}

interface AshbyResponse {
  jobs?: AshbyJob[];
}

const PER_BOARD_LIMIT = 40;

export const ashbyAdapter: JobSourceAdapter = {
  meta: {
    key: "ashby",
    name: "Ashby Job Boards",
    category: "ats",
    description: "Public posting API for companies using Ashby.",
    available: true,
    docsUrl: "https://developers.ashbyhq.com/docs/public-job-posting-api",
    reliability: 0.95,
    enabled: true,
  },
  async fetchJobs(ctx: SourceFetchContext = {}): Promise<SourceFetchResult> {
    const boards = COMPANY_REGISTRY.filter((c) => c.ats?.type === "ashby");
    const errors: string[] = [];
    const jobs: NormalizedJob[] = [];
    let skipped = 0;
    const boardResults = await mapWithConcurrency(boards, 4, async (company) => {
      const localJobs: NormalizedJob[] = [];
      const localErrors: string[] = [];
      let localSkipped = 0;
      try {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company.ats!.identifier)}`;
        const data = await fetchJson<AshbyResponse>(url, { fetchImpl: ctx.fetchImpl, timeoutMs: 25_000 });
        const boardJobs = (data.jobs ?? []).filter((j) => j.isListed !== false).slice(0, PER_BOARD_LIMIT);
        for (const job of boardJobs) {
          const allLocations = [job.location ?? "", ...(job.secondaryLocations ?? [])];
          const locationText = allLocations.filter(Boolean).join(", ");
          const india = allLocations.some((loc) => /india/i.test(loc));
          const remoteGlobal = Boolean(job.isRemote) && /worldwide|global|anywhere|remote/i.test(locationText);
          if (!india && !remoteGlobal) { localSkipped++; continue; }
          localJobs.push(
            buildNormalizedJob({
              source: "ashby",
              sourceJobId: job.id,
              title: job.title,
              companyName: company.name,
              companyWebsite: company.website,
              careerPageUrl: company.careersUrl,
              descriptionHtml: job.descriptionHtml ?? job.descriptionPlain ?? "",
              descriptionText: job.descriptionPlain ?? "",
              location: locationText || (job.isRemote ? "Remote" : "Location not specified"),
              workplaceType: job.workplaceType ?? (job.isRemote ? "Remote" : ""),
              employmentType: job.employmentType ?? "",
              applicationUrl: job.applyUrl || job.jobUrl || company.careersUrl,
              applicationMethod: "external",
              postedAt: job.publishedAt,
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
