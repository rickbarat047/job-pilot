#!/usr/bin/env node
// JP-023 — isolated local staging proof for the persistent Windows worker.
// Never contacts production, Supabase, real employers, email or push services.
// All configuration is local-only and is validated before any process starts.

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const PG_BIN = process.env.PG_BIN || "C:\\Users\\rickb\\AppData\\Local\\Temp\\opencode\\pg17\\pgsql\\bin";
const PG_PORT = "55432";
const DB_NAME = "jobpilot_staging";
const DB_USER = "postgres";
const APP_PORT = "3000";
const STUB_PORT = "4599";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const DATABASE_URL = `postgres://${DB_USER}@127.0.0.1:${PG_PORT}/${DB_NAME}?sslmode=disable`;
const WORKER_TOKEN = "local-staging-worker-token"; // test-only, never a production secret
const STORAGE_DIR = mkdtempSync(join(tmpdir(), "jp-staging-storage-"));
const children = [];
const failures = [];
let checks = 0;

function check(name, condition, detail = "") {
  checks += 1;
  const ok = Boolean(condition);
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  return ok;
}

function assertLocalOnly() {
  const env = {
    APP_URL,
    DATABASE_URL,
    WORKER_TOKEN,
    E2E_ALLOW_FIXTURE: "1",
    NODE_ENV: "development",
  };
  const url = new URL(env.APP_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname) || url.protocol !== "http:") {
    throw new Error("Staging APP_URL must be local HTTP.");
  }
  const db = new URL(env.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(db.hostname) || !/^postgres(ql)?:$/.test(db.protocol)) {
    throw new Error("Staging DATABASE_URL must be a local PostgreSQL URL.");
  }
  if (!/\/jobpilot_staging\/?/.test(db.pathname)) throw new Error("Staging database name must be jobpilot_staging.");
  if (/prod/i.test(env.WORKER_TOKEN) || !env.WORKER_TOKEN) throw new Error("Staging worker token must be staging-only.");
  for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "SMTP_HOST"]) {
    if (process.env[key]) throw new Error(`Refusing to start staging with ${key} configured.`);
  }
  console.log("PASS staging configuration is local-only (no production credentials)");
}

function pg(args, extraEnv = {}) {
  const result = spawnSync(join(PG_BIN, "psql.exe"), ["-h", "127.0.0.1", "-p", PG_PORT, "-U", DB_USER, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) throw new Error(`psql failed: ${(result.stderr || result.stdout || "").slice(0, 800)}`);
  return result.stdout || "";
}

function setupDatabase() {
  console.log("Setting up disposable staging database...");
  spawnSync(join(PG_BIN, "createdb.exe"), ["-h", "127.0.0.1", "-p", PG_PORT, "-U", DB_USER, DB_NAME], {
    cwd: repoRoot,
    encoding: "utf8",
  }); // ignore "already exists"
  for (const migration of ["0001_schema.sql", "0003_push_subscriptions.sql"]) {
    pg(["-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-f", join(repoRoot, "supabase", "migrations", migration)]);
  }
  pg(["-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-c", "TRUNCATE users, jobs, automation_tasks, automation_runs, worker_status CASCADE;"]);
  pg(["-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-c", `
    INSERT INTO users (id, email, password_hash, name) VALUES ('staging-user','staging@example.test','staging-only','Staging User');
    INSERT INTO user_permissions (user_id, autonomy_level, search_jobs, analyze_jobs, match_jobs, generate_resumes, generate_cover_letters, save_drafts, submit_applications, send_recruiter_emails, answer_sensitive_questions, share_personal_info, auto_apply_min_score, demo_mode)
      VALUES ('staging-user',4,1,1,1,1,1,1,'automatic','automatic','automatic','automatic',1,0);
    INSERT INTO candidate_profiles (user_id, full_name, email, city, state, degree, university) VALUES ('staging-user','Staging User','staging@example.test','Bengaluru','Karnataka','B.Tech','Test University');
    INSERT INTO candidate_skills (user_id, name, category, proficiency) VALUES ('staging-user','Python','technical','expert'),('staging-user','React','technical','expert'),('staging-user','SQL','technical','expert');
    INSERT INTO candidate_preferences (user_id, target_roles) VALUES ('staging-user', '["Software Engineer"]'::jsonb);
    INSERT INTO jobs (id, source, source_job_id, title, company_name,  description, location, city, country, remote_status, employment_type, application_url, application_method, status, reliability, fingerprint, created_at, updated_at)
      VALUES ('fixture:e2e-1','fixture','e2e-1','Software Engineer','Fixture Technologies','Work with Python, React and SQL in Bengaluru.','Bengaluru, India','Bengaluru','India','hybrid','full-time','${STUB_URL}/jobs/e2e-1','browser','active',0.9,'staging-fixture-1',now(),now());
    INSERT INTO job_matches (id, user_id, job_id, overall_score, skill_score, education_score, experience_score, career_score, location_score, salary_score, flexibility_score, freshness_score, created_at) VALUES ('staging-match','staging-user','fixture:e2e-1',90,90,90,90,90,90,90,90,90,now());
    INSERT INTO applications (id, user_id, job_id, state, autonomy_level, application_method, match_score, duplicate_key, created_at, updated_at)
      VALUES ('staging-app','staging-user','fixture:e2e-1','Approved',4,'browser',90,'staging-fixture-1',now(),now());
    INSERT INTO automation_tasks (id, user_id, type, status, priority, payload, attempts, max_attempts, next_run_at, created_at, updated_at)
      VALUES ('staging-task','staging-user','browser-apply','queued',5,'{"applicationId":"staging-app","jobId":"fixture:e2e-1","submit":true}',0,3,now(),now(),now());
  `]);
  const count = pg(["-d", DB_NAME, "-Atc", "SELECT count(*) FROM automation_tasks WHERE id='staging-task' AND status='queued'"]).trim();
  check("staging database seeded with approved task", count === "1", count);
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  child.probe = () => output;
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function api(path, options = {}) {
  const response = await fetch(`${APP_URL}${path}`, options);
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: response.status, json, text };
}

async function dbValue(sql) {
  return pg(["-d", DB_NAME, "-Atc", sql]).trim();
}

async function main() {
  assertLocalOnly();
  setupDatabase();

  start("stub", process.execPath, ["scripts/e2e/stub-server.mjs"], { E2E_STUB_PORT: String(STUB_PORT) });
  check("fake employer stub healthy", await waitFor(`${STUB_URL}/health`));

  start("app", process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", APP_PORT], {
    NODE_ENV: "development",
    APP_URL,
    DATABASE_URL,
    DATABASE_SSL: "false",
    WORKER_TOKEN,
    AI_API_KEY: "staging-only-ai-key",
    AI_BASE_URL: `${STUB_URL}/v1`,
    STORAGE_DIR,
    E2E_ALLOW_FIXTURE: "1",
    E2E_FIXTURE_JOBS: "scripts/e2e/fixtures.json",
    WORKER_ONLINE_WINDOW_MS: "3000",
  });
  check("local app healthy", await waitFor(`${APP_URL}/api/health`));

  const offline = await api("/api/health");
  check("worker offline before start reports degraded", offline.status === 200 && offline.json?.status === "degraded" && offline.json?.worker === "offline", JSON.stringify(offline.json?.worker));

  const worker = start("worker", process.execPath, ["scripts/persistent-worker.mjs"], {
    APP_URL,
    WORKER_TOKEN,
    HEADLESS: "true",
    MAX_TASKS: "1",
    POLL_INTERVAL_MS: "500",
    HEARTBEAT_INTERVAL_MS: "1000",
    BROWSER_TIMEOUT_MS: "60000",
  });

  let online = false;
  for (let i = 0; i < 60 && !online; i += 1) {
    const response = await api("/api/automation/worker");
    online = response.status === 200 && response.json?.online === true;
    if (!online) await new Promise((r) => setTimeout(r, 500));
  }
  check("persistent worker heartbeat reports online", online);

  let applied = false;
  for (let i = 0; i < 120 && !applied; i += 1) {
    applied = (await dbValue("SELECT state FROM applications WHERE id='staging-app'")) === "Applied";
    if (!applied) await new Promise((r) => setTimeout(r, 500));
  }
  check("persistent worker applied approved staging application", applied, await dbValue("SELECT state FROM applications WHERE id='staging-app'"));
  check("explicit submission event recorded once", (await dbValue("SELECT count(*)::int FROM application_events WHERE application_id='staging-app' AND event_type='application.submitted_browser'")) === "1");
  check("task recorded succeeded", (await dbValue("SELECT status FROM automation_tasks WHERE id='staging-task'")) === "succeeded");
  check("worker exited cleanly after bounded run", worker.exitCode === 0, String(worker.exitCode));

  worker.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 4000));
  const after = await api("/api/automation/worker");
  check("expired lease reports offline after shutdown", after.status === 200 && after.json?.online === false && after.json?.status === "offline", JSON.stringify(after.json?.status));
  const health = await api("/api/health");
  check("health reports worker offline after shutdown", health.json?.worker === "offline", JSON.stringify(health.json?.worker));
}

main()
  .catch((error) => { console.error(`Staging proof failed: ${error instanceof Error ? error.message : String(error)}`); failures.push("orchestrator"); })
  .finally(async () => {
    for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
    rmSync(STORAGE_DIR, { recursive: true, force: true });
    console.log(`\nStaging proof: ${checks - failures.length}/${checks} checks passed`);
    if (failures.length) {
      for (const failure of failures) console.error(`FAIL ${failure}`);
      process.exitCode = 1;
    }
  });
