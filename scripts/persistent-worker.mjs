#!/usr/bin/env node
// Persistent, container-compatible browser worker for JobPilot AI.
//
// Unlike scripts/browser-worker.mjs (a one-shot worker for scheduled CI), this
// process stays alive, renews its heartbeat lease, polls for tasks, and shuts
// down gracefully on SIGTERM/SIGINT. All I/O is injected so the orchestration
// can be tested with a virtual clock, a fake fetch and a real AbortSignal.
//
// Required env: APP_URL, WORKER_TOKEN
// Optional env: POLL_INTERVAL_MS, HEARTBEAT_INTERVAL_MS, MAX_TASKS,
//               MAX_ATTEMPTS, RETRY_BASE_MS, RETRY_MAX_MS, HEADLESS,
//               BROWSER_TIMEOUT_MS

import { pathToFileURL } from "node:url";
import {
  validateEnv,
  buildHeartbeatBody,
  createApiError,
  isAuthFailure,
  isEmptyQueueResult,
  classifySubmissionResult,
  shutdownExitCode,
} from "./browser-worker-lib.mjs";

export const DEFAULT_CONFIG = Object.freeze({
  pollIntervalMs: 5_000,
  heartbeatIntervalMs: 15_000,
  maxAttempts: 4,
  baseRetryMs: 500,
  maxRetryMs: 30_000,
  requestTimeoutMs: 30_000,
  heartbeatFailureLimit: 3,
  maxTasks: Number.POSITIVE_INFINITY,
  maxPolls: Number.POSITIVE_INFINITY,
});

export function computeBackoffMs(attempt, baseMs, maxMs) {
  const exponent = Math.max(0, Math.trunc(attempt) - 1);
  const delay = Math.max(0, baseMs) * 2 ** exponent;
  return Number.isFinite(delay) ? Math.min(Math.max(0, maxMs), delay) : Math.max(0, maxMs);
}

/**
 * 401 and 404 are configuration/credential errors: retrying cannot help.
 * Other 4xx responses are rejected without retry. 5xx and transport errors
 * are transient and are retried with exponential backoff.
 */
export function classifyError(err) {
  if (isAuthFailure(err)) return "fatal";
  const status = err?.status;
  if (status === 404) return "fatal";
  if (typeof status === "number") return status >= 500 ? "retryable" : "nonretryable";
  return "retryable";
}

/**
 * Defense in depth: the API route only accepts applied/manual_required/failed,
 * and the server records results idempotently. "applied" is allowed here only
 * with an explicit confirmation string captured from the employer's site.
 */
export function normalizeTaskResult(raw) {
  const status = raw && typeof raw === "object" ? raw.status : undefined;
  const confirmation = typeof raw?.confirmation === "string" ? raw.confirmation.trim() : "";
  const message = typeof raw?.message === "string" ? raw.message : "";
  const finalUrl = typeof raw?.finalUrl === "string" ? raw.finalUrl : "";
  const fieldsFilled = Array.isArray(raw?.fieldsFilled)
    ? raw.fieldsFilled.filter((v) => typeof v === "string")
    : [];
  const screenshotPath = typeof raw?.screenshotPath === "string" ? raw.screenshotPath : null;

  if (status === "applied") {
    if (!confirmation) {
      return {
        status: "manual_required",
        message: "Submission finished but no explicit employer confirmation was captured; manual review required.",
        finalUrl,
        fieldsFilled,
        screenshotPath,
      };
    }
    return {
      status: "applied",
      confirmation,
      message: message || "Application submitted with explicit employer confirmation.",
      finalUrl,
      fieldsFilled,
      screenshotPath,
    };
  }
  if (status === "manual_required") {
    return { status: "manual_required", message: message || "Manual completion required.", finalUrl, fieldsFilled, screenshotPath };
  }
  return { status: "failed", message: message || "Browser task did not complete.", finalUrl, fieldsFilled, screenshotPath };
}

export function submissionOutcome(input = {}) {
  const classified = classifySubmissionResult(input);
  if (classified.status === "applied") {
    const confirmation = typeof input.confirmation === "string" ? input.confirmation.trim() : "";
    if (!confirmation) return { status: "manual_required", reason: "confirmation-required" };
    return { ...classified, confirmation };
  }
  return classified;
}

function createLogger(log) {
  if (typeof log === "function") return log;
  if (log && typeof log === "object") {
    return (level, message) => {
      const fn = log[level] ?? log.info ?? log.log;
      if (typeof fn === "function") fn.call(log, message);
    };
  }
  return (level, message) => console.log(`[${level}] ${message}`);
}

function createDefaultSleep() {
  return (ms, signal) => new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, Math.max(0, ms));
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

export async function withRetry(operation, options) {
  const {
    label,
    maxAttempts = DEFAULT_CONFIG.maxAttempts,
    baseRetryMs = DEFAULT_CONFIG.baseRetryMs,
    maxRetryMs = DEFAULT_CONFIG.maxRetryMs,
    signal,
    sleep,
    log = () => {},
    redact = (value) => String(value ?? ""),
    respectAbort = true,
  } = options ?? {};

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (respectAbort && signal?.aborted) throw lastError ?? new Error(`${label} aborted`);
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;
      if (respectAbort && signal?.aborted) throw err;
      const kind = classifyError(err);
      if (kind !== "retryable" || attempt >= maxAttempts) throw err;
      const delay = computeBackoffMs(attempt, baseRetryMs, maxRetryMs);
      log("warn", `${label} failed (attempt ${attempt}/${maxAttempts}); retry in ${delay}ms: ${redact(err?.message ?? err)}`);
      await sleep(delay, signal);
    }
  }
  throw lastError;
}

function createApiClient(deps, config) {
  const baseUrl = String(deps.baseUrl ?? config.baseUrl ?? process.env.APP_URL ?? "").replace(/\/$/, "");
  const token = String(deps.token ?? config.token ?? process.env.WORKER_TOKEN ?? "");

  async function request(path, { method = "GET", body, abortable = true } = {}) {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    // Finalization calls (result report, offline heartbeat) must survive a
    // SIGTERM; otherwise the app loses the outcome and shows an honest offline
    // state only by accident. Normal polling calls are cancellable.
    if (abortable && deps.signal) {
      deps.signal.addEventListener?.("abort", forwardAbort, { once: true });
      if (deps.signal.aborted) forwardAbort();
    }
    const timeout = config.requestTimeoutMs > 0
      ? setTimeout(() => controller.abort(), config.requestTimeoutMs)
      : null;
    try {
      const headers = { "content-type": "application/json" };
      // Credentials travel in the header only, never in a JSON body or a log.
      if (token) headers["x-worker-token"] = token;
      const res = await deps.fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      if (!res.ok) throw createApiError(res.status, method, path, text);
      return json;
    } finally {
      if (timeout) clearTimeout(timeout);
      if (abortable) deps.signal?.removeEventListener?.("abort", forwardAbort);
    }
  }

  return {
    request,
    heartbeat: (status, meta, opts = {}) => request("/api/automation/worker", {
      method: "POST",
      body: buildHeartbeatBody(status, meta),
      abortable: opts.abortable !== false,
    }),
    claim: () => request("/api/automation/worker/tasks/claim", { method: "POST", body: {} }),
    report: (taskId, result, opts = {}) => request(`/api/automation/worker/tasks/${encodeURIComponent(taskId)}/result`, {
      method: "POST",
      body: result,
      abortable: opts.abortable !== false,
    }),
  };
}

/**
 * Build the orchestration engine. `options.config` tunes behaviour;
 * `options.deps` injects fetch, sleep, now, signal, log and executeTask.
 */
export function createPersistentWorker(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...(options.config ?? {}) };
  const signal = options.deps?.signal ?? new AbortController().signal;
  const sleep = options.deps?.sleep ?? createDefaultSleep();
  const now = options.deps?.now ?? Date.now;
  const log = createLogger(options.deps?.log);
  const token = String(options.deps?.token ?? config.token ?? process.env.WORKER_TOKEN ?? "");
  const redact = (value) => {
    const text = String(value ?? "");
    return token && text ? text.split(token).join("[redacted]") : text;
  };
  const api = createApiClient({ ...(options.deps ?? {}), token }, config);
  const retry = (label) => ({
    label,
    maxAttempts: config.maxAttempts,
    baseRetryMs: config.baseRetryMs,
    maxRetryMs: config.maxRetryMs,
    signal,
    sleep,
    log,
    redact,
  });

  const state = {
    heartbeats: 0,
    processingHeartbeats: 0,
    claims: 0,
    results: 0,
    tasksProcessed: 0,
    polls: 0,
    lastHeartbeatAt: Number.NEGATIVE_INFINITY,
    consecutiveHeartbeatFailures: 0,
    leaseLost: false,
    claimedIds: new Set(),
    processing: false,
    processingFailed: false,
    criticalHeartbeatFailed: false,
    offlineHeartbeatFailed: false,
    offlinePosted: false,
    fatal: null,
  };

  async function sendHeartbeat(status, meta = {}, opts = {}) {
    await api.heartbeat(status, {
      worker: "persistent-playwright",
      processing: state.processing,
      ...meta,
    }, opts);
    state.heartbeats += 1;
    state.lastHeartbeatAt = now();
    if (meta.processing === true) state.processingHeartbeats += 1;
  }

  async function shutdown() {
    state.processing = false;
    try {
      await withRetry(
        () => sendHeartbeat("offline", { processing: false }, { abortable: false }),
        { ...retry("offline heartbeat"), respectAbort: false },
      );
      state.offlinePosted = true;
    } catch (err) {
      state.offlineHeartbeatFailed = true;
      log("error", `offline heartbeat failed: ${redact(err?.message ?? err)}`);
    }
    const exitCode = shutdownExitCode(
      state.processingFailed,
      state.offlineHeartbeatFailed,
      state.criticalHeartbeatFailed || Boolean(state.fatal),
    );
    return { exitCode, state: { ...state, fatal: state.fatal ? redact(state.fatal.message) : null } };
  }

  async function run() {
    log("info", "persistent worker starting");
    try {
      await withRetry(() => sendHeartbeat("online", { processing: false }), retry("startup heartbeat"));
    } catch (err) {
      if (classifyError(err) === "fatal") {
        state.fatal = err;
        log("error", `startup heartbeat failed critically: ${redact(err?.message ?? err)}`);
        return shutdown();
      }
      state.criticalHeartbeatFailed = true;
      log("error", `startup heartbeat failed: ${redact(err?.message ?? err)}`);
    }

    while (!signal.aborted && state.polls < config.maxPolls && state.tasksProcessed < config.maxTasks) {
      state.polls += 1;

      // Keep the lease fresh while idle. A renewal failure is logged and
      // retried on the next poll; it never masquerades as successful work.
      if (!Number.isFinite(state.lastHeartbeatAt)
          || now() - state.lastHeartbeatAt >= config.heartbeatIntervalMs) {
        try {
          await withRetry(() => sendHeartbeat("online", { processing: false }), retry("lease renewal"));
        } catch (err) {
          if (classifyError(err) === "fatal") state.fatal = err;
          else state.criticalHeartbeatFailed = true;
          log("error", `lease renewal failed: ${redact(err?.message ?? err)}`);
          if (state.fatal) break;
        }
      }

      let claimed;
      try {
        claimed = await withRetry(() => {
          state.claims += 1;
          return api.claim();
        }, retry("task claim"));
      } catch (err) {
        const kind = classifyError(err);
        // A 4xx rejection (for example a stale lock recovered by the server)
        // is expected contention, not a failed run. Retryable/fatal failures
        // are real errors and must produce a non-zero exit code.
        if (kind !== "nonretryable") state.processingFailed = true;
        if (isAuthFailure(err) || kind === "fatal") state.fatal = err;
        log("error", `task claim failed: ${redact(err?.message ?? err)}`);
        if (signal.aborted) break;
        if (state.fatal) break;
        await sleep(Math.min(config.maxRetryMs, config.baseRetryMs * 2 ** Math.min(state.polls, 6)), signal);
        continue;
      }

      if (isEmptyQueueResult(claimed)) {
        await sleep(config.pollIntervalMs, signal);
        continue;
      }

      const taskId = claimed?.task?.id ?? claimed?.id ?? "unknown";
      if (state.claimedIds.has(taskId)) {
        log("warn", `duplicate claim ignored for ${taskId}; work already reported`);
        await sleep(config.pollIntervalMs, signal);
        continue;
      }
      state.claimedIds.add(taskId);
      state.processing = true;
      state.leaseLost = false;
      state.consecutiveHeartbeatFailures = 0;
      let finished = false;
      let leaseLost = false;
      // A long task outlives several poll intervals. Renew the lease in the
      // background with processing:true so the app never reports the worker as
      // idle while a form is being filled, and never lets the lease expire.
      const heartbeatPump = (async () => {
        while (!finished && !signal.aborted) {
          await sleep(config.heartbeatIntervalMs, signal);
          if (finished || signal.aborted) break;
          try {
            await withRetry(
              () => sendHeartbeat("online", { processing: true, taskId }),
              retry("task heartbeat"),
            );
            state.consecutiveHeartbeatFailures = 0;
          } catch (err) {
            state.consecutiveHeartbeatFailures += 1;
            log("error", `heartbeat during task failed: ${redact(err?.message ?? err)}`);
            if (state.consecutiveHeartbeatFailures >= config.heartbeatFailureLimit) {
              leaseLost = true;
              state.leaseLost = true;
              log("error", `lease renewal failed for ${taskId}; stopping work so the task can be recovered by stale-lock handling`);
              break;
            }
          }
        }
      })();

      let raw;
      try {
        raw = await options.deps.executeTask(claimed, {
          taskId,
          signal,
          now,
          sleep,
          log,
          heartbeatNow: () => sendHeartbeat("online", { processing: true, taskId }),
          shouldStop: () => signal.aborted || leaseLost,
          redact,
        });
      } catch (err) {
        raw = { status: "failed", message: redact(err?.message ?? String(err)) };
      } finally {
        finished = true;
        await heartbeatPump.catch(() => {});
        state.processing = false;
      }

      const interrupted = signal.aborted;
      if (interrupted) state.processingFailed = true;

      let result = normalizeTaskResult(raw);
      if (leaseLost) {
        state.processingFailed = true;
        result = {
          status: "failed",
          message: "Worker lease expired during processing; task released for stale-lock recovery.",
          finalUrl: result.finalUrl,
          fieldsFilled: result.fieldsFilled,
          screenshotPath: result.screenshotPath,
        };
      } else if (interrupted && result.status === "applied") {
        result = {
          ...result,
          status: "manual_required",
          message: "Worker was shutting down; application was not confirmed as submitted.",
          confirmation: undefined,
        };
      }

      try {
        const response = await withRetry(() => api.report(taskId, {
          status: result.status,
          message: redact(result.message),
          confirmation: result.confirmation,
          finalUrl: result.finalUrl,
          fieldsFilled: result.fieldsFilled,
          screenshotPath: result.screenshotPath,
        }, { abortable: false }), { ...retry("result report"), respectAbort: false });
        state.results += 1;
        if (response?.duplicate) log("info", `result for ${taskId} was already recorded (duplicate)`);
      } catch (err) {
        state.processingFailed = true;
        log("error", `result report failed for ${taskId}: ${redact(err?.message ?? err)}`);
      }
      state.tasksProcessed += 1;

      // Clear the processing flag so the idle lease never appears busy.
      if (!signal.aborted) {
        try {
          await withRetry(() => sendHeartbeat("online", { processing: false }), retry("processing-clear heartbeat"));
        } catch (err) {
          if (classifyError(err) === "fatal") state.fatal = err;
          else state.criticalHeartbeatFailed = true;
          log("error", `processing-clear heartbeat failed: ${redact(err?.message ?? err)}`);
        }
      }
    }

    return shutdown();
  }

  return { run, state, sendHeartbeat };
}

// Only an explicit, positive message from the employer's result page counts as
// confirmation. A changed URL, a clicked button or the absence of an error is
// never enough to mark an application Applied.
const EXPLICIT_CONFIRMATION = "text=/thank you for (applying|your application)|application (has been )?(received|submitted|confirmed)|we.?ve received your application|your application (was|has been) submitted/i";
const VALIDATION_ERROR = "text=/please (fill|correct|fix)|required field|invalid (email|phone)|validation error/i";

const FIELD_MATCHERS = [
  { keys: ["full name", "full_name", "applicant name", "name"], value: (c) => c.fullName },
  { keys: ["email", "e-mail"], value: (c) => c.email },
  { keys: ["phone", "mobile", "telephone"], value: (c) => c.phone },
  { keys: ["city"], value: (c) => c.city },
  { keys: ["state", "province"], value: (c) => c.state },
  { keys: ["country"], value: (c) => c.country },
  { keys: ["linkedin"], value: (c) => c.linkedinUrl },
  { keys: ["github"], value: (c) => c.githubUrl },
  { keys: ["portfolio", "website"], value: (c) => c.portfolioUrl },
  { keys: ["headline", "current title"], value: (c) => c.headline },
  { keys: ["summary", "cover letter"], value: (c) => c.summary },
  { keys: ["experience"], value: (c) => c.experienceYears },
  { keys: ["degree", "qualification"], value: (c) => c.degree },
  { keys: ["university", "college"], value: (c) => c.university },
  { keys: ["graduation"], value: (c) => c.graduationYear },
  { keys: ["cgpa", "gpa"], value: (c) => c.cgpa },
  { keys: ["notice period", "notice"], value: (c) => c.noticePeriod },
  { keys: ["current status", "employment status"], value: (c) => c.currentStatus },
];

async function fillForm(page, candidate, answers, fieldsFilled) {
  const inputs = await page.locator(
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select",
  ).all();
  for (const input of inputs) {
    try {
      const type = (await input.getAttribute("type")) || "text";
      const name = (await input.getAttribute("name")) || "";
      const id = (await input.getAttribute("id")) || "";
      const label = id ? (await page.locator(`label[for="${id}"]`).first().innerText().catch(() => "")) : "";
      const haystack = [name, id, await input.getAttribute("placeholder"), await input.getAttribute("aria-label"), label]
        .join(" ").toLowerCase();
      if (!haystack.trim()) continue;
      let value = "";
      for (const matcher of FIELD_MATCHERS) {
        if (matcher.keys.some((key) => haystack.includes(key))) {
          const candidateValue = matcher.value(candidate);
          if (candidateValue !== null && candidateValue !== undefined) value = String(candidateValue);
          break;
        }
      }
      if (!value) {
        for (const answer of answers || []) {
          if (answer?.answer && haystack.includes(String(answer.question).toLowerCase().slice(0, 25))) {
            value = String(answer.answer);
            break;
          }
        }
      }
      if (!value) continue;
      if (type.startsWith("select")) {
        await input.selectOption({ label: value }).catch(() => input.selectOption(value).catch(() => {}));
      } else {
        await input.fill(value);
      }
      fieldsFilled.push(name || id || label.trim().slice(0, 40) || "field");
    } catch {
      // Per-field failures are non-fatal; the result remains manual_required
      // unless every required field can be filled and confirmation is explicit.
    }
  }
}

async function uploadResume(page, documents, fieldsFilled, token, baseUrl) {
  const doc = (documents || []).find((d) => /resume|cv/i.test(`${d.kind || ""} ${d.filename || ""}`)) || documents?.[0];
  if (!doc?.downloadUrl || !(await page.locator("input[type=file]").count())) return;
  const url = String(doc.downloadUrl).startsWith("http") ? String(doc.downloadUrl) : `${baseUrl}${doc.downloadUrl}`;
  const res = await fetch(url, { headers: { "x-worker-token": token } });
  if (!res.ok) throw new Error(`document download failed: ${res.status}`);
  const [{ mkdtemp, writeFile, rm }, os, path] = await Promise.all([
    import("node:fs/promises"), import("node:os"), import("node:path"),
  ]);
  const dir = await mkdtemp(path.join(os.tmpdir(), "jobpilot-worker-"));
  try {
    const filename = path.basename(String(doc.filename || "resume")).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(dir, filename);
    await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
    await page.locator("input[type=file]").first().setInputFiles(filePath);
    fieldsFilled.push("resume-upload");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Default browser executor. It deliberately never returns "applied" unless the
 * employer's own result page contains explicit confirmation text; everything
 * else becomes manual_required for human review.
 */
export function createPlaywrightExecutor(options = {}) {
  const headless = options.headless ?? process.env.HEADLESS !== "false";
  const timeoutMs = options.timeoutMs ?? Number(process.env.BROWSER_TIMEOUT_MS || 120_000);
  const token = String(options.token ?? process.env.WORKER_TOKEN ?? "");
  const baseUrl = String(options.baseUrl ?? process.env.APP_URL ?? "").replace(/\/$/, "");

  return async function executeTask(payload, ctx) {
    const { chromium } = await import("playwright");
    const fieldsFilled = [];
    let finalUrl = "";
    let browser;
    let context;
    const checkAbort = () => {
      if (ctx.signal?.aborted) throw new Error("worker-shutdown");
    };
    try {
      checkAbort();
      if (!payload?.job?.applicationUrl) throw new Error("Job has no application URL.");
      browser = await chromium.launch({ headless });
      context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);
      await page.goto(payload.job.applicationUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      checkAbort();
      await fillForm(page, payload.candidate, payload.answers, fieldsFilled);
      await uploadResume(page, payload.documents, fieldsFilled, token, baseUrl);
      finalUrl = page.url();

      if (payload.submit === false) {
        return { status: "manual_required", message: "Form prepared for manual completion (submit=false).", finalUrl, fieldsFilled };
      }

      let clicked = false;
      for (const selector of [
        'button[type="submit"]', 'input[type="submit"]',
        'button:has-text("Submit")', 'button:has-text("Apply")', 'button:has-text("Send")',
      ]) {
        const button = page.locator(selector).first();
        if (await button.count()) {
          try {
            await button.click({ timeout: Math.min(5_000, timeoutMs) });
            clicked = true;
            break;
          } catch {
            // Try the next candidate selector.
          }
        }
      }
      if (!clicked) {
        return { status: "manual_required", message: "Form filled but no submit button was found; manual completion required.", finalUrl, fieldsFilled };
      }
      await page.waitForTimeout(3_000);
      checkAbort();
      finalUrl = page.url();
      const successCount = await page.locator(EXPLICIT_CONFIRMATION).count();
      const errorCount = await page.locator(VALIDATION_ERROR).count();
      const outcome = submissionOutcome({
        successCount,
        errorCount,
        clicked: true,
        confirmation: successCount > 0 ? "explicit employer confirmation text on the result page" : "",
      });
      if (outcome.status === "applied") {
        return {
          status: "applied",
          confirmation: outcome.confirmation,
          message: "Application submitted with explicit employer confirmation.",
          finalUrl,
          fieldsFilled,
        };
      }
      return {
        status: "manual_required",
        message: `Submission needs manual review (${outcome.reason || "no explicit confirmation"}).`,
        finalUrl,
        fieldsFilled,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (ctx.signal?.aborted) {
        return { status: "manual_required", message: "Worker shut down before the application was confirmed; manual review required.", finalUrl, fieldsFilled };
      }
      return { status: "failed", message: ctx.redact ? ctx.redact(message) : message, finalUrl, fieldsFilled };
    } finally {
      await context?.close?.().catch(() => {});
      await browser?.close?.().catch(() => {});
    }
  };
}

async function main() {
  const check = validateEnv(process.env);
  if (!check.ok) {
    for (const error of check.errors) console.error(error);
    process.exitCode = 1;
    return;
  }

  const controller = new AbortController();
  let signalled = false;
  const onSignal = (name) => {
    if (!signalled) {
      signalled = true;
      console.log(`${name} received; draining current work before shutdown`);
    }
    controller.abort();
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  const number = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const config = {
    baseUrl: String(process.env.APP_URL).replace(/\/$/, ""),
    token: String(process.env.WORKER_TOKEN),
    pollIntervalMs: number(process.env.POLL_INTERVAL_MS, DEFAULT_CONFIG.pollIntervalMs),
    heartbeatIntervalMs: number(process.env.HEARTBEAT_INTERVAL_MS, DEFAULT_CONFIG.heartbeatIntervalMs),
    maxAttempts: number(process.env.MAX_ATTEMPTS, DEFAULT_CONFIG.maxAttempts),
    baseRetryMs: number(process.env.RETRY_BASE_MS, DEFAULT_CONFIG.baseRetryMs),
    maxRetryMs: number(process.env.RETRY_MAX_MS, DEFAULT_CONFIG.maxRetryMs),
    maxTasks: number(process.env.MAX_TASKS, DEFAULT_CONFIG.maxTasks),
  };

  const worker = createPersistentWorker({
    config,
    deps: {
      baseUrl: config.baseUrl,
      token: config.token,
      fetch: globalThis.fetch.bind(globalThis),
      sleep: createDefaultSleep(),
      now: Date.now,
      signal: controller.signal,
      log: (level, message) => {
        if (level === "error") console.error(message);
        else if (level === "warn") console.warn(message);
        else console.log(message);
      },
      executeTask: createPlaywrightExecutor({
        headless: process.env.HEADLESS !== "false",
        timeoutMs: number(process.env.BROWSER_TIMEOUT_MS, 120_000),
        baseUrl: config.baseUrl,
        token: config.token,
      }),
    },
  });

  const summary = await worker.run();
  process.exitCode = summary.exitCode;
}

const argv1 = process.argv[1];
let invokedDirectly = false;
try {
  invokedDirectly = Boolean(argv1) && import.meta.url === pathToFileURL(argv1).href;
} catch {
  invokedDirectly = false;
}
if (invokedDirectly) {
  main().catch((err) => {
    console.error("fatal worker error", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
