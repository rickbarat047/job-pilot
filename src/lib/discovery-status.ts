export type DiscoverySourceStatus = { jobs: number; errors: string[]; unavailable?: string };

export function discoveryRunStatus(sources: DiscoverySourceStatus[]): "succeeded" | "partial" | "failed" {
  if (sources.length === 0) return "failed";

  const availableSources = sources.filter((source) => !source.unavailable);
  if (availableSources.length === 0) return "failed";

  const usableSources = availableSources.filter((source) => source.errors.length === 0 || source.jobs > 0);
  if (usableSources.length === 0) return "failed";

  if (sources.some((source) => source.unavailable) || availableSources.some((source) => source.errors.length > 0)) return "partial";
  return "succeeded";
}
