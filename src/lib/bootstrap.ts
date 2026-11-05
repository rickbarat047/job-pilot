import { get, run, all, nowIso } from "./db";
import { COMPANY_REGISTRY } from "./companies/registry";
import { SOURCE_ADAPTERS } from "./sources";

let bootstrapPromise: Promise<void> | null = null;

export async function bootstrapDatabase(): Promise<void> {
  const now = nowIso();
  for (const adapter of SOURCE_ADAPTERS) {
    const existing = await get<{ id: string }>("SELECT id FROM job_sources WHERE key = ?", [adapter.meta.key]);
    if (!existing) {
      await run(
        `INSERT INTO job_sources (id, key, name, category, enabled, status, reliability, config, updated_at)
         VALUES (?, ?, ?, ?, ?, 'idle', ?, '{}', ?)`,
        [crypto.randomUUID().replace(/-/g, ""), adapter.meta.key, adapter.meta.name, adapter.meta.category,
          adapter.meta.enabled ? 1 : 0, adapter.meta.reliability, now],
      );
    } else {
      await run("UPDATE job_sources SET name=?, category=?, enabled=?, reliability=?, updated_at=? WHERE key=?", [
        adapter.meta.name, adapter.meta.category, adapter.meta.enabled ? 1 : 0, adapter.meta.reliability, now, adapter.meta.key,
      ]);
    }
  }
  for (const entry of COMPANY_REGISTRY) {
    let company = await get<{ id: string }>("SELECT id FROM companies WHERE slug = ?", [entry.slug]);
    if (!company) {
      const id = crypto.randomUUID().replace(/-/g, "");
      await run(
        `INSERT INTO companies (id, name, slug, website, careers_url, industry, location, size, stage, description, source, verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, entry.name, entry.slug, entry.website, entry.careersUrl, entry.industry, entry.location, entry.size, entry.stage,
          entry.description, entry.ats ? "ats-registry" : "curated", entry.verified ? 1 : 0, now, now],
      );
      company = { id };
    } else {
      await run(
        `UPDATE companies SET name=?, website=?, careers_url=?, industry=?, location=?, size=?, stage=?, description=?, verified=?, updated_at=? WHERE id=?`,
        [entry.name, entry.website, entry.careersUrl, entry.industry, entry.location, entry.size, entry.stage, entry.description, entry.verified ? 1 : 0, now, company.id],
      );
    }
    const page = await get<{ id: string }>("SELECT id FROM company_career_pages WHERE company_id = ? AND url = ?", [company.id, entry.careersUrl]);
    if (!page) {
      await run(
        `INSERT INTO company_career_pages (id, company_id, url, ats_type, ats_identifier, status) VALUES (?, ?, ?, ?, ?, 'unchecked')`,
        [crypto.randomUUID().replace(/-/g, ""), company.id, entry.careersUrl, entry.ats?.type ?? "career-page", entry.ats?.identifier ?? null],
      );
    }
  }
  const worker = await get<{ id: string }>("SELECT id FROM worker_status WHERE id = 'playwright-worker'");
  if (!worker) {
    await run("INSERT INTO worker_status (id, name, status, last_heartbeat, meta) VALUES ('playwright-worker', 'Playwright browser worker', 'offline', NULL, '{}')");
  }
  // Migrate interview_sessions to add scheduling columns (idempotent).
  for (const col of ["interview_at TEXT", "interview_type TEXT", "interview_location TEXT", "interviewer TEXT"]) {
    try { await run(`ALTER TABLE interview_sessions ADD COLUMN ${col}`); } catch { /* column exists */ }
  }
  const meta = await get<{ key: string }>("SELECT key FROM app_meta WHERE key = 'bootstrapped'");
  if (!meta) await run("INSERT INTO app_meta (key, value) VALUES ('bootstrapped', ?)", [now]);
}

export async function ensureBootstrap(): Promise<void> {
  if (!bootstrapPromise) bootstrapPromise = bootstrapDatabase();
  return bootstrapPromise as Promise<void>;
}




