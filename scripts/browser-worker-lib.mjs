// Shared, side-effect-free helpers for the JobPilot browser worker.
// Imported by scripts/browser-worker.mjs and by unit tests.

export const WORKER_STATUSES = ["online", "offline"];

export function validateEnv(env) {
  const errors = [];
  const appUrl = env?.APP_URL;
  const workerToken = env?.WORKER_TOKEN;
  if (!appUrl || String(appUrl).trim() === "") errors.push("APP_URL is required.");
  if (!workerToken || String(workerToken).trim() === "") errors.push("WORKER_TOKEN is required.");
  return { ok: errors.length === 0, errors };
}

export function buildHeartbeatBody(status, meta = {}, token) {
  if (!WORKER_STATUSES.includes(status)) {
    throw new Error(`Invalid worker status: ${status}. Expected one of ${WORKER_STATUSES.join(", ")}.`);
  }
  // status is a TOP-LEVEL property; meta is separate and must not contain the status.
  const body = { status, meta: meta && typeof meta === "object" ? { ...meta } : {} };
  if (token !== undefined) body.token = token;
  // Never let a nested status override the top-level one.
  delete body.meta.status;
  return body;
}

export class ApiError extends Error {
  constructor(status, method, path, body) {
    super(`${method} ${path} -> ${status}: ${String(body ?? "").slice(0, 300)}`);
    this.name = "ApiError";
    this.status = status;
    this.method = method;
    this.path = path;
  }
}

export function createApiError(status, method, path, body) {
  return new ApiError(status, method, path, body);
}

export function isEmptyQueueResult(result) {
  return !result || !result.task;
}

export function isAuthFailure(err) {
  return Boolean(err && (err.status === 401 || /-> 401\b/.test(String(err.message || ""))));
}

export function isCriticalHeartbeatFailure(err) {
  if (!err) return false;
  if (typeof err.status === "number") {
    if (err.status === 401 || err.status === 404) return true;
    if (err.status >= 500) return true;
  }
  // Fall back to message-based detection for errors without a status property.
  const msg = String(err.message || err);
  return /-> 401\b/.test(msg) || /-> 404\b/.test(msg) || /-> 5\d\d\b/.test(msg);
}

export function shutdownExitCode(processingFailed, offlineHeartbeatFailed, criticalHeartbeatFailed = false) {
  // An earlier processing or critical heartbeat failure must not be concealed
  // by a shutdown heartbeat error (and vice versa).
  if (processingFailed) return 1;
  if (criticalHeartbeatFailed) return 1;
  if (offlineHeartbeatFailed) return 1;
  return 0;
}

export function shouldFailWorkflowOnHttpStatus(status) {
  // 401, 404, and 5xx must never be treated as success.
  if (status === 401 || status === 404) return true;
  if (status >= 500) return true;
  return false;
}
