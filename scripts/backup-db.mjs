#!/usr/bin/env node
// Database backup script for JobPilot AI — PostgreSQL only, fail closed.
//
// Usage:
//   node scripts/backup-db.mjs [--out <dir>]
//
// Environment:
//   DATABASE_URL / POSTGRES_URL   PostgreSQL connection URL (required)
//   DATABASE_SSL=false            Disable SSL (default: require)
//   BACKUP_RETENTION_DAYS         Local prune window (default 30)
//   BACKUP_PRUNE=1                Opt in to pruning old local backups
//
// Connection credentials are passed to pg_dump through PG* environment
// variables. They are never placed on the command line, in a log line, or in
// the manifest. A failed or incomplete backup exits non-zero.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  backupExitCode,
  buildManifest,
  buildPgEnv,
  executeBackup,
  parseConnectionUrl,
  pruneExpiredBackups,
  redactSecrets,
  REQUIRED_TABLES,
  RETENTION_DAYS,
} from "./backup-lib.mjs";

function optionValue(args, flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const args = process.argv.slice(2);
const outDir = optionValue(args, "--out", process.env.BACKUP_DIR || "./backups");
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? RETENTION_DAYS);
const startedAt = new Date().toISOString();
const stamp = startedAt.replace(/[:.]/g, "-");

const secrets = () => [process.env.DATABASE_URL, process.env.POSTGRES_URL].filter(Boolean);

function runBinary(binary, binaryArgs, env = {}) {
  const result = spawnSync(binary, binaryArgs, {
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = redactSecrets(`${result.stderr || ""}\n${result.stdout || ""}`, secrets()).trim();
    throw new Error(`${binary} exited with code ${result.status}${detail ? `: ${detail.slice(0, 2000)}` : ""}`);
  }
  return result.stdout || "";
}

function inspectArtifact(filePath) {
  const sizeBytes = statSync(filePath).size;
  let magic = "";
  const fd = openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(5);
    const bytesRead = readSync(fd, buffer, 0, 5, 0);
    magic = buffer.subarray(0, bytesRead).toString("ascii");
  } finally {
    closeSync(fd);
  }
  return { sizeBytes, magic };
}

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/** Best-effort source row counts so restores can be compared with the source. */
async function readSourceCounts(connectionUrl) {
  try {
    const conn = parseConnectionUrl(connectionUrl);
    const { Pool } = await import("pg");
    const pool = new Pool({
      host: conn.host,
      port: conn.port,
      database: conn.database,
      user: conn.user,
      password: conn.password,
      ssl: conn.sslmode === "disable" ? false : { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 15000,
      statement_timeout: 15000,
    });
    const counts = {};
    try {
      for (const table of REQUIRED_TABLES) {
        try {
          const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "${table}"`);
          counts[table] = rows[0]?.n ?? null;
        } catch {
          counts[table] = null;
        }
      }
    } finally {
      await pool.end();
    }
    return counts;
  } catch {
    return {};
  }
}

function pruneOldBackups() {
  if (process.env.BACKUP_PRUNE !== "1") return;
  const entries = readdirSync(outDir, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    mtimeMs: statSync(join(outDir, entry.name)).mtimeMs,
  }));
  for (const name of pruneExpiredBackups(entries, { retentionDays })) {
    unlinkSync(join(outDir, name));
    console.log(`Pruned expired backup: ${name}`);
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const connectionUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  const sourceCounts = connectionUrl ? await readSourceCounts(connectionUrl) : {};

  const result = await executeBackup({
    connectionUrl,
    outDir,
    stamp,
    startedAt,
    sourceCounts,
    sslDisabled: process.env.DATABASE_SSL === "false",
    runCommand: ({ binary, args: cmdArgs, env }) => runBinary(binary, cmdArgs, env),
    inspectArtifact: ({ filePath }) => inspectArtifact(filePath),
    hashFile: ({ filePath }) => hashFile(filePath),
  });

  if (!result.ok) {
    for (const error of result.errors) console.error(redactSecrets(error, secrets()));
    process.exit(1);
  }

  // A pg_restore table-of-contents read proves the dump is structurally valid,
  // not merely non-empty with the correct magic header.
  const verificationErrors = [];
  try {
    const toc = runBinary("pg_restore", ["-l", result.filePath]);
    if (!/\bTABLE\b/i.test(toc)) verificationErrors.push("pg_restore -l found no TABLE entries in the dump");
  } catch (error) {
    verificationErrors.push(redactSecrets(error.message, secrets()));
  }

  const manifest = buildManifest({
    startedAt,
    finishedAt: new Date().toISOString(),
    database: parseConnectionUrl(connectionUrl).database,
    filename: result.filename,
    sizeBytes: result.artifact.sizeBytes,
    sha256: result.manifest.sha256,
    sourceCounts,
    verification: { ok: verificationErrors.length === 0, errors: verificationErrors },
  });
  writeFileSync(
    join(outDir, `${result.filename}.manifest.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  if (verificationErrors.length > 0) {
    for (const error of verificationErrors) console.error(`Backup verification failed: ${error}`);
    process.exit(1);
  }

  pruneOldBackups();
  console.log(
    `Backup verified: ${result.filename} (${result.artifact.sizeBytes} bytes, sha256 ${result.manifest.sha256})`,
  );
  process.exit(backupExitCode(result));
}

main().catch((error) => {
  console.error(redactSecrets(error instanceof Error ? error.message : String(error), secrets()));
  process.exit(1);
});
