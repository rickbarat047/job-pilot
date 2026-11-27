import { describe, it, expect, afterEach } from "vitest";
import { assertStagingConfig } from "./staging-guard";

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
});
