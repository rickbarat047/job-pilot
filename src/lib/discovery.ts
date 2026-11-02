import { get, newId, nowIso, run, all } from "./db";
import { getProfile, getPreferences, getPermissionsForUser, getJobById } from "./repositories";
import { matchJob } from "./matching";
import { dedupeBatch, applicationDuplicateKey } from "./dedupe";
import { COMPANY_REGISTRY, findRegistryCompany } from "./companies/registry";
import { enabledAdapters } from "./sources";
import { createNotification } from "./repositories";
import type { NormalizedJob, SourceFetchResult } from "./types";
import { evaluatePermission } from "./permissions";

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
  run(
    `INSERT INTO companies (id, name, slug, website, careers_url, industry, location, source, verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'discovered', 0, ?, ?)`,
    [id, job.companyName, job.companySlug, job.companyWebsite ?? null, job.careerPageUrl ?? null, null, job.city ?? job.location, now, now],
  );
  return id;
}

export async function upsertJob(job: NormalizedJob): Promise<UpsertJobResult> {
  const now = nowIso();
  const existingById = await get<{ id: string }>("SELECT id FROM jobs WHERE id = ?", [job.id]);
  if (existingById) {
    run(
      `UPDATE jobs SET title=?, company_name=?, description=?, description_html=?, location=?, city=?, country=?,
       remote_status=?, employment_type=?, experience_required=?, education_requirements=?, skills_required=?,
       salary_min=?, salary_max=?, salary_currency=?, salary_text=?, application_url=?, application_method=?,
       posted_at=COALESCE(?, posted_at), last_verified_at=?, status='active', reliability=?, raw_json=?, updated_at=? WHERE id=?`,
      [job.title, job.companyName, job.description, job.descriptionHtml ?? null, job.location, job.city ?? null, job.country,
        job.remoteStatus, job.employmentType, job.experienceRequired ?? null, job.educationRequirements ?? null, JSON.stringify(job.skillsRequired),
        job.salaryMin ?? null, job.salaryMax ?? null, job.salaryCurrency ?? null, job.salaryText ?? null, job.applicationUrl, job.applicationMethod,
        job.postedAt ?? null, now, job.reliability, JSON.stringify(job.raw ?? {}), now, job.id],
    );
    return { id: job.id, isNew: false };
  }
  const existingByFingerprint = await get<{ id: string }>("SELECT id FROM jobs WHERE fingerprint = ?", [job.fingerprint]);
  if (existingByFingerprint) {
    run(
      `UPDATE jobs SET last_verified_at=?, status='active', reliability=CASE WHEN reliability > ? THEN reliability ELSE ? END, updated_at=? WHERE id=?`,
      [now, job.reliability, job.reliability, now, existingByFingerprint.id],
    );
    return { id: existingByFingerprint.id, isNew: false };
  }
  const companyId = await findCompanyForJob(job);
  run(
    `INSERT INTO jobs (id, title, company_id, company_name, company_website, career_page_url, description, description_html,
      location, city, country, remote_status, employment_type, experience_required, education_requirements, skills_required,
      salary_min, salary_max, salary_currency, salary_text, application_url, application_method, source, source_job_id,
      posted_at, last_verified_at, status, reliability, fingerprint, raw_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    [job.id, job.title, companyId, job.companyName, job.companyWebsite ?? null, job.careerPageUrl ?? null, job.description,
      job.descriptionHtml ?? null, job.location, job.city ?? null, job.country, job.remoteStatus, job.employmentType,
      job.experienceRequired ?? null, job.educationRequirements ?? null, JSON.stringify(job.skillsRequired), job.salaryMin ?? null, job.salaryMax ?? null,
      job.salaryCurrency ?? null, job.salaryText ?? null, job.applicationUrl, job.applicationMethod, job.source, job.sourceJobId,
      job.postedAt ?? null, now, job.reliability, job.fingerprint, JSON.stringify(job.raw ?? {}), now, now],
  );
  return { id: job.id, isNew: true };
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
      const existing = await get<{ id: string }>("SELECT id FROM job_matches WHERE user_id = ? AND job_id = ?", [userId, jobId]);
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
      if (result.overallScore >= 75) {
        const jobRow = await get<{ title: string; company_name: string }>("SELECT title, company_name FROM jobs WHERE id = ?", [jobId]);
        await createNotification(userId, "match", "Strong job match", `${jobRow?.title ?? "A role"} at ${jobRow?.company_name ?? "a company"} scored ${result.overallScore}.`, `/jobs/${jobId}`);
        newHighMatches++;
      }
    }
  }

  await run(
    "UPDATE automation_runs SET status='succeeded', summary=?, finished_at=? WHERE id=?",
    [JSON.stringify({ fetched: allJobs.length, inserted, duplicates: deduped.duplicates.length, matched, newHighMatches, errors: errors.length }), nowIso(), runId],
  );
  await run(
    "INSERT INTO automation_logs (id, user_id, run_id, level, message, meta, created_at) VALUES (?, ?, ?, 'info', ?, ?, ?)",
    [newId("log"), userId, runId, `Discovery completed: ${allJobs.length} fetched, ${inserted} new, ${matched} matched.`, JSON.stringify({ errors }), nowIso()],
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

export { applicationDuplicateKey };
