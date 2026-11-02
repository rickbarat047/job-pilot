import type { JobSourceAdapter, NormalizedJob, SourceFetchContext, SourceFetchResult } from "../types";
import { buildNormalizedJob } from "../normalize";
import { fetchJson } from "./http";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface RemotiveResponse {
  jobs?: RemotiveJob[];
}

interface HimalayasJob {
  title: string;
  excerpt?: string;
  companyName: string;
  companySlug?: string;
  employmentType?: string;
  minSalary?: number;
  maxSalary?: number;
  salaryPeriod?: string;
  currency?: string;
  seniority?: string;
  locationRestrictions?: string[];
  categories?: string[];
  parentCategories?: string[];
  description?: string;
  pubDate?: number;
  expiryDate?: number;
  applicationLink?: string;
  guid?: string;
}

interface HimalayasResponse {
  jobs?: HimalayasJob[];
}

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobIndustry?: string[];
  jobType?: string;
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
}

interface JobicyResponse {
  jobs?: JobicyJob[];
}

function eligibleRemoteLocation(location: string): boolean {
  const lower = (location || "").toLowerCase();
  if (!lower) return true;
  if (/india/.test(lower)) return true;
  if (/worldwide|anywhere|global|remote/.test(lower)) return true;
  if (/usa|united states|uk|canada|europe|australia|germany|france/.test(lower) && !/remote/.test(lower)) return false;
  return true;
}

export const remoteBoardsAdapter: JobSourceAdapter = {
  meta: {
    key: "remote-boards",
    name: "Remote Job Boards",
    category: "remote-board",
    description: "Public APIs for Remotive, Himalayas and Jobicy, filtered for India-eligible remote roles.",
    available: true,
    docsUrl: "https://remotive.com/api-documentation",
    reliability: 0.8,
    enabled: true,
  },
  async fetchJobs(ctx: SourceFetchContext = {}): Promise<SourceFetchResult> {
    const errors: string[] = [];
    const jobs: NormalizedJob[] = [];
    let skipped = 0;

    try {
      const data = await fetchJson<RemotiveResponse>("https://remotive.com/api/remote-jobs?limit=100", { fetchImpl: ctx.fetchImpl, timeoutMs: 25_000 });
      for (const job of (data.jobs ?? []).slice(0, 20)) {
        if (!eligibleRemoteLocation(job.candidate_required_location ?? "")) { skipped++; continue; }
        jobs.push(
          buildNormalizedJob({
            source: "remotive",
            sourceJobId: String(job.id),
            title: job.title,
            companyName: job.company_name,
            descriptionHtml: job.description ?? "",
            location: job.candidate_required_location || "Remote",
            workplaceType: "Remote",
            employmentType: job.job_type ?? "",
            salaryText: job.salary ?? "",
            applicationUrl: job.url,
            applicationMethod: "external",
            postedAt: job.publication_date,
            reliability: 0.8,
            raw: job,
          }),
        );
      }
    } catch (error) {
      errors.push(`Remotive: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const data = await fetchJson<HimalayasResponse>("https://himalayas.app/jobs/api?limit=100", { fetchImpl: ctx.fetchImpl, timeoutMs: 25_000 });
      for (const job of (data.jobs ?? []).slice(0, 20)) {
        const restrictions = job.locationRestrictions ?? [];
        const locationText = restrictions.length ? restrictions.join(", ") : "Remote";
        if (restrictions.length && !restrictions.some((r) => /india/i.test(r)) && !restrictions.some((r) => /worldwide|anywhere|global/i.test(r))) {
          skipped++;
          continue;
        }
        const salaryText = job.minSalary && job.maxSalary ? `${job.minSalary}-${job.maxSalary} ${job.currency ?? "USD"} ${job.salaryPeriod ?? "year"}` : "";
        jobs.push(
          buildNormalizedJob({
            source: "himalayas",
            sourceJobId: job.guid ?? `${job.companyName}-${job.title}`,
            title: job.title,
            companyName: job.companyName,
            descriptionHtml: job.description ?? job.excerpt ?? "",
            location: locationText,
            workplaceType: restrictions.length ? "Hybrid" : "Remote",
            employmentType: job.employmentType ?? "",
            salaryText,
            applicationUrl: job.applicationLink || "https://himalayas.app/jobs",
            applicationMethod: "external",
            postedAt: job.pubDate ? new Date(job.pubDate * 1000) : null,
            reliability: 0.75,
            raw: job,
          }),
        );
      }
    } catch (error) {
      errors.push(`Himalayas: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const data = await fetchJson<JobicyResponse>("https://jobicy.com/api/v2/remote-jobs?count=50", { fetchImpl: ctx.fetchImpl, timeoutMs: 25_000 });
      for (const job of (data.jobs ?? []).slice(0, 20)) {
        if (!eligibleRemoteLocation(job.jobGeo ?? "")) { skipped++; continue; }
        const salaryText = job.salaryMin && job.salaryMax ? `${job.salaryMin}-${job.salaryMax} ${job.salaryCurrency ?? "USD"} ${job.salaryPeriod ?? "year"}` : "";
        jobs.push(
          buildNormalizedJob({
            source: "jobicy",
            sourceJobId: String(job.id),
            title: job.jobTitle,
            companyName: job.companyName,
            descriptionHtml: job.jobDescription ?? job.jobExcerpt ?? "",
            location: job.jobGeo || "Remote",
            workplaceType: "Remote",
            employmentType: job.jobType ?? "",
            salaryText,
            applicationUrl: job.url,
            applicationMethod: "external",
            postedAt: job.pubDate,
            reliability: 0.75,
            raw: job,
          }),
        );
      }
    } catch (error) {
      errors.push(`Jobicy: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { jobs, errors, skipped };
  },
};
