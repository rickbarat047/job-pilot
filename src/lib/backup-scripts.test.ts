import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const tempDirs: string[] = [];

function freshOutDir() {
  const dir = mkdtempSync(join(tmpdir(), "jobpilot-backup-test-"));
  tempDirs.push(dir);
  return dir;
}

function runScript(script: string, args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("backup-db.mjs CLI", () => {
  it("fails closed with no DATABASE_URL and no SQLite fallback", () => {
    const outDir = freshOutDir();
    const result = runScript("scripts/backup-db.mjs", ["--out", outDir], {
      DATABASE_URL: "",
      POSTGRES_URL: "",
      DATABASE_PATH: "",
      NODE_ENV: "test",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/DATABASE_URL is required/);
    expect(result.stderr).toMatch(/SQLite fallback is disabled/);
    expect(readdirSync(outDir)).toHaveLength(0);
  });

  it("fails closed on a non-PostgreSQL connection URL", () => {
    const outDir = freshOutDir();
    const result = runScript("scripts/backup-db.mjs", ["--out", outDir], {
      DATABASE_URL: "mysql://user:pass@host/db",
      POSTGRES_URL: "",
      NODE_ENV: "test",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/PostgreSQL connection URL/);
    expect(readdirSync(outDir)).toHaveLength(0);
  });

  it("never prints a password from a failed connection", () => {
    const result = runScript("scripts/backup-db.mjs", [], {
      DATABASE_URL: "postgres://jobpilot:never-print-me@127.0.0.1:1/nope?sslmode=disable",
      POSTGRES_URL: "",
      NODE_ENV: "test",
    });
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).not.toContain("never-print-me");
  });
});

describe("verify-backup.mjs CLI", () => {
  it("refuses to run without an explicit isolated-target opt-in", () => {
    const result = runScript("scripts/verify-backup.mjs", [], {
      DATABASE_URL: "postgres://u:p@source.example.com:5432/source",
      RESTORE_VERIFY_URL: "",
      RESTORE_VERIFY: "0",
      NODE_ENV: "test",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/opt-in/i);
  });
});
