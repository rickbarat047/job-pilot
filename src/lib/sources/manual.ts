import type { JobSourceAdapter, SourceFetchContext, SourceFetchResult } from "../types";

export const manualAdapter: JobSourceAdapter = {
  meta: {
    key: "manual",
    name: "Manual Job Import",
    category: "manual",
    description: "User-provided job links or pasted descriptions.",
    available: true,
    reliability: 1,
    enabled: true,
  },
  async fetchJobs(_ctx?: SourceFetchContext): Promise<SourceFetchResult> {
    return { jobs: [], errors: [], skipped: 0 };
  },
};
