export type DiscoverySourceStatus = { jobs: number; errors: string[] };

export function discoveryRunStatus(sources: DiscoverySourceStatus[]): "succeeded" | "partial" | "failed" {
  if (sources.length === 0 || sources.every((source) => source.errors.length > 0 && source.jobs === 0)) return "failed";
  if (sources.some((source) => source.errors.length > 0)) return "partial";
  return "succeeded";
}
