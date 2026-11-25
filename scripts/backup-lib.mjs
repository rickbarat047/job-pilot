#!/usr/bin/env node
// Pure helpers for JobPilot PostgreSQL backup and restore verification.
// No credential is ever placed in argv, an error message, or a JSON-serialized
// manifest. Connection details are passed to pg_dump/psql via PG* env vars.

import { join } from "node:path";

export const BACKUP_MAGIC = "PGDMP";
export const MIN_BACKUP_BYTES = 1024;
export const RETENTION_DAYS = 30;

// Tables that must survive a restore for the application to remain functional.
// Mirrors supabase/migrations/0001_schema.sql + 0003_push_subscriptions.sql.
export const REQUIRED_TABLES = Object.freeze([
  "users",
  "sessions",
  "candidate_profiles",
  "candidate_skills",
  "candidate_preferences",
  "uploaded_resumes",
  "jobs",
  "job_matches",
  "applications",
  "automation_tasks",
  "worker_status",
  "app_meta",
  "push_subscriptions",
]);

/**
 * @typedef {object} ConnectionInfo
 * @property {string} host
 * @property {number} port
 * @property {string} user
 * @property {string} password
 * @property {string} database
 * @property {string} sslmode
 */

/**
 * @typedef {object} PgEnv
 * @property {string} PGHOST
 * @property {string} PGPORT
 * @property {string} PGDATABASE
 * @property {string} PGSSLMODE
 * @property {string} [PGUSER]
 * @property {string} [PGPASSWORD]
 */

/**
 * @typedef {object} BackupArtifact
 * @property {number} sizeBytes
 * @property {string} magic
 */

export class BackupConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "BackupConfigError";
  }
}

/** Replace credentials in arbitrary text before it is logged. */
export function redactSecrets(text, secrets = []) {
  let output = String(text ?? "");
  for (const secret of secrets) {
    if (secret) output = output.split(String(secret)).join("[REDACTED]");
  }
  output = output.replace(/((?:postgres|postgresql):\/\/)([^/@\s]+)@/g, "$1[REDACTED]@");
  output = output.replace(/([?&](?:password|pass|token|secret)=)[^&\s]+/gi, "$1[REDACTED]");
  return output;
}

/**
 * Parse and validate a PostgreSQL connection URL. The password is attached as
 * a non-enumerable property so JSON.stringify(parsed) cannot leak it.
 */
/** @returns {ConnectionInfo} */
export function parseConnectionUrl(rawUrl, envName = "DATABASE_URL") {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw new BackupConfigError(
      `${envName} is required for PostgreSQL backups. SQLite fallback is disabled.`,
    );
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    if (/^postgres(?:ql)?:\/\//i.test(rawUrl.trim())) {
      throw new BackupConfigError(`${envName} must include a host and database.`);
    }
    throw new BackupConfigError(`${envName} must be a PostgreSQL connection URL (postgres:// or postgresql://).`);
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new BackupConfigError(`${envName} must be a PostgreSQL connection URL (postgres:// or postgresql://).`);
  }
  if (!url.hostname) {
    throw new BackupConfigError(`${envName} must include a host.`);
  }
  let database;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    throw new BackupConfigError(`${envName} contains an invalid database name.`);
  }
  if (!database) {
    throw new BackupConfigError(`${envName} must include a database name.`);
  }
  let user = "";
  let password = "";
  try {
    user = decodeURIComponent(url.username || "");
    password = decodeURIComponent(url.password || "");
  } catch {
    throw new BackupConfigError(`${envName} contains invalid credentials.`);
  }
  const parsed = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user,
    password,
    database,
    sslmode: url.searchParams.get("sslmode") || "require",
  };
  // Keep JSON.stringify(parsed) safe for logging while allowing callers that
  // need it (buildPgEnv) to read the password explicitly.
  Object.defineProperty(parsed, "password", { enumerable: false, writable: false });
  return parsed;
}

/** Build PG* environment variables so the DSN never appears in argv. */
/** @returns {PgEnv} */
export function buildPgEnv(conn, { sslDisabled = false } = {}) {
  const env = {
    PGHOST: conn.host,
    PGPORT: String(conn.port),
    PGDATABASE: conn.database,
    PGSSLMODE: sslDisabled ? "disable" : conn.sslmode || "require",
  };
  if (conn.user) env.PGUSER = conn.user;
  if (conn.password) env.PGPASSWORD = conn.password;
  return env;
}

/** Detect empty/truncated/corrupt custom-format dumps. */
export function validateBackupArtifact({ sizeBytes, magic, minBytes = MIN_BACKUP_BYTES }) {
  const errors = [];
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    errors.push("backup artifact is empty (0 bytes)");
  } else if (sizeBytes < minBytes) {
    errors.push(`backup artifact is too small (${sizeBytes} bytes)`);
  }
  if (magic !== BACKUP_MAGIC) {
    errors.push(`backup artifact has an invalid format magic (expected ${BACKUP_MAGIC})`);
  }
  return { ok: errors.length === 0, errors };
}

/** Record only non-sensitive metadata about a backup. */
export function buildManifest({
  startedAt,
  finishedAt,
  database,
  filename,
  sizeBytes,
  sha256,
  sourceCounts = {},
  verification = { ok: false, errors: [] },
}) {
  const startMs = Date.parse(startedAt);
  const finishMs = Date.parse(finishedAt);
  return {
    schemaVersion: 1,
    tool: "jobpilot-backup",
    startedAt,
    finishedAt,
    durationMs: Number.isFinite(startMs) && Number.isFinite(finishMs) ? finishMs - startMs : null,
    database,
    format: "custom",
    filename,
    sizeBytes,
    sha256,
    sourceCounts,
    verification: { ok: verification.ok === true, errors: verification.errors || [] },
    verified: verification.ok === true,
  };
}

export function backupExitCode(result) {
  return result && result.ok === true ? 0 : 1;
}

/**
 * Execute a pg_dump backup with injectable side effects so it can be tested.
 * `runCommand` receives {binary, args, env}; `env` holds the credentials.
 */
export async function executeBackup({
  connectionUrl,
  outDir = "./backups",
  stamp,
  startedAt = new Date().toISOString(),
  sourceCounts = {},
  sslDisabled = false,
  runCommand,
  inspectArtifact,
  hashFile,
}) {
  let conn;
  try {
    conn = parseConnectionUrl(connectionUrl);
  } catch (error) {
    return { ok: false, errors: [redactSecrets(error.message)], command: null, manifest: null };
  }

  const filename = `jobpilot-backup-${stamp}.dump`;
  const filePath = join(outDir, filename);
  const args = ["--format=custom", "--no-owner", "--no-acl", `--file=${filePath}`];
  const command = { binary: "pg_dump", args };

  try {
    await runCommand({ ...command, env: buildPgEnv(conn, { sslDisabled }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [`pg_dump failed: ${redactSecrets(message, [conn.password, connectionUrl])}`],
      command,
      manifest: null,
    };
  }

  const artifact = await inspectArtifact({ filePath });
  const validation = validateBackupArtifact(artifact);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, command, artifact, manifest: null };
  }

  const sha256 = await hashFile({ filePath });
  const manifest = buildManifest({
    startedAt: startedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    database: conn.database,
    filename,
    sizeBytes: artifact.sizeBytes,
    sha256,
    sourceCounts,
    verification: { ok: true, errors: [] },
  });
  return { ok: true, errors: [], command, artifact, filePath, filename, manifest };
}

/** Select expired backups produced by this script inside the given directory. */
/**
 * @param {Array<{name: string, mtimeMs: number}>} files
 * @returns {string[]}
 */
export function pruneExpiredBackups(files, { nowMs = Date.now(), retentionDays = RETENTION_DAYS } = {}) {
  const cutoff = nowMs - retentionDays * 86400000;
  return files
    .filter(
      (file) =>
        typeof file.name === "string" &&
        file.name.startsWith("jobpilot-backup-") &&
        Number.isFinite(file.mtimeMs) &&
        file.mtimeMs < cutoff,
    )
    .map((file) => file.name);
}

/** Refuse to restore into production or an unconfirmed target. */
export function assertSafeRestoreTarget({ sourceUrl, targetUrl, nodeEnv, explicitOptIn }) {
  if (!explicitOptIn) {
    throw new BackupConfigError("Restore verification requires explicit opt-in (RESTORE_VERIFY=1).");
  }
  if (nodeEnv === "production") {
    throw new BackupConfigError("Restore verification is forbidden when NODE_ENV=production.");
  }
  const source = parseConnectionUrl(sourceUrl, "DATABASE_URL");
  const target = parseConnectionUrl(targetUrl, "RESTORE_VERIFY_URL");
  const sameDatabase =
    source.host.toLowerCase() === target.host.toLowerCase() &&
    source.port === target.port &&
    source.database === target.database;
  if (sameDatabase) {
    throw new BackupConfigError("Restore target is the same database as the backup source; refusing.");
  }
  if (/prod/i.test(target.database)) {
    throw new BackupConfigError("Restore target database name suggests production; refusing.");
  }
  return target;
}

/** Verify restored schema, data counts and migration-added objects. */
/**
 * @param {{tableNames: readonly string[], counts: Record<string, number | null>, expectedCounts: Record<string, number>, migrationTables?: string[]}} args
 */
export function evaluateRestoreVerification({ tableNames, counts, expectedCounts, migrationTables = [] }) {
  const errors = [];
  const checks = [];
  const present = new Set(tableNames || []);

  for (const table of REQUIRED_TABLES) {
    if (!present.has(table)) errors.push(`Essential table "${table}" is missing after restore.`);
    else checks.push(`table:${table}`);
  }
  for (const table of migrationTables) {
    if (!present.has(table)) errors.push(`Migration table "${table}" is missing after restore.`);
    else checks.push(`migration:${table}`);
  }
  for (const [table, expected] of Object.entries(expectedCounts || {})) {
    const actual = counts?.[table];
    if (actual !== expected) {
      errors.push(`Data count mismatch for ${table}: expected ${expected}, got ${actual}.`);
    } else {
      checks.push(`count:${table}=${expected}`);
    }
  }
  return { ok: errors.length === 0, errors, checks };
}
