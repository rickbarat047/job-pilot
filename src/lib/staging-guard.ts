/**
 * Fail-closed guard for the isolated local staging environment.
 *
 * The staging worker and application must never fall back to production
 * credentials. All checks are based on environment variable NAMES and values
 * supplied by the caller; this module never reads or prints secrets. Error
 * messages intentionally include only variable names and a category keyword,
 * never a credential value.
 */
export type StagingEnv = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/** Hosts owned by deployment/database providers; staging must never use them. */
const CLOUD_HOSTS =
  /(?:^|\.)(?:vercel\.app|supabase\.co|railway\.app|fly\.dev|render\.com|onrender\.com|netlify\.app|pages\.dev|workers\.dev|herokuapp\.com|upstash\.io|azurewebsites\.net|amazonaws\.com|cloudfront\.net)$/i;

/** Staging-owned config keys are never mistaken for external credentials. */
const STAGING_CONFIG_KEYS = [
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
] as const;

/** Keys needed to launch a Node child process on Windows/POSIX. */
const SYSTEM_ENV_KEYS = [
  "PATH",
  "Path",
  "SystemRoot",
  "windir",
  "TEMP",
  "TMP",
  "temp",
  "tmp",
  "HOME",
  "USERPROFILE",
  "COMSPEC",
  "ComSpec",
  "HOMEDRIVE",
  "HOMEPATH",
  "PATHEXT",
  "SystemDrive",
  "APPDATA",
  "LOCALAPPDATA",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS",
] as const;

type RestrictedCategory = "Supabase" | "email" | "push" | "storage" | "external";

const EMAIL_SERVICE = /(?:^|_)(?:RESEND|SENDGRID|MAILGUN|POSTMARK|SMTP)(?:_|$)/i;
const PUSH_SERVICE = /(?:^|_)(?:VAPID|UPSTASH)(?:_|$)/i;
const STORAGE_SERVICE = /^(?:AWS|GCP|GOOGLE_CLOUD|GOOGLE_APPLICATION|CLOUDINARY|CLOUDFLARE|AZURE)_/i;
const EXTERNAL_SERVICE_KEYS = new Set([
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "CRON_SECRET",
  "NEXT_PUBLIC_CRON_SECRET",
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
  "PLAUSIBLE_DOMAIN",
  "NEXT_PUBLIC_GA_MEASUREMENT_ID",
  "GOOGLE_ANALYTICS_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_API_KEY",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_KEY_ID",
  "TWILIO_AUTH_TOKEN",
  "SLACK_WEBHOOK_URL",
]);
const GENERIC_CREDENTIAL =
  /(?:^|_)(?:API_KEY|KEY|API_SECRET|SECRET|PASSWORD|PASS|TOKEN|DSN|CREDENTIALS|CONNECTION_STRING)(?:_|$)/i;
const GENERIC_SERVICE_URL =
  /(?:^|_)(?:SERVICE_URL|API_URL|WEBHOOK_URL|ENDPOINT_URL|PROXY_URL|BASE_URL)(?:_|$)/i;
const PRODUCTION_NAMED = /(?:^|_)(?:PROD|PRODUCTION)(?:_|$)/i;

const BLOCKED_WORKER_TOKENS = new Set([
  "changeme",
  "change-me",
  "change_me",
  "placeholder",
  "your-worker-token",
  "your-token-here",
  "your_token_here",
  "replace-me",
  "replace_me",
  "default",
  "example",
  "sample",
  "sample-token",
  "dummy",
  "dummy-token",
  "todo",
]);

function normalizedHost(hostname: string): string {
  // WHATWG URL keeps IPv6 brackets in `hostname` (e.g. "[::1]").
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function isLocalUrl(value: string, protocols: string[]): boolean {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && LOCAL_HOSTS.has(normalizedHost(url.hostname));
  } catch {
    return false;
  }
}

function isLocalAppUrl(value: string): boolean {
  return isLocalUrl(value, ["http:", "https:"]);
}

function isLocalPostgresUrl(value: string): boolean {
  return isLocalUrl(value, ["postgres:", "postgresql:"]);
}

function isCloudUrl(value: string): boolean {
  try {
    return CLOUD_HOSTS.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function urlRejection(label: string, value: string): Error {
  return isCloudUrl(value)
    ? new Error(
        `${label} must be a local staging URL; remote cloud hosts (Vercel, Supabase, Railway, Fly, Render) are not permitted.`,
      )
    : new Error(`${label} must be a local staging URL (localhost, 127.0.0.1 or ::1); remote hosts are not permitted.`);
}

/**
 * Classify a variable NAME (never its value) into a restricted category.
 * Any SUPABASE_* variable is rejected, including unlisted ones.
 */
function restrictedCredentialCategory(key: string): RestrictedCategory | null {
  const name = key.toUpperCase();
  if (name.includes("SUPABASE")) return "Supabase";
  if (EMAIL_SERVICE.test(name)) return "email";
  if (PUSH_SERVICE.test(name)) return "push";
  if (STORAGE_SERVICE.test(name)) return "storage";
  if (EXTERNAL_SERVICE_KEYS.has(name)) return "external";
  if ((STAGING_CONFIG_KEYS as readonly string[]).includes(name)) return null;
  if (GENERIC_CREDENTIAL.test(name) || GENERIC_SERVICE_URL.test(name) || PRODUCTION_NAMED.test(name)) {
    return "external";
  }
  return null;
}

function assertNoRestrictedCredentials(env: StagingEnv): void {
  for (const key of Object.keys(env)) {
    if (!env[key]) continue;
    const category = restrictedCredentialCategory(key);
    if (!category) continue;
    throw new Error(`${category} credentials are not permitted in local staging; restricted variable: ${key}.`);
  }
}

function isLocalFixturePath(value: string): boolean {
  const candidate = value.trim();
  if (!candidate) return false;
  // Protocol-relative URLs and UNC shares are remote sources.
  if (candidate.startsWith("//") || candidate.startsWith("\\\\")) return false;
  // Any URI scheme is remote; Windows drive letters (C:\ or C:/) are local paths.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate) && !/^[a-zA-Z]:[\\/]/.test(candidate)) return false;
  return true;
}

/**
 * Assert that the supplied environment is safe for isolated local staging.
 * Throws a descriptive error when any production-looking value is present.
 */
export function assertStagingConfig(env: StagingEnv): void {
  const appUrl = env.APP_URL || "";
  if (!isLocalAppUrl(appUrl)) {
    throw urlRejection("APP_URL", appUrl);
  }

  const databaseUrl = env.DATABASE_URL || "";
  if (!isLocalPostgresUrl(databaseUrl)) {
    throw urlRejection("DATABASE_URL", databaseUrl);
  }

  assertNoRestrictedCredentials(env);

  const token = (env.WORKER_TOKEN || "").trim();
  if (!token) {
    throw new Error("WORKER_TOKEN is required for local staging (staging-only token).");
  }
  if (/prod|production/i.test(token)) {
    throw new Error("WORKER_TOKEN must be a staging-only token; production token detected.");
  }
  if (BLOCKED_WORKER_TOKENS.has(token.toLowerCase())) {
    throw new Error("WORKER_TOKEN must be a staging-only token; placeholder token detected.");
  }

  if (env.E2E_ALLOW_FIXTURE !== "1") {
    throw new Error("E2E_ALLOW_FIXTURE=1 is required so staging uses fixture sources only.");
  }
  const fixturePath = env.E2E_FIXTURE_JOBS || "";
  if (!isLocalFixturePath(fixturePath)) {
    throw new Error("E2E_FIXTURE_JOBS must be a local fixture path (no remote URL) so staging uses fixtures only.");
  }
}

/**
 * Build a minimal environment for child processes spawned by staging.
 *
 * Only the required local config keys and PATH/system essentials are copied;
 * production credentials are stripped by construction. This function filters
 * rather than validates so callers can sanitise an inherited `process.env`.
 * AI_BASE_URL is included only when it points at a local stub.
 */
export function restrictedStagingEnv(env: StagingEnv): StagingEnv {
  const child: StagingEnv = {};
  for (const key of STAGING_CONFIG_KEYS) {
    const value = env[key];
    if (value === undefined) continue;
    if (key === "AI_BASE_URL" && !isLocalAppUrl(value)) continue;
    child[key] = value;
  }
  child.NODE_ENV = "development";
  for (const key of SYSTEM_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined) child[key] = value;
  }
  return child;
}
