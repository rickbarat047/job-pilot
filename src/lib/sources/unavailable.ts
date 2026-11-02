import type { JobSourceAdapter, SourceFetchContext, SourceFetchResult } from "../types";

interface UnavailableSource {
  key: string;
  name: string;
  category: "indian-portal";
  description: string;
  reason: string;
  fallbackUrl: string;
  docsUrl?: string;
}

const UNAVAILABLE: UnavailableSource[] = [
  { key: "naukri", name: "Naukri", category: "indian-portal", description: "India's largest job portal.", reason: "Naukri does not provide a public, unauthenticated job-search API. Automated scraping would violate its terms and anti-bot controls.", fallbackUrl: "https://www.naukri.com/automobile-engineer-jobs" },
  { key: "indeed-india", name: "Indeed India", category: "indian-portal", description: "Aggregated job listings across India.", reason: "Indeed requires an approved publisher/partner integration for programmatic access.", fallbackUrl: "https://in.indeed.com/jobs?q=engineer&l=India" },
  { key: "linkedin-jobs", name: "LinkedIn Jobs", category: "indian-portal", description: "Professional network job listings.", reason: "LinkedIn's jobs APIs are restricted to approved partners and do not support unauthenticated bulk search.", fallbackUrl: "https://www.linkedin.com/jobs/search/?keywords=engineer&location=India" },
  { key: "foundit", name: "Foundit (Monster India)", category: "indian-portal", description: "Job portal for experienced and entry-level roles.", reason: "No public unauthenticated search API; scraping is not permitted.", fallbackUrl: "https://www.foundit.in/srp/results?query=engineer&locations=India" },
  { key: "timesjobs", name: "TimesJobs", category: "indian-portal", description: "Indian job portal.", reason: "No public unauthenticated search API.", fallbackUrl: "https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&from=submit&txtKeywords=engineer&txtLocation=India" },
  { key: "internshala", name: "Internshala", category: "indian-portal", description: "Internships and entry-level jobs for students and freshers.", reason: "No public unauthenticated search API.", fallbackUrl: "https://internshala.com/internships/engineering-internship" },
  { key: "freshersworld", name: "Freshersworld", category: "indian-portal", description: "Jobs for fresh graduates.", reason: "No public unauthenticated search API.", fallbackUrl: "https://www.freshersworld.com/jobs" },
  { key: "apna", name: "Apna", category: "indian-portal", description: "Jobs for India's working class and entry-level candidates.", reason: "No public unauthenticated search API.", fallbackUrl: "https://apna.co/jobs" },
  { key: "cutshort", name: "Cutshort", category: "indian-portal", description: "Startup and tech hiring platform.", reason: "No public unauthenticated search API.", fallbackUrl: "https://cutshort.io/jobs" },
  { key: "wellfound", name: "Wellfound (AngelList)", category: "indian-portal", description: "Startup jobs and equity-backed roles.", reason: "No public unauthenticated search API.", fallbackUrl: "https://wellfound.com/jobs" },
  { key: "hirist", name: "Hirist", category: "indian-portal", description: "Tech jobs in India.", reason: "No public unauthenticated search API.", fallbackUrl: "https://www.hirist.com" },
  { key: "instahyre", name: "Instahyre", category: "indian-portal", description: "Curated tech hiring platform.", reason: "No public unauthenticated search API.", fallbackUrl: "https://www.instahyre.com" },
  { key: "iimjobs", name: "IIMJobs", category: "indian-portal", description: "Premium and MBA-focused jobs.", reason: "No public unauthenticated search API.", fallbackUrl: "https://www.iimjobs.com" },
  { key: "shine", name: "Shine", category: "indian-portal", description: "Indian job portal.", reason: "No public unauthenticated search API.", fallbackUrl: "https://www.shine.com" },
  { key: "workindia", name: "WorkIndia", category: "indian-portal", description: "Blue-collar and entry-level jobs.", reason: "No public unauthenticated search API.", fallbackUrl: "https://www.workindia.in" },
  { key: "ncs", name: "National Career Service", category: "indian-portal", description: "Government-run employment exchange.", reason: "Requires authenticated registration; no unauthenticated bulk API.", fallbackUrl: "https://www.ncs.gov.in" },
  { key: "apprenticeship-india", name: "Apprenticeship India", category: "indian-portal", description: "Government apprenticeship portal.", reason: "Requires authenticated registration; no unauthenticated bulk API.", fallbackUrl: "https://www.apprenticeshipindia.gov.in" },
];

export const unavailableAdapters: JobSourceAdapter[] = UNAVAILABLE.map((source) => ({
  meta: {
    key: source.key,
    name: source.name,
    category: source.category,
    description: source.description,
    available: false,
    reason: source.reason,
    fallbackUrl: source.fallbackUrl,
    docsUrl: source.docsUrl,
    reliability: 0.5,
    enabled: false,
  },
  async fetchJobs(_ctx?: SourceFetchContext): Promise<SourceFetchResult> {
    return { jobs: [], errors: [], unavailable: source.reason };
  },
}));
