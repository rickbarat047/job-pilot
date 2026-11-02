import { createHash } from "node:crypto";
import type { NormalizedJob } from "./types";
import { companySlug, normalizeTitleForFingerprint } from "./normalize";

function tokens(title: string): Set<string> {
  const stop = new Set(["the", "and", "for", "with", "of", "in", "at", "to", "a", "an", "senior", "junior", "sr", "jr", "lead", "staff", "principal", "associate", "manager", "engineer", "executive", "assistant", "intern", "trainee"]);
  return new Set(normalizeTitleForFingerprint(title).split(" ").filter((t) => t.length > 1 && !stop.has(t)));
}

export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  return intersection / Math.max(ta.size, tb.size);
}

export function isLikelyDuplicate(a: NormalizedJob, b: NormalizedJob): boolean {
  if (a.id === b.id) return true;
  if (a.fingerprint === b.fingerprint) return true;
  if (companySlug(a.companyName) !== companySlug(b.companyName)) return false;
  const similarity = titleSimilarity(a.title, b.title);
  if (similarity >= 0.85) {
    const sameCity = !a.city || !b.city || a.city.toLowerCase() === b.city.toLowerCase();
    const sameCountry = a.country === b.country || a.country === "Unknown" || b.country === "Unknown";
    return sameCity && sameCountry;
  }
  return false;
}

export interface DedupeResult {
  unique: NormalizedJob[];
  duplicates: { job: NormalizedJob; duplicateOf: string }[];
}

/** Cross-source duplicate detection within a fetched batch. */
export function dedupeBatch(jobs: NormalizedJob[]): DedupeResult {
  const unique: NormalizedJob[] = [];
  const duplicates: { job: NormalizedJob; duplicateOf: string }[] = [];
  const byFingerprint = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const exact = byFingerprint.get(job.fingerprint);
    if (exact) {
      duplicates.push({ job, duplicateOf: exact.id });
      continue;
    }
    const fuzzy = unique.find((u) => isLikelyDuplicate(u, job));
    if (fuzzy) {
      duplicates.push({ job, duplicateOf: fuzzy.id });
      continue;
    }
    byFingerprint.set(job.fingerprint, job);
    unique.push(job);
  }
  return { unique, duplicates };
}

/** Stable key to prevent the same candidate applying twice to the same role. */
export function applicationDuplicateKey(userId: string, companyName: string, title: string): string {
  const base = `${userId}|${companySlug(companyName)}|${normalizeTitleForFingerprint(title)}`;
  return createHash("sha256").update(base).digest("hex");
}

export function jobUrlFingerprint(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return createHash("sha256").update(parsed.toString().replace(/\/$/, "")).digest("hex");
  } catch {
    return createHash("sha256").update(url).digest("hex");
  }
}

