/**
 * Fail-closed guard for the isolated local staging environment.
 *
 * The staging worker and application must never fall back to production
 * credentials. All checks are based on environment variable NAMES and values
 * supplied by the caller; this module never reads or prints secrets.
 */
export type StagingEnv = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function isLocalAppUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      LOCAL_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function isLocalPostgresUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
    LOCAL_HOSTS.has(url.hostname.toLowerCase())
  );
}

/**
 * Assert that the supplied environment is safe for isolated local staging.
 * Throws a descriptive error when any production-looking value is present.
 */
export function assertStagingConfig(env: StagingEnv): void {
  const appUrl = env.APP_URL || "";
  if (!isLocalAppUrl(appUrl)) {
    throw new Error("APP_URL must be a local localhost staging URL, not a deployed application.");
  }

  const databaseUrl = env.DATABASE_URL || "";
  if (!isLocalPostgresUrl(databaseUrl)) {
    throw new Error("DATABASE_URL must use a local PostgreSQL host for isolated staging.");
  }

  if (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Supabase credentials are not permitted in local staging.");
  }

  const token = env.WORKER_TOKEN || "";
  if (!token) {
    throw new Error("WORKER_TOKEN is required for local staging.");
  }
  if (/prod|production/i.test(token)) {
    throw new Error("WORKER_TOKEN must be a staging-only token; production token detected.");
  }

  if (env.E2E_ALLOW_FIXTURE !== "1") {
    throw new Error("E2E_ALLOW_FIXTURE=1 is required so staging uses fixture sources only.");
  }
}
