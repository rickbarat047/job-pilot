#!/usr/bin/env node
// Isolated restore verification for JobPilot AI backups.
//
// Usage:
//   RESTORE_VERIFY=1 \
//   DATABASE_URL=<source> \
//   RESTORE_VERIFY_URL=<disposable-target> \
//   node scripts/verify-backup.mjs --file ./backups/<dump> --manifest ./backups/<dump>.manifest.json
//
// Safety: refuses NODE_ENV=production, refuses the same target as the source,
// and requires an explicit opt-in. It only restores into the target URL.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertSafeRestoreTarget,
  buildPgEnv,
  evaluateRestoreVerification,
  parseConnectionUrl,
  redactSecrets,
  REQUIRED_TABLES,
} from "./backup-lib.mjs";

const repoRoot = process.cwd();
const args = process.argv.slice(2);

function optionValue(flag, fallback = "") {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const file = optionValue("--file");
const manifestPath = optionValue("--manifest");
const sourceUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const targetUrl = process.env.RESTORE_VERIFY_URL || "";
const secrets = () => [sourceUrl, targetUrl].filter(Boolean);

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

function psql(env, sql) {
  return runBinary("psql", ["-v", "ON_ERROR_STOP=1", "-Atc", sql], env).trim();
}

function readManifest() {
  if (!manifestPath) return {};
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  assertSafeRestoreTarget({
    sourceUrl,
    targetUrl,
    nodeEnv: process.env.NODE_ENV || "",
    explicitOptIn: process.env.RESTORE_VERIFY === "1",
  });

  if (!file) throw new Error("--file <backup.dump> is required for restore verification.");

  const target = parseConnectionUrl(targetUrl, "RESTORE_VERIFY_URL");
  const targetEnv = buildPgEnv(target, { sslDisabled: target.sslmode === "disable" });
  const manifest = readManifest();
  const expectedCounts = Object.fromEntries(
    Object.entries(manifest.sourceCounts || {}).filter(([, value]) => Number.isInteger(value)),
  );

  console.log("Preparing isolated restore target (never production)...");
  psql(targetEnv, "DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

  console.log("Restoring backup into the isolated target...");
  runBinary("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", file], targetEnv);

  const tableNames = psql(
    targetEnv,
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
  )
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);

  const counts = {};
  for (const table of REQUIRED_TABLES) {
    try {
      counts[table] = Number(psql(targetEnv, `SELECT count(*) FROM public."${table}"`));
    } catch {
      counts[table] = null;
    }
  }

  const result = evaluateRestoreVerification({
    tableNames,
    counts,
    expectedCounts,
    migrationTables: ["push_subscriptions"],
  });
  for (const check of result.checks) console.log(`  ok: ${check}`);
  for (const error of result.errors) console.error(`  ERROR: ${error}`);
  if (!result.ok) process.exit(1);

  // Prove migration compatibility: the latest additive migrations must apply
  // cleanly on top of a database restored from the backup.
  for (const migration of ["0001_schema.sql", "0003_push_subscriptions.sql"]) {
    runBinary(
      "psql",
      ["-v", "ON_ERROR_STOP=1", "-f", join(repoRoot, "supabase", "migrations", migration)],
      targetEnv,
    );
  }
  console.log("Restore verification passed: schema, data and migrations verified.");
  process.exit(0);
}

main().catch((error) => {
  console.error(redactSecrets(error instanceof Error ? error.message : String(error), secrets()));
  process.exit(1);
});
