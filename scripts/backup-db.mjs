#!/usr/bin/env node
// Database backup script for JobPilot AI.
// Usage:
//   node scripts/backup-db.mjs [--out <dir>]
// Env:
//   DATABASE_URL / POSTGRES_URL  -> uses pg_dump (Postgres)
//   DATABASE_PATH (sqlite)       -> copies the SQLite file (with WAL checkpoint)
//   STORAGE_DIR                  -> optional base for relative DATABASE_PATH
//
// Output: <out>/jobpilot-backup-<timestamp>.sql (postgres) or .db (sqlite)

import { execSync } from "node:child_process";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const outDir = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : process.env.BACKUP_DIR || "./backups";

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (pgUrl) {
  const file = join(outDir, `jobpilot-backup-${stamp}.sql`);
  console.log(`Backing up Postgres to ${file} ...`);
  try {
    execSync(`pg_dump "${pgUrl}" --no-owner --no-acl -f "${file}"`, { stdio: "inherit" });
    console.log(`✅ Postgres backup written: ${file}`);
  } catch (err) {
    console.error("pg_dump failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
} else {
  const dbPath = process.env.DATABASE_PATH || "./data/jobpilot.db";
  const resolved = resolve(dbPath);
  if (!existsSync(resolved)) {
    console.error(`SQLite DB not found at ${resolved}`);
    process.exit(1);
  }
  const file = join(outDir, `jobpilot-backup-${stamp}.db`);
  console.log(`Backing up SQLite ${resolved} -> ${file} ...`);
  try {
    // Checkpoint WAL first so the copy is consistent.
    try { execSync(`sqlite3 "${resolved}" "PRAGMA wal_checkpoint(TRUNCATE);"`, { stdio: "ignore" }); } catch { /* sqlite3 CLI may be missing; copy anyway */ }
    copyFileSync(resolved, file);
    // Also copy WAL/shm if present
    for (const suffix of ["-wal", "-shm"]) {
      const src = resolved + suffix;
      if (existsSync(src)) copyFileSync(src, file + suffix);
    }
    console.log(`✅ SQLite backup written: ${file}`);
  } catch (err) {
    console.error("SQLite backup failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}