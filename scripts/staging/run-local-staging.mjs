#!/usr/bin/env node
// JP-024 hardened isolated local staging proof.
// Proves the JP-022 persistent worker processes one fake-employer task through
// the real local API and database. Never connects to production.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const { assertStagingConfig, restrictedStagingEnv } = await import(
  new URL("../../src/lib/staging-guard.ts", import.meta.url).href
);

const repoRoot = resolve(process.cwd());
const PG_PORT = Number(process.env.PG_PORT || 55432);
const DB_NAME = "jobpilot_staging";
const DB_USER = "postgres";
const APP_PORT = 3000;
const STUB_PORT = 4599;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const DATABASE_URL = `postgres://${DB_USER}@127.0.0.1:${PG_PORT}/${DB_NAME}?sslmode=disable`;
const WORKER_TOKEN = "local-staging-worker-token";
const STORAGE_DIR = mkdtempSync(join(tmpdir(), "jp-staging-storage-"));

const stagingEnv = {
  APP_URL,
  DATABASE_URL,
  WORKER_TOKEN,
  NODE_ENV: "development",
  E2E_ALLOW_FIXTURE: "1",
  E2E_FIXTURE_JOBS: "scripts/e2e/fixtures.json",
  AI_BASE_URL: `${STUB_URL}/v1`,
  AI_API_KEY: "staging-only-ai-key",
};

let checks = 0;
let failures = 0;
const children = [];

function check(name, condition, detail = "") {
  checks += 1;
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
}

function findInPath(name) {
  for (const dir of (process.env.PATH || "").split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function resolvePgTools() {
  const names = process.platform === "win32"
    ? ["psql.exe", "createdb.exe", "pg_isready.exe"]
    : ["psql", "createdb", "pg_isready"];
  const result = {};
  for (const name of names) {
    const key = name.replace(/\.exe$/i, "");
    const configuredDir = process.env.PG_BIN;
    if (configuredDir) {
      const candidate = join(configuredDir, name);
      if (!existsSync(candidate)) {
        throw new Error(
          `${name} was not found in PG_BIN=${configuredDir}. Set PG_BIN to the directory containing ${names.join(", ")}.`,
        );
      }
      result[key] = candidate;
    } else {
      const found = findInPath(name);
      if (!found) {
        throw new Error(
          `${name} was not found on PATH. Install PostgreSQL or set PG_BIN to its bin directory.`,
        );
      }
      result[key] = found;
    }
  }
  return result;
}

let pgTools;

function childEnv(extra = {}) {
  const base = restrictedStagingEnv({ ...stagingEnv, ...extra });
  // Non-secret local-only settings not covered by the guard allowlist.
  return {
    ...base,
    DATABASE_SSL: "false",
    E2E_STUB_PORT: String(STUB_PORT),
    BROWSER_TIMEOUT_MS: "60000",
  };
}

function pg(args, { checkStatus = true } = {}) {
  const result = spawnSync(pgTools.psql, ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", DB_USER, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: childEnv(),
  });
  if (result.error) throw result.error;
  if (checkStatus && result.status !== 0) {
    throw new Error(`psql failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result.stdout || "";
}

function dbValue(sql) {
  return pg(["-d", DB_NAME, "-Atc", sql]).trim();
}

function assertDestructiveTarget() {
  const currentDb = dbValue("SELECT current_database()");
  const host = dbValue("SELECT COALESCE(inet_server_addr()::text, 'local')").split("/")[0];
  const localHosts = new Set(["127.0.0.1", "::1", "localhost", "local"]);
  check("destructive target database is exactly jobpilot_staging", currentDb === DB_NAME, currentDb);
  check("destructive target host is localhost", localHosts.has(host), host);
  if (currentDb !== DB_NAME || !localHosts.has(host)) {
    throw new Error("Refusing destructive database operations: target is not the local staging database.");
  }
}

function setupDatabase() {
  const created = spawnSync(pgTools.createdb, ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", DB_USER, DB_NAME], {
    cwd: repoRoot,
    encoding: "utf8",
    env: childEnv(),
  });
  if (created.error) throw created.error;
  if (created.status !== 0) {
    const text = `${created.stderr || created.stdout || ""}`;
    if (!/already exists/i.test(text)) throw new Error(`createdb failed: ${text.trim()}`);
  }
  assertDestructiveTarget();
  for (const migration of ["0001_schema.sql", "0003_push_subscriptions.sql"]) {
    pg(["-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-f", join("supabase", "migrations", migration)]);
  }
  pg(["-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-c", "TRUNCATE users, jobs, automation_tasks, automation_runs, worker_status CASCADE;"]);
  pgSql(`
    INSERT INTO users (id, email, password_hash, name) VALUES ('staging-user','staging@example.test','staging-only','Staging User');
    INSERT INTO user_permissions (user_id, autonomy_level, search_jobs, analyze_jobs, match_jobs, generate_resumes, generate_cover_letters, save_drafts, submit_applications, send_recruiter_emails, answer_sensitive_questions, share_personal_info, auto_apply_min_score, demo_mode)
      VALUES ('staging-user',4,1,1,1,1,1,1,'automatic','automatic','automatic','automatic',1,0);
    INSERT INTO candidate_profiles (user_id, full_name, email, city, state, degree, university)
      VALUES ('staging-user','Staging User','staging@example.test','Bengaluru','Karnataka','B.Tech','Test University');
    INSERT INTO candidate_skills (user_id, name, category, proficiency) VALUES
      ('staging-user','Python','technical','expert'),('staging-user','React','technical','expert'),('staging-user','SQL','technical','expert');
    INSERT INTO candidate_preferences (user_id, target_roles) VALUES ('staging-user', '["Software Engineer"]'::jsonb);
    INSERT INTO jobs (id, source, source_job_id, title, company_name, description, location, city, country, remote_status, employment_type, application_url, application_method, status, reliability, fingerprint, created_at, updated_at)
      VALUES ('fixture:e2e-1','fixture','e2e-1','Software Engineer','Fixture Technologies','Work with Python, React and SQL in Bengaluru.','Bengaluru, India','Bengaluru','India','hybrid','full-time','${STUB_URL}/jobs/e2e-1','browser','active',0.9,'staging-fixture-1',now(),now());
    INSERT INTO job_matches (id, user_id, job_id, overall_score, skill_score, education_score, experience_score, career_score, location_score, salary_score, flexibility_score, freshness_score, created_at)
      VALUES ('staging-match','staging-user','fixture:e2e-1',90,90,90,90,90,90,90,90,90,now());
    INSERT INTO applications (id, user_id, job_id, state, autonomy_level, application_method, match_score, duplicate_key, created_at, updated_at)
      VALUES ('staging-app','staging-user','fixture:e2e-1','Approved',4,'browser',90,'staging-fixture-1',now(),now());
    INSERT INTO automation_tasks (id, user_id, type, status, priority, payload, attempts, max_attempts, next_run_at, created_at, updated_at)
      VALUES ('staging-task','staging-user','browser-apply','queued',5,'{"applicationId":"staging-app","jobId":"fixture:e2e-1","submit":true}',0,3,now(),now(),now());
  `);
  const count = dbValue("SELECT count(*) FROM automation_tasks WHERE id='staging-task' AND status='queued'");
  check("staging database seeded with approved task", count === "1", count);
}

function pgSql(sql) {
  pg(["-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.probe = { name, output: "" };
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk) => {
      const text = String(chunk);
      child.probe.output += text;
      process.stdout.write(`[${name}] ${text}`);
    });
  }
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return true;
    } catch {
      /* retry */
    }
    await delay(250);
  }
  return false;
}

async function api(path, options = {}) {
  const response = await fetch(`${APP_URL}${path}`, {
    ...options,
    headers: { "content-type": "application/json", "x-worker-token": WORKER_TOKEN, ...(options.headers || {}) },
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: response.status, text, json };
}

async function health() {
  const response = await fetch(`${APP_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
  return { status: response.status, json: await response.json() };
}

async function waitUntil(label, fn, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForExit(child, timeoutMs = 120000) {
  if (child.exitCode !== null || child.signalCode !== null) return child.exitCode ?? 1;
  const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
  try {
    const [code] = await once(child, "exit");
    return code ?? 1;
  } finally {
    clearTimeout(timer);
  }
}

async function cleanup() {
  for (const child of [...children].reverse()) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit").catch(() => {}), delay(3000)]);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  }
  children.length = 0;
  rmSync(STORAGE_DIR, { recursive: true, force: true });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await cleanup();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

async function main() {
  check("local-only staging configuration guard", (() => {
    assertStagingConfig(stagingEnv);
    return true;
  })());

  pgTools = resolvePgTools();
  check("PostgreSQL tools discovered portably", Boolean(pgTools.psql && pgTools.createdb && pgTools.pg_isready));
  const ready = spawnSync(pgTools.pg_isready, ["-h", "127.0.0.1", "-p", String(PG_PORT)], { encoding: "utf8" });
  check("local PostgreSQL is accepting connections", ready.status === 0, (ready.stdout || ready.stderr || "").trim());
  if (ready.status !== 0) throw new Error("Local PostgreSQL is unavailable; start it or set PG_PORT/PG_BIN.");

  setupDatabase();

  start("fake-employer", process.execPath, ["scripts/e2e/stub-server.mjs"], childEnv());
  check("fake employer is available", await waitFor(`${STUB_URL}/health`));

  start(
    "local-app",
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-p", String(APP_PORT)],
    childEnv({ PORT: String(APP_PORT), STORAGE_DIR, WORKER_ONLINE_WINDOW_MS: "3000" }),
  );
  check("local application is available", await waitFor(`${APP_URL}/api/health`, 90000));

  const before = await health();
  check("worker offline before startup reports degraded", before.status === 200 && before.json.status === "degraded" && before.json.worker === "offline", JSON.stringify(before.json));

  const worker = start(
    "persistent-worker",
    process.execPath,
    ["scripts/persistent-worker.mjs"],
    childEnv({ HEADLESS: "true", MAX_TASKS: "1", POLL_INTERVAL_MS: "500", HEARTBEAT_INTERVAL_MS: "1000" }),
  );

  const status = await waitUntil("worker online heartbeat", async () => {
    const response = await api("/api/automation/worker", { method: "GET" });
    return response.json?.online === true ? response.json : null;
  });
  check("worker online heartbeat accepted", status?.online === true, JSON.stringify(status));

  await waitUntil("application Applied by real browser worker", async () => {
    const value = dbValue("SELECT state FROM applications WHERE id='staging-app'");
    return value === "Applied" ? value : null;
  });
  check("fake employer application marked Applied", dbValue("SELECT state FROM applications WHERE id='staging-app'") === "Applied");

  const eventCount = dbValue("SELECT count(*) FROM application_events WHERE application_id='staging-app' AND event_type='application.submitted_browser'");
  check("exactly one browser submit event", eventCount === "1", eventCount);
  const taskStatus = dbValue("SELECT status FROM automation_tasks WHERE id='staging-task'");
  check("task marked succeeded", taskStatus === "succeeded", taskStatus);

  const exitCode = await waitForExit(worker);
  check("worker exited cleanly after bounded run", exitCode === 0, String(exitCode));

  await delay(4000);
  const after = await health();
  check("lease expired and health reports worker offline", after.status === 200 && after.json.worker === "offline", JSON.stringify(after.json));
}

try {
  await main();
} catch (error) {
  failures += 1;
  console.error(`Staging proof error: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await cleanup();
  console.log(`\nStaging proof: ${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exitCode = 1;
}
