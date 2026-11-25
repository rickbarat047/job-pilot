import { describe, it, expect } from "vitest";
import {
  parseConnectionUrl,
  buildPgEnv,
  redactSecrets,
  validateBackupArtifact,
  buildManifest,
  backupExitCode,
  executeBackup,
  pruneExpiredBackups,
  assertSafeRestoreTarget,
  evaluateRestoreVerification,
  REQUIRED_TABLES,
} from "../../scripts/backup-lib.mjs";

const VALID_URL = "postgres://jobpilot:super-secret@db.example.com:6543/jobpilot?sslmode=require";

describe("backup-lib - connection configuration", () => {
  it("fails clearly when DATABASE_URL is missing (no SQLite fallback)", () => {
    expect(() => parseConnectionUrl("")).toThrow(/DATABASE_URL is required/);
    expect(() => parseConnectionUrl("")).toThrow(/SQLite fallback is disabled/);
  });

  it("rejects a non-PostgreSQL connection string", () => {
    expect(() => parseConnectionUrl("mysql://user:pass@host/db")).toThrow(
      /PostgreSQL connection URL/,
    );
  });

  it("rejects a PostgreSQL URL with no host or database", () => {
    expect(() => parseConnectionUrl("postgres://user:pass@/")).toThrow(/host/);
  });

  it("parses a valid URL and exposes connection parts without the password", () => {
    const parsed = parseConnectionUrl(VALID_URL);
    expect(parsed.host).toBe("db.example.com");
    expect(parsed.port).toBe(6543);
    expect(parsed.user).toBe("jobpilot");
    expect(parsed.password).toBe("super-secret");
    expect(parsed.database).toBe("jobpilot");
    expect(JSON.stringify(parsed)).not.toContain("super-secret");
  });

  it("builds PG* environment variables instead of a connection string argument", () => {
    const env = buildPgEnv(parseConnectionUrl(VALID_URL));
    expect(env.PGHOST).toBe("db.example.com");
    expect(env.PGPORT).toBe("6543");
    expect(env.PGUSER).toBe("jobpilot");
    expect(env.PGPASSWORD).toBe("super-secret");
    expect(env.PGDATABASE).toBe("jobpilot");
    expect(env.PGSSLMODE).toBe("require");
    expect(env).not.toHaveProperty("DATABASE_URL");
  });

  it("honours DATABASE_SSL=false by disabling SSL", () => {
    const env = buildPgEnv(parseConnectionUrl(VALID_URL), { sslDisabled: true });
    expect(env.PGSSLMODE).toBe("disable");
  });
});

describe("backup-lib - secret redaction", () => {
  it("redacts credentials embedded in a Postgres URL", () => {
    expect(redactSecrets(`pg_dump ${VALID_URL} failed`)).not.toContain("super-secret");
    expect(redactSecrets(`pg_dump ${VALID_URL} failed`)).toContain("[REDACTED]");
  });

  it("redacts explicitly supplied secret values", () => {
    expect(redactSecrets("token=abc123 failed", ["abc123"])).toBe("token=[REDACTED] failed");
  });
});

describe("backup-lib - artifact validation", () => {
  it("rejects an empty backup artifact", () => {
    const r = validateBackupArtifact({ sizeBytes: 0, magic: "PGDMP" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/empty/i);
  });

  it("rejects an artifact below the minimum size", () => {
    const r = validateBackupArtifact({ sizeBytes: 100, magic: "PGDMP" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/too small/i);
  });

  it("rejects an artifact with the wrong format magic", () => {
    const r = validateBackupArtifact({ sizeBytes: 4096, magic: "not-a-dump" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/magic/i);
  });

  it("accepts a valid custom-format dump", () => {
    expect(validateBackupArtifact({ sizeBytes: 4096, magic: "PGDMP" }).ok).toBe(true);
  });
});

describe("backup-lib - backup execution", () => {
  it("returns a non-zero exit code when the backup fails", () => {
    expect(backupExitCode({ ok: false, errors: ["pg_dump failed"] })).toBe(1);
    expect(backupExitCode({ ok: true, errors: [] })).toBe(0);
  });

  it("maps a thrown command failure into a redacted result", async () => {
    const result = await executeBackup({
      connectionUrl: VALID_URL,
      outDir: "./backups",
      stamp: "2026-11-25T00-00-00-000Z",
      runCommand: async () => {
        throw new Error(`connection failed for ${VALID_URL}`);
      },
      inspectArtifact: async () => ({ sizeBytes: 0, magic: "" }),
      hashFile: async () => "deadbeef",
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("super-secret");
    expect(result.errors.join(" ")).toMatch(/pg_dump failed/i);
  });

  it("builds a manifest with timestamp, size, sha256 and verification on success", async () => {
    const result = await executeBackup({
      connectionUrl: VALID_URL,
      outDir: "./backups",
      stamp: "2026-11-25T00-00-00-000Z",
      startedAt: "2026-11-25T00:00:00.000Z",
      sourceCounts: { users: 3 },
      runCommand: async () => undefined,
      inspectArtifact: async () => ({ sizeBytes: 4096, magic: "PGDMP" }),
      hashFile: async () => "abc123hash",
    });
    expect(result.ok).toBe(true);
    expect(result.manifest).toMatchObject({
      startedAt: "2026-11-25T00:00:00.000Z",
      format: "custom",
      sizeBytes: 4096,
      sha256: "abc123hash",
      database: "jobpilot",
      sourceCounts: { users: 3 },
    });
    expect(result.command?.args.join(" ") ?? "").not.toContain("super-secret");
  });

  it("assembles manifest fields without leaking connection details", () => {
    const manifest = buildManifest({
      startedAt: "2026-11-25T00:00:00.000Z",
      finishedAt: "2026-11-25T00:01:00.000Z",
      database: "jobpilot",
      filename: "jobpilot-backup-test.dump",
      sizeBytes: 4096,
      sha256: "hash",
      sourceCounts: { users: 1 },
      verification: { ok: true, errors: [] },
    });
    expect(manifest.verified).toBe(true);
    expect(JSON.stringify(manifest)).not.toMatch(/db\.example|super-secret/);
  });
});

describe("backup-lib - retention policy", () => {
  it("prunes only expired backups created by this script", () => {
    const nowMs = Date.parse("2026-11-25T00:00:00.000Z");
    const files = [
      { name: "jobpilot-backup-old.dump", mtimeMs: nowMs - 40 * 86400000 },
      { name: "jobpilot-backup-recent.dump", mtimeMs: nowMs - 2 * 86400000 },
      { name: "unrelated-backup.dump", mtimeMs: nowMs - 90 * 86400000 },
      { name: "manifest.json", mtimeMs: nowMs - 90 * 86400000 },
    ];
    expect(pruneExpiredBackups(files, { nowMs, retentionDays: 30 })).toEqual([
      "jobpilot-backup-old.dump",
    ]);
  });
});

describe("backup-lib - restore safety", () => {
  it("refuses to restore into the production URL", () => {
    expect(() =>
      assertSafeRestoreTarget({
        sourceUrl: VALID_URL,
        targetUrl: VALID_URL,
        nodeEnv: "test",
        explicitOptIn: true,
      }),
    ).toThrow(/same database/i);
  });

  it("refuses an un-opted-in restore target", () => {
    expect(() =>
      assertSafeRestoreTarget({
        sourceUrl: VALID_URL,
        targetUrl: "postgres://u:p@localhost:5432/jobpilot_restore",
        nodeEnv: "test",
        explicitOptIn: false,
      }),
    ).toThrow(/opt-in/i);
  });

  it("allows an explicitly opted-in, different, non-production target", () => {
    expect(() =>
      assertSafeRestoreTarget({
        sourceUrl: VALID_URL,
        targetUrl: "postgres://u:p@localhost:5432/jobpilot_restore",
        nodeEnv: "test",
        explicitOptIn: true,
      }),
    ).not.toThrow();
  });
});

describe("backup-lib - restore verification", () => {
  const counts = { users: 3, sessions: 2, candidate_profiles: 1, push_subscriptions: 4 };

  it("passes when essential tables, counts and migration objects are restored", () => {
    const result = evaluateRestoreVerification({
      tableNames: REQUIRED_TABLES,
      counts,
      expectedCounts: counts,
      migrationTables: ["push_subscriptions"],
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when an essential table is missing", () => {
    const result = evaluateRestoreVerification({
      tableNames: REQUIRED_TABLES.filter((t) => t !== "users"),
      counts,
      expectedCounts: counts,
      migrationTables: ["push_subscriptions"],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/users/);
  });

  it("fails when restored data counts differ from the source", () => {
    const result = evaluateRestoreVerification({
      tableNames: REQUIRED_TABLES,
      counts: { ...counts, users: 2 },
      expectedCounts: counts,
      migrationTables: ["push_subscriptions"],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/users/);
  });

  it("fails when a migration-added table is missing", () => {
    const result = evaluateRestoreVerification({
      tableNames: REQUIRED_TABLES,
      counts,
      expectedCounts: counts,
      migrationTables: ["push_subscriptions", "missing_migration_table"],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/missing_migration_table/);
  });
});
