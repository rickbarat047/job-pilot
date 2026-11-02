import type { JobSourceAdapter, NormalizedJob, SourceFetchContext, SourceFetchResult } from "../types";
import { COMPANY_REGISTRY } from "../companies/registry";
import { buildNormalizedJob, parseLocation } from "../normalize";
import { fetchJson, mapWithConcurrency } from "./http";

interface LeverPosting {
  id: string;
  text: string;
  categories?: { commitment?: string; department?: string; location?: string; team?: string; allLocations?: string[] };
  description?: string;
  descriptionPlain?: string;
  descriptionBody?: string;
  descriptionBodyPlain?: string;
  lists?: { text: string; content: string }[];
  additional?: string;
  additionalPlain?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  country?: string;
  workplaceType?: string;
}

const PER_BOARD_LIMIT = 10;

function leverDescription(job: LeverPosting): string {
  const parts = [job.descriptionBody ?? job.description ?? "", job.descriptionBodyPlain ?? job.descriptionPlain ?? ""];
  for (const list of job.lists ?? []) parts.push(`<h4>${list.text}</h4>${list.content}`);
  if (job.additional) parts.push(job.additional);
  return parts.filter(Boolean).join("\n");
}

export const leverAdapter: JobSourceAdapter = {
  meta: {
    key: "lever",
    name: "Lever Postings",
    category: "ats",
    description: "Public postings API for companies using Lever.",
    available: true,
    docsUrl: "https://github.com/lever/postings-api",
    reliability: 0.95,
    enabled: true,
  },
  async fetchJobs(ctx: SourceFetchContext = {}): Promise<SourceFetchResult> {
    const boards = COMPANY_REGISTRY.filter((c) => c.ats?.type === "lever");
    const errors: string[] = [];
    const jobs: NormalizedJob[] = [];
    let skipped = 0;
    const boardResults = await mapWithConcurrency(boards, 4, async (company) => {
      const localJobs: NormalizedJob[] = [];
      const localErrors: string[] = [];
      let localSkipped = 0;
      try {
        const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company.ats!.identifier)}?mode=json`;
        const data = await fetchJson<LeverPosting[]>(url, { fetchImpl: ctx.fetchImpl, timeoutMs: 25_000 });
        const boardJobs = (data ?? []).slice(0, PER_BOARD_LIMIT);
        for (const job of boardJobs) {
          const location = job.categories?.location ?? (job.categories?.allLocations ?? []).join(", ") ?? "";
          const country = (job.country ?? "").toUpperCase();
          const parsed = parseLocation(location);
          if (country && country !== "IN" && parsed.country !== "India") {
            if (!/india/i.test(location)) { localSkipped++; continue; }
          }
          if (parsed.country !== "India" && !/india/i.test(location)) { localSkipped++; continue; }
          localJobs.push(
            buildNormalizedJob({
              source: "lever",
              sourceJobId: job.id,
              title: job.text,
              companyName: company.name,
              companyWebsite: company.website,
              careerPageUrl: company.careersUrl,
              descriptionHtml: leverDescription(job),
              location,
              employmentType: job.categories?.commitment ?? "",
              salaryText: "",
              applicationUrl: job.applyUrl || job.hostedUrl || company.careersUrl,
              applicationMethod: "external",
              postedAt: job.createdAt ? new Date(job.createdAt) : null,
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
