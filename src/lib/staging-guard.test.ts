import { describe, it, expect, afterEach } from "vitest";
import { assertStagingConfig, restrictedStagingEnv } from "./staging-guard";

const original = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
});

function stagingEnv(extra: Record<string, string> = {}) {
  return {
    APP_URL: "http://127.0.0.1:3000",
    DATABASE_URL: "postgres://postgres@127.0.0.1:55432/jobpilot_staging?sslmode=disable",
    WORKER_TOKEN: "staging-only-worker-token",
    E2E_ALLOW_FIXTURE: "1",
    E2E_FIXTURE_JOBS: "./scripts/e2e/fixtures.json",
    NODE_ENV: "development",
    ...extra,
  };
}

const SUPABASE_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_KEY",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_DB_URL",
];

const EMAIL_KEYS = [
  "RESEND_API_KEY",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "SENDGRID_API_KEY",
  "MAILGUN_API_KEY",
];

const PUSH_KEYS = [
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_KV_REST_API_URL",
  "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
];

const STORAGE_KEYS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "GCP_PROJECT_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "CLOUDINARY_URL",
  "CLOUDFLARE_API_TOKEN",
];

const EXTERNAL_KEYS = [
  "SENTRY_DSN",
  "CRON_SECRET",
  "STRIPE_SECRET_KEY",
  "SOME_SERVICE_API_KEY",
  "PROD_DATABASE_URL",
];

const REMOTE_APP_URLS = [
  "https://jobpilot-ai-sand.vercel.app",
  "https://app.supabase.co",
  "https://svc.railway.app",
  "https://worker.fly.dev",
  "https://web.onrender.com",
  "http://192.168.1.50:3000",
  "https://localhost.evil.example",
  "not-a-url",
];

const REMOTE_DATABASE_URLS = [
  "postgres://user:pass@db.example.com/prod",
  "postgresql://postgres@db.supabase.co:5432/postgres",
  "postgres://user@srv.railway.app:5432/railway",
  "postgres://user@host.fly.dev:5432/db",
  "postgres://user@db.render.com:5432/db",
  "mysql://user@127.0.0.1:3306/db",
  "",
];

const BAD_WORKER_TOKENS = [
  "",
  "   ",
  "PROD-worker-token",
  "my-production-worker-token",
  "changeme",
  "your-worker-token",
  "placeholder",
];

const REMOTE_FIXTURE_PATHS = [
  "https://example.com/fixtures.json",
  "http://127.0.0.1:4599/fixtures.json",
  "ftp://host.example/fixtures.json",
  "//server/share/fixtures.json",
  "\\\\server\\share\\fixtures.json",
  "",
];

describe("assertStagingConfig", () => {
  it("accepts an isolated localhost staging configuration", () => {
    expect(() => assertStagingConfig(stagingEnv())).not.toThrow();
  });

  it("rejects a non-local APP_URL", () => {
    expect(() => assertStagingConfig(stagingEnv({ APP_URL: "https://jobpilot-ai-sand.vercel.app" }))).toThrow(/localhost|local/i);
  });

  it("rejects a production-looking DATABASE_URL", () => {
    expect(() => assertStagingConfig(stagingEnv({ DATABASE_URL: "postgres://user:pass@db.example.com/prod" }))).toThrow(/local/i);
  });

  it("rejects Supabase production credentials", () => {
    expect(() => assertStagingConfig(stagingEnv({ SUPABASE_URL: "https://example.supabase.co" }))).toThrow(/Supabase/i);
  });

  it("rejects reuse of the production worker token name", () => {
    expect(() => assertStagingConfig(stagingEnv({ WORKER_TOKEN: "production-worker-token" }))).toThrow(/token/i);
  });

  it("requires the fixture opt-in", () => {
    expect(() => assertStagingConfig(stagingEnv({ E2E_ALLOW_FIXTURE: "0" }))).toThrow(/fixture/i);
  });

  it.each(SUPABASE_KEYS)("rejects Supabase credential variable %s", (key) => {
    expect(() => assertStagingConfig(stagingEnv({ [key]: "staging-must-not-have-this" }))).toThrow(/supabase/i);
  });

  it("rejects unlisted SUPABASE_* credential-like variables", () => {
    expect(() => assertStagingConfig(stagingEnv({ SUPABASE_CUSTOM_SERVICE_KEY: "staging-must-not-have-this" }))).toThrow(/supabase/i);
    expect(() => assertStagingConfig(stagingEnv({ supabase_db_password: "staging-must-not-have-this" }))).toThrow(/supabase/i);
  });

  it.each(EMAIL_KEYS)("rejects email-service credential %s", (key) => {
    expect(() => assertStagingConfig(stagingEnv({ [key]: "staging-must-not-have-this" }))).toThrow(/email/i);
  });

  it.each(PUSH_KEYS)("rejects push/cache-service credential %s", (key) => {
    expect(() => assertStagingConfig(stagingEnv({ [key]: "staging-must-not-have-this" }))).toThrow(/push/i);
  });

  it.each(STORAGE_KEYS)("rejects storage/cloud credential %s", (key) => {
    expect(() => assertStagingConfig(stagingEnv({ [key]: "staging-must-not-have-this" }))).toThrow(/storage/i);
  });

  it.each(EXTERNAL_KEYS)("rejects external production-service credential %s", (key) => {
    expect(() => assertStagingConfig(stagingEnv({ [key]: "staging-must-not-have-this" }))).toThrow(/external/i);
  });

  it("does not leak credential values in errors", () => {
    const sentinel = "SENTINEL_SHOULD_NEVER_BE_PRINTED";
    for (const key of [...SUPABASE_KEYS, ...EMAIL_KEYS, ...STORAGE_KEYS, ...EXTERNAL_KEYS]) {
      let message = "";
      try {
        assertStagingConfig(stagingEnv({ [key]: sentinel }));
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).not.toContain(sentinel);
    }
  });

  it.each(REMOTE_APP_URLS)("rejects remote or production-looking APP_URL %s", (url) => {
    expect(() => assertStagingConfig(stagingEnv({ APP_URL: url }))).toThrow(/local/i);
  });

  it.each(REMOTE_DATABASE_URLS)("rejects remote or non-local DATABASE_URL %s", (url) => {
    expect(() => assertStagingConfig(stagingEnv({ DATABASE_URL: url }))).toThrow(/local/i);
  });

  it("accepts IPv6 localhost and local postgresql URLs", () => {
    expect(() => assertStagingConfig(stagingEnv({
      APP_URL: "http://[::1]:3000",
      DATABASE_URL: "postgresql://postgres@localhost:5432/jobpilot_staging",
    }))).not.toThrow();
  });

  it("rejects a missing worker token", () => {
    const env = stagingEnv() as Record<string, string | undefined>;
    delete env.WORKER_TOKEN;
    expect(() => assertStagingConfig(env)).toThrow(/token/i);
  });

  it.each(BAD_WORKER_TOKENS)("rejects unsafe worker token %j", (token) => {
    expect(() => assertStagingConfig(stagingEnv({ WORKER_TOKEN: token }))).toThrow(/token/i);
  });

  it("rejects a missing fixture path", () => {
    const env = stagingEnv() as Record<string, string | undefined>;
    delete env.E2E_FIXTURE_JOBS;
    expect(() => assertStagingConfig(env)).toThrow(/fixture/i);
  });

  it.each(REMOTE_FIXTURE_PATHS)("rejects non-local fixture source %j", (path) => {
    expect(() => assertStagingConfig(stagingEnv({ E2E_FIXTURE_JOBS: path }))).toThrow(/fixture/i);
  });

  it("accepts an absolute local fixture path", () => {
    expect(() => assertStagingConfig(stagingEnv({ E2E_FIXTURE_JOBS: "C:\\temp\\fixtures.json" }))).not.toThrow();
  });
});

describe("restrictedStagingEnv", () => {
  const ALLOWED_KEYS = [
    "APP_URL",
    "DATABASE_URL",
    "WORKER_TOKEN",
    "NODE_ENV",
    "E2E_ALLOW_FIXTURE",
    "E2E_FIXTURE_JOBS",
    "AI_BASE_URL",
    "AI_API_KEY",
    "HEADLESS",
    "POLL_INTERVAL_MS",
    "HEARTBEAT_INTERVAL_MS",
    "MAX_TASKS",
    "WORKER_ONLINE_WINDOW_MS",
    "STORAGE_DIR",
    "PORT",
  ];
  const SYSTEM_KEYS = [
    "PATH", "Path", "SystemRoot", "windir", "TEMP", "TMP", "temp", "tmp",
    "HOME", "USERPROFILE", "COMSPEC", "ComSpec", "HOMEDRIVE", "HOMEPATH",
    "PATHEXT", "SystemDrive", "APPDATA", "LOCALAPPDATA",
  ];

  it("keeps only allowlisted config keys and system essentials", () => {
    const result = restrictedStagingEnv({
      ...stagingEnv(),
      AI_BASE_URL: "http://127.0.0.1:4599/v1",
      AI_API_KEY: "staging-only-ai-key",
      HEADLESS: "true",
      POLL_INTERVAL_MS: "500",
      HEARTBEAT_INTERVAL_MS: "1000",
      MAX_TASKS: "1",
      WORKER_ONLINE_WINDOW_MS: "3000",
      STORAGE_DIR: "C:\\staging-storage",
      PORT: "3000",
      PATH: "C:\\bin",
      SystemRoot: "C:\\Windows",
      TEMP: "C:\\Temp",
      USERPROFILE: "C:\\Users\\staging",
      COMSPEC: "C:\\Windows\\System32\\cmd.exe",
    });
    expect(Object.keys(result).sort()).toEqual(
      [...ALLOWED_KEYS, "PATH", "SystemRoot", "TEMP", "USERPROFILE", "COMSPEC"].sort(),
    );
    expect(result.APP_URL).toBe("http://127.0.0.1:3000");
    expect(result.WORKER_TOKEN).toBe("staging-only-worker-token");
    expect(result.AI_BASE_URL).toBe("http://127.0.0.1:4599/v1");
    expect(result.AI_API_KEY).toBe("staging-only-ai-key");
  });

  it("forces NODE_ENV to development", () => {
    const result = restrictedStagingEnv({ ...stagingEnv(), NODE_ENV: "production" });
    expect(result.NODE_ENV).toBe("development");
    expect(SYSTEM_KEYS).toContain("Path");
  });

  it("strips Supabase, email, push, storage and external credentials", () => {
    const polluted: Record<string, string> = {
      ...stagingEnv(),
      SUPABASE_SERVICE_ROLE_KEY: "never-copy",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "never-copy",
      RESEND_API_KEY: "never-copy",
      SMTP_PASS: "never-copy",
      VAPID_PRIVATE_KEY: "never-copy",
      UPSTASH_REDIS_REST_TOKEN: "never-copy",
      AWS_SECRET_ACCESS_KEY: "never-copy",
      CLOUDFLARE_API_TOKEN: "never-copy",
      CRON_SECRET: "never-copy",
      SENTRY_DSN: "never-copy",
      PATH: "C:\\bin",
    };
    const result = restrictedStagingEnv(polluted);
    for (const key of Object.keys(polluted)) {
      if (![...ALLOWED_KEYS, "PATH"].includes(key)) {
        expect(result).not.toHaveProperty(key);
      }
    }
    expect(result.PATH).toBe("C:\\bin");
  });

  it("omits a remote AI_BASE_URL so no external AI endpoint is inherited", () => {
    const result = restrictedStagingEnv({ ...stagingEnv(), AI_BASE_URL: "https://api.deepseek.com/v1" });
    expect(result).not.toHaveProperty("AI_BASE_URL");
    const local = restrictedStagingEnv({ ...stagingEnv(), AI_BASE_URL: "http://localhost:4599/v1" });
    expect(local.AI_BASE_URL).toBe("http://localhost:4599/v1");
  });

  it("does not copy arbitrary unknown variables", () => {
    const result = restrictedStagingEnv({ ...stagingEnv(), RANDOM_CUSTOM_VAR: "value" });
    expect(result).not.toHaveProperty("RANDOM_CUSTOM_VAR");
    expect(() => assertStagingConfig(result as Record<string, string | undefined>)).not.toThrow();
  });
});
