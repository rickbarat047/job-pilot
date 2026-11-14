import { get, newId, nowIso, run, all } from "./db";
import { createHash } from "node:crypto";
import { getProfile, getPreferences, getPermissionsForUser, getJobById } from "./repositories";
import { matchJob } from "./matching";
import { dedupeBatch, applicationDuplicateKey } from "./dedupe";
import { COMPANY_REGISTRY, findRegistryCompany } from "./companies/registry";
import { enabledAdapters } from "./sources";
import { createNotification } from "./repositories";
import type { NormalizedJob, SourceFetchResult } from "./types";
import { evaluatePermission } from "./permissions";
import { discoveryRunStatus } from "./discovery-status";

interface UpsertJobResult { id: string; isNew: boolean; }

async function findCompanyForJob(job: NormalizedJob): Promise<string | null> {
  const registry = findRegistryCompany(job.companyName) ?? findRegistryCompany(job.companySlug);
  if (registry) {
    const row = await get<{ id: string }>("SELECT id FROM companies WHERE slug = ?", [registry.slug]);
    if (row) return row.id;
  }
  const existing = await get<{ id: string }>("SELECT id FROM companies WHERE slug = ?", [job.companySlug]);
  if (existing) return existing.id;
  const id = newId("cmp");
  const now = nowIso();
  await run(
    `INSERT INTO companies (id, name, slug, website, careers_url, industry, location, source, verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'discovered', 0, ?, ?)`,
    [id, job.companyName, job.companySlug, job.companyWebsite ?? null, job.careerPageUrl ?? null, null, job.city ?? job.location, now, now],
  );
  return id;
}

export async function upsertJob(job: NormalizedJob, ownerUserId?: string): Promise<UpsertJobResult> {
  if (job.source === "manual" && !ownerUserId) throw new Error("Manual jobs must have an owning account.");
  const storedJob = job.source === "manual"
    ? { ...job, fingerprint: createHash("sha256").update(`${ownerUserId}:${job.fingerprint}`).digest("hex") }
    : job;
  const now = nowIso();
  const existingById = await get<{ id: string }>("SELECT id FROM jobs WHERE id = ?", [storedJob.id]);
  if (existingById) {
    await run(
      `UPDATE jobs SET title=?, company_name=?, description=?, description_html=?, location=?, city=?, country=?,
       remote_status=?, employment_type=?, experience_required=?, education_requirements=?, skills_required=?,
       salary_min=?, salary_max=?, salary_currency=?, salary_text=?, application_url=?, application_method=?,
       posted_at=COALESCE(?, posted_at), last_verified_at=?, status='active', reliability=?, raw_json=?, updated_at=? WHERE id=?`,
      [storedJob.title, storedJob.companyName, storedJob.description, storedJob.descriptionHtml ?? null, storedJob.location, storedJob.city ?? null, storedJob.country,
        storedJob.remoteStatus, storedJob.employmentType, storedJob.experienceRequired ?? null, storedJob.educationRequirements ?? null, JSON.stringify(storedJob.skillsRequired),
        storedJob.salaryMin ?? null, storedJob.salaryMax ?? null, storedJob.salaryCurrency ?? null, storedJob.salaryText ?? null, storedJob.applicationUrl, storedJob.applicationMethod,
        storedJob.postedAt ?? null, now, storedJob.reliability, JSON.stringify(storedJob.raw ?? {}), now, storedJob.id],
    );
    return { id: storedJob.id, isNew: false };
  }
  const existingByFingerprint = await get<{ id: string }>("SELECT id FROM jobs WHERE fingerprint = ?", [storedJob.fingerprint]);
  if (existingByFingerprint) {
    await run(
      `UPDATE jobs SET last_verified_at=?, status='active', reliability=CASE WHEN reliability > ? THEN reliability ELSE ? END, updated_at=? WHERE id=?`,
      [now, storedJob.reliability, storedJob.reliability, now, existingByFingerprint.id],
    );
    return { id: existingByFingerprint.id, isNew: false };
  }
  const companyId = await findCompanyForJob(storedJob);
  await run(
    `INSERT INTO jobs (id, owner_user_id, title, company_id, company_name, company_website, career_page_url, description, description_html,
      location, city, country, remote_status, employment_type, experience_required, education_requirements, skills_required,
      salary_min, salary_max, salary_currency, salary_text, application_url, application_method, source, source_job_id,
      posted_at, last_verified_at, status, reliability, fingerprint, raw_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    [storedJob.id, storedJob.source === "manual" ? ownerUserId! : null, storedJob.title, companyId, storedJob.companyName, storedJob.companyWebsite ?? null, storedJob.careerPageUrl ?? null, storedJob.description,
      storedJob.descriptionHtml ?? null, storedJob.location, storedJob.city ?? null, storedJob.country, storedJob.remoteStatus, storedJob.employmentType,
      storedJob.experienceRequired ?? null, storedJob.educationRequirements ?? null, JSON.stringify(storedJob.skillsRequired), storedJob.salaryMin ?? null, storedJob.salaryMax ?? null,
      storedJob.salaryCurrency ?? null, storedJob.salaryText ?? null, storedJob.applicationUrl, storedJob.applicationMethod, storedJob.source, storedJob.sourceJobId,
      storedJob.postedAt ?? null, now, storedJob.reliability, storedJob.fingerprint, JSON.stringify(storedJob.raw ?? {}), now, now],
  );
  return { id: storedJob.id, isNew: true };
}

export interface DiscoveryOptions {
  sourceKeys?: string[];
  limit?: number;
  match?: boolean;
}

export interface DiscoveryResult {
  runId: string;
  sources: { key: string; jobs: number; errors: string[]; unavailable?: string }[];
  fetched: number;
  inserted: number;
  duplicatesRemoved: number;
  matched: number;
  newHighMatches: number;
  errors: string[];
}

export function shouldNotifyStrongMatch(
  result: { overallScore: number; qualified: boolean },
  previousScore: number | null,
): boolean {
  return result.qualified && result.overallScore >= 75 && (previousScore === null || previousScore < 75);
}

export async function runDiscovery(userId: string, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const permissions = await getPermissionsForUser(userId);
  const decision = evaluatePermission(permissions, "search_jobs");
  if (!decision.allowed) throw new Error(decision.reason);

  const now = nowIso();
  const runId = newId("run");
  await run(
    "INSERT INTO automation_runs (id, user_id, trigger, status, summary, started_at) VALUES (?, ?, 'manual', 'running', '{}', ?)",
    [runId, userId, now],
  );

  const adapters = enabledAdapters(options.sourceKeys);
  const sourceResults: { key: string; jobs: number; errors: string[]; unavailable?: string }[] = [];
  const allJobs: NormalizedJob[] = [];
  const errors: string[] = [];

  const { mapWithConcurrency } = await import("./sources/http");
  const adapterResults = await mapWithConcurrency(adapters, 3, async (adapter) => {
    try {
      const result: SourceFetchResult = await adapter.fetchJobs({ limit: options.limit });
      await run(
        "UPDATE job_sources SET status=?, last_run_at=?, last_error=?, updated_at=? WHERE key=?",
        [result.errors.length && result.jobs.length === 0 ? "error" : "ok", nowIso(), result.errors.join("; ") || null, nowIso(), adapter.meta.key],
      );
      return {
        key: adapter.meta.key,
        jobs: result.jobs.length,
        errors: result.errors,
        unavailable: result.unavailable,
        fetchedJobs: result.jobs,
        adapterErrors: result.errors.map((msg) => `${adapter.meta.name}: ${msg}`),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await run("UPDATE job_sources SET status='error', last_run_at=?, last_error=?, updated_at=? WHERE key=?", [nowIso(), msg, nowIso(), adapter.meta.key]);
      return {
        key: adapter.meta.key,
        jobs: 0,
        errors: [msg],
        fetchedJobs: [],
        adapterErrors: [`${adapter.meta.name}: ${msg}`],
      };
    }
  });

  for (const result of adapterResults) {
    sourceResults.push({ key: result.key, jobs: result.jobs, errors: result.errors, unavailable: result.unavailable });
    allJobs.push(...result.fetchedJobs);
    errors.push(...result.adapterErrors);
  }

  const deduped = dedupeBatch(allJobs);
  let inserted = 0;
  const jobIds: string[] = [];
  for (const job of deduped.unique) {
    const result = await upsertJob(job);
    jobIds.push(result.id);
    if (result.isNew) inserted++;
  }

  const prefs = await getPreferences(userId);
  const profile = await getProfile(userId);
  let matched = 0;
  let newHighMatches = 0;
  if (options.match !== false) {
    for (const jobId of jobIds) {
      const job = await getJobById(jobId);
      if (!job) continue;
      const result = matchJob(profile, prefs, job);
      const existing = await get<{ id: string; overall_score: number }>("SELECT id, overall_score FROM job_matches WHERE user_id = ? AND job_id = ?", [userId, jobId]);
      if (existing) {
        await run(
          `UPDATE job_matches SET overall_score=?, skill_score=?, education_score=?, experience_score=?, career_score=?,
           location_score=?, salary_score=?, flexibility_score=?, freshness_score=?, strengths=?, gaps=?,
           missing_requirements=?, disqualifiers=?, explanation=?, recommended_action=?, qualified=?, role_family=?, updated_at=? WHERE id=?`,
          [result.overallScore, result.skillScore, result.educationScore, result.experienceScore, result.careerScore,
            result.locationScore, result.salaryScore, result.flexibilityScore, result.freshnessScore,
            JSON.stringify(result.strengths), JSON.stringify(result.gaps), JSON.stringify(result.missingRequirements),
            JSON.stringify(result.disqualifiers), result.explanation, result.recommendedAction, result.qualified ? 1 : 0,
            result.roleFamily, nowIso(), existing.id],
        );
      } else {
        await run(
          `INSERT INTO job_matches (id, user_id, job_id, overall_score, skill_score, education_score, experience_score,
           career_score, location_score, salary_score, flexibility_score, freshness_score, strengths, gaps,
           missing_requirements, disqualifiers, explanation, recommended_action, qualified, role_family, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId("mat"), userId, jobId, result.overallScore, result.skillScore, result.educationScore, result.experienceScore,
            result.careerScore, result.locationScore, result.salaryScore, result.flexibilityScore, result.freshnessScore,
            JSON.stringify(result.strengths), JSON.stringify(result.gaps), JSON.stringify(result.missingRequirements),
            JSON.stringify(result.disqualifiers), result.explanation, result.recommendedAction, result.qualified ? 1 : 0,
            result.roleFamily, nowIso(), nowIso()],
        );
      }
      matched++;
      if (shouldNotifyStrongMatch(result, existing ? Number(existing.overall_score) : null)) {
        const jobRow = await get<{ title: string; company_name: string }>("SELECT title, company_name FROM jobs WHERE id = ?", [jobId]);
        await createNotification(userId, "match", "Strong job match", `${jobRow?.title ?? "A role"} at ${jobRow?.company_name ?? "a company"} scored ${result.overallScore}.`, `/jobs/${jobId}`);
        newHighMatches++;
      }
    }
  }

  const runStatus = discoveryRunStatus(sourceResults);
  await run(
    "UPDATE automation_runs SET status=?, summary=?, finished_at=? WHERE id=?",
    [runStatus, JSON.stringify({ fetched: allJobs.length, inserted, duplicates: deduped.duplicates.length, matched, newHighMatches, errors: errors.length }), nowIso(), runId],
  );
  await run(
    "INSERT INTO automation_logs (id, user_id, run_id, level, message, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [newId("log"), userId, runId, runStatus === "succeeded" ? "info" : "warn", `Discovery ${runStatus}: ${allJobs.length} fetched, ${inserted} new, ${matched} matched.`, JSON.stringify({ errors }), nowIso()],
  );

  return {
    runId,
    sources: sourceResults,
    fetched: allJobs.length,
    inserted,
    duplicatesRemoved: deduped.duplicates.length,
    matched,
    newHighMatches,
    errors,
  };
}

export function createApplicationDraft(userId: string, jobId: string, pkg: unknown) {
  return { userId, jobId, pkg };
}

/**
 * Re-run the matcher for every stored job match for a user. Discovery only
 * scores the jobs a source returned in that run, so preferences and matcher
 * upgrades would otherwise leave stale scores on older jobs.
 */
export async function rescoreMatches(userId: string): Promise<number> {
  const profile = await getProfile(userId);
  const prefs = await getPreferences(userId);
  const rows = await all<{ job_id: string }>("SELECT job_id FROM job_matches WHERE user_id = ?", [userId]);
  let rescored = 0;
  for (const row of rows) {
    const job = await getJobById(row.job_id);
    if (!job) continue;
    const result = matchJob(profile, prefs, job);
    await run(
      `UPDATE job_matches SET overall_score=?, skill_score=?, education_score=?, experience_score=?, career_score=?,
       location_score=?, salary_score=?, flexibility_score=?, freshness_score=?, strengths=?, gaps=?,
       missing_requirements=?, disqualifiers=?, explanation=?, recommended_action=?, qualified=?, role_family=?, updated_at=?
       WHERE user_id=? AND job_id=?`,
      [result.overallScore, result.skillScore, result.educationScore, result.experienceScore, result.careerScore,
        result.locationScore, result.salaryScore, result.flexibilityScore, result.freshnessScore,
        JSON.stringify(result.strengths), JSON.stringify(result.gaps), JSON.stringify(result.missingRequirements),
        JSON.stringify(result.disqualifiers), result.explanation, result.recommendedAction, result.qualified ? 1 : 0,
        result.roleFamily, nowIso(), userId, row.job_id],
    );
    rescored++;
  }
  return rescored;
}

export { applicationDuplicateKey };
