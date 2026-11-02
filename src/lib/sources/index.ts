import type { JobSourceAdapter } from "../types";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";
import { smartRecruitersAdapter } from "./smartrecruiters";
import { remoteBoardsAdapter } from "./remote-boards";
import { unavailableAdapters } from "./unavailable";
import { manualAdapter } from "./manual";

export const SOURCE_ADAPTERS: JobSourceAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  smartRecruitersAdapter,
  remoteBoardsAdapter,
  manualAdapter,
  ...unavailableAdapters,
];

export function getAdapter(key: string): JobSourceAdapter | undefined {
  return SOURCE_ADAPTERS.find((adapter) => adapter.meta.key === key);
}

export function enabledAdapters(keys?: string[]): JobSourceAdapter[] {
  const selected = keys?.map((key) => getAdapter(key)).filter(Boolean) as JobSourceAdapter[];
  if (selected?.length) return selected;
  return SOURCE_ADAPTERS.filter((adapter) => adapter.meta.enabled && adapter.meta.available);
}

export * from "./http";
export * from "./greenhouse";
export * from "./lever";
export * from "./ashby";
export * from "./smartrecruiters";
export * from "./remote-boards";
export * from "./unavailable";
export * from "./manual";
