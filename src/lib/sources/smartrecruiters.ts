import type { JobSourceAdapter, NormalizedJob, SourceFetchContext, SourceFetchResult } from "../types";
import { COMPANY_REGISTRY } from "../companies/registry";
import { buildNormalizedJob, parseLocation } from "../normalize";
import { fetchJson, mapWithConcurrency } from "./http";

interface SRPosting {
  id: string;
  name: string;
  uuid?: string;
  refNumber?: string;
  company?: { identifier: string; name: string };
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; fullLocation?: string; remote?: boolean; hybrid?: boolean };
  industry?: { id: string; label: string };
  function?: { id: string; label: string };
  typeOfEmployment?: { id: string; label: string };
  experienceLevel?: { id: string; label: string };
  applyUrl?: string;
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
  active?: boolean;
}

interface SRListResponse {
  totalFound?: number;
  content?: SRPosting[];
}

interface SRDetail extends SRPosting {
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
}

const PER_BOARD_LIMIT = 3;

function sectionText(detail: SRDetail): string {
  const sections = detail.jobAd?.sections ?? {};
  return Object.values(sections)
    .map((section) => `${section.title ? `<h4>${section.title}</h4>` : ""}${section.text ?? ""}`)
    .join("\n");
}

function locationString(p: SRPosting): string {
  const loc = p.location;
  if (!loc) return "";
  const parts = [loc.city, loc.region, loc.country ? loc.country.toUpperCase() : ""].filter(Boolean);
  return loc.fullLocation || parts.join(", ");
}

export const smartRecruitersAdapter: JobSourceAdapter = {
  meta: {
    key: "smartrecruiters",
    name: "SmartRecruiters",
    category: "ats",
    description: "Public postings API for companies using SmartRecruiters.",
    available: true,
    docsUrl: "https://developers.smartrecruiters.com/docs/partners",
    reliability: 0.9,
    enabled: true,
  },
  async fetchJobs(ctx: SourceFetchContext = {}): Promise<SourceFetchResult> {
    const boards = COMPANY_REGISTRY.filter((c) => c.ats?.type === "smartrecruiters");
    const errors: string[] = [];
    const jobs: NormalizedJob[] = [];
    let skipped = 0;
    const boardResults = await mapWithConcurrency(boards, 2, async (company) => {
      const localJobs: NormalizedJob[] = [];
      const localErrors: string[] = [];
      let localSkipped = 0;
      try {
        const listUrl = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company.ats!.identifier)}/postings?limit=100&country=in`;
        const list = await fetchJson<SRListResponse>(listUrl, { fetchImpl: ctx.fetchImpl, timeoutMs: 25_000 });
        const postings = (list.content ?? []).filter((p) => p.active !== false).slice(0, PER_BOARD_LIMIT);
        const details = await mapWithConcurrency(postings, 4, async (posting) => {
          try {
            const detail = await fetchJson<SRDetail>(
              `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company.ats!.identifier)}/postings/${encodeURIComponent(posting.id)}`,
              { fetchImpl: ctx.fetchImpl, timeoutMs: 20_000 },
            );
            return detail;
          } catch (error) {
            localErrors.push(`${company.name}/${posting.id}: ${error instanceof Error ? error.message : String(error)}`);
            return posting;
          }
        });
        for (const detail of details) {
          const loc = locationString(detail);
          const parsed = parseLocation(loc);
          if (parsed.country !== "India") { localSkipped++; continue; }
          localJobs.push(
            buildNormalizedJob({
              source: "smartrecruiters",
              sourceJobId: detail.id,
              title: detail.name,
              companyName: company.name,
              companyWebsite: company.website,
              careerPageUrl: company.careersUrl,
              descriptionHtml: sectionText(detail),
              location: loc,
              employmentType: detail.typeOfEmployment?.label ?? "",
              salaryText: "",
              applicationUrl: detail.applyUrl || detail.postingUrl || company.careersUrl,
              applicationMethod: "external",
              postedAt: detail.releasedDate,
              reliability: 0.9,
              raw: { board: company.ats!.identifier, id: detail.id },
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
