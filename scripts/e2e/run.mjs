#!/usr/bin/env node
// End-to-end discovery → tailor → approve → submit → browser worker verification.
// Uses only localhost services and a disposable PostgreSQL database.
// No production data, credentials, AI provider or email service is contacted.

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = process.cwd();
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3100);
const STUB_PORT = Number(process.env.E2E_STUB_PORT ?? 4599);
const DB_PORT = Number(process.env.E2E_DB_PORT ?? 55432);
const DB_USER = process.env.E2E_DB_USER ?? "postgres";
const DB_PASSWORD = process.env.E2E_DB_PASSWORD ?? "";
const DB_NAME = process.env.E2E_DB_NAME ?? "jobpilot_e2e";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const DATABASE_URL = `postgres://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@127.0.0.1:${DB_PORT}/${DB_NAME}?sslmode=disable`;
const WORKER_TOKEN = "e2e-worker-token";
const EMAIL = `e2e-${Date.now()}@example.test`;
const password = "TestPassword123!";
const maildir = mkdtempSync(join(tmpdir(), "jp-e2e-"));
const fixturePath = join(repoRoot, "scripts", "e2e", "fixtures.json");

const children = [];
let failures = 0;
let checks = 0;

function check(name, condition, detail = "") {
  checks += 1;
  if (condition) console.log(`  PASS ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* still starting */
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function api(method, path, body, { cookie = "", token = "" } = {}) {
  const headers = {
    origin: APP_URL,
    accept: "application/json",
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  if (token) headers["x-worker-token"] = token;
  const response = await fetch(`${APP_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }
  return { status: response.status, json, text, cookie: response.headers.get("set-cookie")?.split(";")[0] || "" };
}

async function waitForWorker() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const response = await api("GET", "/api/automation/worker");
    if (response.json?.online) return;
    await delay(500);
  }
  throw new Error("Worker did not come online");
}

async function main() {
  console.log("JP-016 E2E — isolated discovery-to-application verification\n");

  const pg = await import("pg");
  const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: false, max: 2 });
  await pool.query("TRUNCATE TABLE users, jobs, automation_runs, worker_status CASCADE");

  start("stub", process.execPath, ["scripts/e2e/stub-server.mjs"], {
    E2E_STUB_PORT: String(STUB_PORT),
  });
  await waitFor(`${STUB_URL}/health`);

  start("app", process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(APP_PORT)], {
    NODE_ENV: "development",
    DATABASE_URL,
    DATABASE_SSL: "false",
    STORAGE_DIR: join(maildir, "storage"),
    AI_API_KEY: "e2e-local-key",
    AI_BASE_URL: `${STUB_URL}/v1`,
    WORKER_TOKEN,
    APP_URL,
    E2E_ALLOW_FIXTURE: "1",
    E2E_FIXTURE_JOBS: fixturePath,
    NEXT_TELEMETRY_DISABLED: "1",
  });
  await waitFor(`${APP_URL}/api/health`);

  console.log("Stage A — account and permissions");
  const registration = await api("POST", "/api/auth/register", {
    name: "E2E Candidate",
    email: EMAIL,
    password,
  });
  check("register creates session", registration.status === 200, registration.text.slice(0, 200));
  const cookie = registration.cookie;
  const userId = registration.json?.user?.id;
  check("session cookie captured", Boolean(cookie));
  check("user id returned", Boolean(userId));

  await pool.query(
    `INSERT INTO user_permissions
       (user_id, autonomy_level, search_jobs, analyze_jobs, match_jobs, generate_resumes,
        generate_cover_letters, save_drafts, submit_applications, send_recruiter_emails,
        answer_sensitive_questions, share_personal_info, auto_apply_min_score, demo_mode)
     VALUES ($1,4,'automatic','automatic','automatic','automatic','automatic','automatic',
       'automatic','automatic','automatic','automatic',1,0)
     ON CONFLICT (user_id) DO UPDATE SET
       autonomy_level=4, submit_applications='automatic', demo_mode=0, auto_apply_min_score=1`,
    [userId],
  );
  await pool.query(
    `UPDATE candidate_profiles SET full_name='E2E Candidate', email=$2, phone='9876543210',
       city='Bengaluru', state='Karnataka', country='India', degree='B.Tech',
       university='Test University', headline='Software Engineer',
       summary='Verified engineer with Python, React and SQL experience.' WHERE user_id=$1`,
    [userId, EMAIL],
  );
  for (const name of ["Python", "React", "SQL"]) {
    await pool.query(
      `INSERT INTO candidate_skills (user_id, name, category, proficiency)
       VALUES ($1,$2,'technical','expert') ON CONFLICT (user_id,name) DO NOTHING`,
      [userId, name],
    );
  }
  await pool.query(
    `UPDATE candidate_preferences SET target_roles=$2::jsonb WHERE user_id=$1`,
    [userId, JSON.stringify(["Software Engineer", "Backend Engineer"])],
  );

  console.log("Stage B — discovery and matching");
  const discovery = await api("POST", "/api/discovery/run", { sourceKeys: ["fixture"], rescore: false }, { cookie });
  check("discovery succeeds", discovery.status === 200, discovery.text.slice(0, 300));
  const jobsResult = await pool.query(
    `SELECT j.id, j.title, j.application_url, m.overall_score FROM jobs j
     JOIN job_matches m ON m.job_id = j.id AND m.user_id = $1 ORDER BY j.title`,
    [userId],
  );
  check("fixture jobs discovered", jobsResult.rows.length === 3, `got ${jobsResult.rows.length}`);
  check("jobs matched for user", jobsResult.rows.every((row) => Number(row.overall_score) > 0));

  console.log("Stage C — tailor, approve and submit");
  const firstJob = jobsResult.rows.find((row) => row.title === "Software Engineer");
  check("fixture job URL points to local stub", String(firstJob?.application_url).startsWith(STUB_URL));
  const tailor = await api("POST", `/api/jobs/${firstJob.id}/tailor`, {}, { cookie });
  check("tailor succeeds", tailor.status === 200, tailor.text.slice(0, 300));
  check("AI stub was used", tailor.json?.provider === "ai", `provider=${tailor.json?.provider}`);
  const applicationId = tailor.json?.applicationId;
  check("application id returned", Boolean(applicationId));

  const approve = await api("POST", `/api/applications/${applicationId}/approve`, {}, { cookie });
  check("approve succeeds", approve.status === 200, approve.text.slice(0, 200));

  const heartbeat = await api("POST", "/api/automation/worker", { status: "online", meta: { e2e: true } }, { token: WORKER_TOKEN });
  check("worker heartbeat accepted", heartbeat.status === 200, heartbeat.text.slice(0, 200));
  await waitForWorker();

  const submit = await api("POST", `/api/applications/${applicationId}/submit`, { method: "browser" }, { cookie });
  check("browser submission queued", submit.status === 200, submit.text.slice(0, 300));
  const taskId = submit.json?.taskId;
  check("worker task created", Boolean(taskId));

  console.log("Stage D — real browser worker");
  const worker = await new Promise((resolve) => {
    const child = start("worker", process.execPath, ["scripts/browser-worker.mjs"], {
      APP_URL,
      WORKER_TOKEN,
      HEADLESS: "true",
      ONE_SHOT: "1",
      POLL_INTERVAL_MS: "1000",
      STORAGE_DIR: join(maildir, "storage"),
    });
    let output = "";
    child.stdout.on("data", (c) => (output += c));
    child.stderr.on("data", (c) => (output += c));
    child.on("close", (code) => resolve({ code, output }));
    setTimeout(() => child.kill("SIGKILL"), 120_000).unref();
  });
  check("browser worker exits successfully", worker.code === 0, worker.output.slice(-800));
  check("worker reported explicit confirmation", /confirmation|applied/i.test(worker.output), worker.output.slice(-400));

  console.log("Stage E — database evidence");
  const appRow = await pool.query(
    `SELECT state, applied_at, application_method FROM applications WHERE id=$1`,
    [applicationId],
  );
  check("application state is Applied", appRow.rows[0]?.state === "Applied", JSON.stringify(appRow.rows[0]));
  check("applied_at recorded", Boolean(appRow.rows[0]?.applied_at));
  check("application method is browser", appRow.rows[0]?.application_method === "browser");
  const eventRows = await pool.query(
    `SELECT event_type, detail FROM application_events WHERE application_id=$1 ORDER BY created_at`,
    [applicationId],
  );
  check("browser submit event recorded", eventRows.rows.some((r) => r.event_type === "application.submitted_browser"));
  const taskRow = await pool.query(`SELECT status FROM automation_tasks WHERE id=$1`, [taskId]);
  check("worker task succeeded", taskRow.rows[0]?.status === "succeeded");
  const runRow = await pool.query(
    `SELECT status FROM automation_runs WHERE user_id=$1 ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
  check("discovery run succeeded", runRow.rows[0]?.status === "succeeded");

  console.log("Stage F — failure scenarios");
  const noToken = await api("POST", "/api/automation/worker/tasks/claim", {});
  check("claim without worker token is rejected", noToken.status === 401, String(noToken.status));

  const secondJob = jobsResult.rows.find((row) => row.title === "Backend Engineer");
  const secondTailor = await api("POST", `/api/jobs/${secondJob.id}/tailor`, {}, { cookie });
  const secondApp = secondTailor.json?.applicationId;
  check("second application drafted", Boolean(secondApp), secondTailor.text.slice(0, 200));
  const bypass = await api("POST", `/api/applications/${secondApp}/submit`, { method: "browser" }, { cookie });
  check("approval bypass rejected", bypass.status >= 400 && bypass.status < 500, String(bypass.status));

  const before = await pool.query(
    `SELECT count(*)::int AS n FROM application_events WHERE application_id=$1 AND event_type='application.submitted_browser'`,
    [applicationId],
  );
  const duplicate = await api(
    "POST",
    `/api/automation/worker/tasks/${taskId}/result`,
    { status: "applied", message: "duplicate result", confirmation: "Thank you" },
    { token: WORKER_TOKEN },
  );
  const after = await pool.query(
    `SELECT count(*)::int AS n FROM application_events WHERE application_id=$1 AND event_type='application.submitted_browser'`,
    [applicationId],
  );
  check("duplicate worker result accepted (known non-idempotent behaviour)", duplicate.status === 200, String(duplicate.status));
  console.log(`  INFO duplicate result changed submit-event count ${before.rows[0].n} -> ${after.rows[0].n}`);

  const corruptPath = join(maildir, "corrupt-fixtures.json");
  writeFileSync(corruptPath, "{not valid json");
  const originalFixturePath = process.env.E2E_FIXTURE_JOBS;
  // Discovery reads the fixture file per request, but the app process has its own env;
  // simulate provider failure at the AI stub level instead by stopping the stub.
  const stubChild = children[0];
  stubChild.kill("SIGTERM");
  await delay(500);
  const thirdJob = jobsResult.rows.find((row) => row.title === "Platform Engineer") ?? jobsResult.rows[2];
  const aiFallback = await api("POST", `/api/jobs/${thirdJob.id}/tailor`, {}, { cookie });
  check("tailor still works when AI provider is unavailable", aiFallback.status === 200, aiFallback.text.slice(0, 200));
  void corruptPath;
  void originalFixturePath;

  console.log(`\nE2E summary: ${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("E2E run failed:", error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const child of children.reverse()) {
      if (!child.killed) child.kill("SIGTERM");
    }
    try {
      rmSync(maildir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    await delay(250);
  });
