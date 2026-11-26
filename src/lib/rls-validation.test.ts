import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Client } from "pg";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const MIGRATION_PATH = "supabase/migrations/0005_rls_hardening.sql";
const TABLES = [
  "users",
  "company_career_pages",
  "worker_status",
  "app_meta",
  "company_reviews",
] as const;
type Table = (typeof TABLES)[number];

// ---------------------------------------------------------------------------
// Safety: only a loopback, explicitly opted-in database may be touched. This
// unit is tested below, and is the single gate in front of every live query.
// ---------------------------------------------------------------------------
function assertLocalDisposableUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("RLS_TEST_DATABASE_URL must be a PostgreSQL URL");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("RLS_TEST_DATABASE_URL must be a PostgreSQL URL");
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(host)) {
    throw new Error("RLS_TEST_DATABASE_URL must target a local loopback disposable database");
  }
  if (!/^\/?[A-Za-z0-9_-]+$/.test(parsed.pathname)) {
    throw new Error("RLS_TEST_DATABASE_URL has an invalid database name");
  }
  return parsed;
}

describe("disposable-target guard", () => {
  it("accepts an explicitly local disposable URL", () => {
    const parsed = assertLocalDisposableUrl("postgres://postgres@127.0.0.1:55432/jobpilot_e2e?sslmode=disable");
    expect(parsed.hostname).toBe("127.0.0.1");
  });

  it("rejects a production-looking URL before any connection is made", () => {
    expect(() => assertLocalDisposableUrl("postgres://user:pw@db.production.example.com:5432/app"))
      .toThrow(/loopback disposable database/);
  });

  it("rejects non-PostgreSQL schemes", () => {
    expect(() => assertLocalDisposableUrl("https://127.0.0.1/db"))
      .toThrow(/PostgreSQL URL/);
  });
});

// ---------------------------------------------------------------------------
// Static guarantees: cheap, offline assertions about the migration source.
// ---------------------------------------------------------------------------
describe("0005_rls_hardening.sql — static guarantees", () => {
  const sql = read(MIGRATION_PATH);

  it("enables row level security on all five protected tables", () => {
    for (const table of TABLES) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("revokes ALL from both public roles on all five protected tables", () => {
    for (const table of TABLES) {
      expect(sql).toMatch(
        new RegExp(`revoke\\s+all\\s+on\\s+public\\.${table}\\s+from\\s+anon,\\s+authenticated`, "i"),
      );
    }
  });

  it("creates no permissive policies and does not FORCE RLS", () => {
    expect(sql).not.toMatch(/create\s+policy/i);
    expect(sql).not.toMatch(/force\s+row\s+level\s+security/i);
  });

  it("never grants access back to the public roles", () => {
    expect(sql).not.toMatch(/\bgrant\b/i);
  });
});

// ---------------------------------------------------------------------------
// Live probe. Opt-in only: RLS_TEST_DATABASE_URL must point at a loopback DB.
// All work runs in a single transaction that is always ROLLED BACK, so the
// disposable database is left exactly as it was found.
// ---------------------------------------------------------------------------
interface ProbeResult {
  preconditionAnonCouldRead: boolean;
  rlsEnabled: Record<Table, boolean>;
  publicDenials: Array<{
    role: string;
    table: Table;
    selectBlocked: boolean;
    insertBlocked: boolean;
    updateBlocked: boolean;
  }>;
  privileged: Array<{
    role: string;
    table: Table;
    readVisible: boolean;
    insertOk: boolean;
    updateOk: boolean;
  }>;
  rlsDefaultDeny: Array<{ table: Table; visible: boolean }>;
  migrationApplied: boolean;
}

const liveUrl = process.env.RLS_TEST_DATABASE_URL;
const describeLive = liveUrl ? describe : describe.skip;

describeLive("0005_rls_hardening.sql — enforced on a disposable database", () => {
  let probe: ProbeResult;

  beforeAll(async () => {
    probe = await runDisposableProbe(liveUrl as string);
  });

  afterAll(async () => {
    await disposeProbe();
  });

  it("proves the pre-0005 state was actually readable by anon (meaningful baseline)", () => {
    expect(probe.migrationApplied).toBe(true);
    expect(probe.preconditionAnonCouldRead).toBe(true);
  });

  it("has RLS enabled on every protected table after 0005", () => {
    expect(probe.rlsEnabled).toEqual({
      users: true,
      company_career_pages: true,
      worker_status: true,
      app_meta: true,
      company_reviews: true,
    });
  });

  it("denies SELECT, INSERT and UPDATE to anon/authenticated on every protected table", () => {
    expect(probe.publicDenials).toHaveLength(10);
    for (const denial of probe.publicDenials) {
      expect(denial.selectBlocked, `${denial.role} SELECT on ${denial.table}`).toBe(true);
      expect(denial.insertBlocked, `${denial.role} INSERT on ${denial.table}`).toBe(true);
      expect(denial.updateBlocked, `${denial.role} UPDATE on ${denial.table}`).toBe(true);
    }
  });

  it("preserves privileged reads and writes for server/service-role connections", () => {
    expect(probe.privileged).toHaveLength(10);
    for (const allowed of probe.privileged) {
      expect(allowed.readVisible, `${allowed.role} SELECT on ${allowed.table}`).toBe(true);
      expect(allowed.insertOk, `${allowed.role} INSERT on ${allowed.table}`).toBe(true);
      expect(allowed.updateOk, `${allowed.role} UPDATE on ${allowed.table}`).toBe(true);
    }
  });

  it("keeps RLS default-deny even if SELECT is re-granted to anon", () => {
    expect(probe.rlsDefaultDeny).toHaveLength(5);
    for (const row of probe.rlsDefaultDeny) {
      expect(row.visible, `anon still sees rows in ${row.table}`).toBe(false);
    }
  });
});

interface Statement {
  sql: string;
  params: any[];
}

type ProbeStatements = Record<Table, { select: Statement; insert: Statement; update: Statement }>;

function seedStatements(token: string): Statement[] {
  const ts = new Date().toISOString();
  return [
    {
      sql: "insert into public.companies (id,name,slug,source,verified,created_at,updated_at) values ($1,$2,$3,'curated',0,now(),now()) on conflict (id) do nothing",
      params: [`rls_probe_company_${token}`, "RLS Probe Co", `rls-probe-company-${token}`],
    },
    {
      sql: "insert into public.users (id,email,password_hash,name,created_at,updated_at) values ($1,$2,$3,$4,now(),now()) on conflict (id) do nothing",
      params: [`rls_probe_user_${token}`, `rls-probe-${token}@example.invalid`, "probe-only", "RLS Probe"],
    },
    {
      sql: "insert into public.users (id,email,password_hash,name,created_at,updated_at) values ($1,$2,$3,$4,now(),now()) on conflict (id) do nothing",
      params: [`rls_probe_insuser_${token}`, `rls-probe-insuser-${token}@example.invalid`, "probe-only", "RLS Probe Insert"],
    },
    {
      sql: "insert into public.company_career_pages (id,company_id,url,status) values ($1,$2,$3,'unchecked') on conflict (id) do nothing",
      params: [`rls_probe_page_${token}`, `rls_probe_company_${token}`, `https://example.invalid/${token}/careers`],
    },
    {
      sql: "insert into public.worker_status (id,name,status,meta) values ($1,$2,'offline','{}'::jsonb) on conflict (id) do nothing",
      params: [`rls_probe_worker_${token}`, "RLS Probe Worker"],
    },
    {
      sql: "insert into public.app_meta (key,value) values ($1,$2) on conflict (key) do nothing",
      params: [`rls_probe_key_${token}`, "probe-only"],
    },
    {
      sql: "insert into public.company_reviews (id,company_id,user_id,rating,would_recommend,created_at,updated_at) values ($1,$2,$3,5,0,$4,$5) on conflict (id) do nothing",
      params: [
        `rls_probe_review_${token}`,
        `rls_probe_company_${token}`,
        `rls_probe_user_${token}`,
        ts,
        ts,
      ],
    },
  ];
}

function statementsFor(token: string): ProbeStatements {
  const rowId = (name: string) => `rls_probe_${name}_${token}`;
  const count = (table: string, key: string, name: string): Statement => ({
    sql: `select count(*)::int as n from public.${table} where ${key} = $1`,
    params: [rowId(name)],
  });
  return {
    users: {
      select: count("users", "id", "user"),
      insert: {
        sql: "insert into public.users (id,email,password_hash,name,created_at,updated_at) values ($1,$2,$3,$4,now(),now())",
        params: [rowId("ins_users"), `rls-probe-ins-${token}@example.invalid`, "probe-only", "probe"],
      },
      update: {
        sql: "update public.users set name='tampered' where id=$1",
        params: [rowId("user")],
      },
    },
    company_career_pages: {
      select: count("company_career_pages", "id", "page"),
      insert: {
        sql: "insert into public.company_career_pages (id,company_id,url,status) values ($1,$2,$3,'unchecked')",
        params: [rowId("ins_pages"), rowId("company"), `https://example.invalid/${token}/insert-careers`],
      },
      update: {
        sql: "update public.company_career_pages set status='tampered' where id=$1",
        params: [rowId("page")],
      },
    },
    worker_status: {
      select: count("worker_status", "id", "worker"),
      insert: {
        sql: "insert into public.worker_status (id,name,status,meta) values ($1,$2,'offline','{}'::jsonb)",
        params: [rowId("ins_worker"), "probe"],
      },
      update: {
        sql: "update public.worker_status set status='tampered' where id=$1",
        params: [rowId("worker")],
      },
    },
    app_meta: {
      select: {
        sql: "select count(*)::int as n from public.app_meta where key = $1",
        params: [rowId("key")],
      },
      insert: {
        sql: "insert into public.app_meta (key,value) values ($1,$2)",
        params: [rowId("ins_key"), "probe"],
      },
      update: {
        sql: "update public.app_meta set value='tampered' where key=$1",
        params: [rowId("key")],
      },
    },
    company_reviews: {
      select: count("company_reviews", "id", "review"),
      insert: {
        sql: "insert into public.company_reviews (id,company_id,user_id,rating,would_recommend,created_at,updated_at) values ($1,$2,$3,5,0,$4,$4)",
        params: [rowId("ins_review"), rowId("company"), rowId("insuser"), new Date().toISOString()],
      },
      update: {
        sql: "update public.company_reviews set comment='tampered' where id=$1",
        params: [rowId("review")],
      },
    },
  };
}

let probeClient: Client | null = null;

async function runDisposableProbe(rawUrl: string): Promise<ProbeResult> {
  const parsed = assertLocalDisposableUrl(rawUrl);
  const token = randomBytes(6).toString("hex");
  const rowId = (name: string) => `rls_probe_${name}_${token}`;

  const client = new Client({ connectionString: parsed.toString() });
  probeClient = client;
  await client.connect();

  const rlsEnabled = {} as Record<Table, boolean>;
  const publicDenials: ProbeResult["publicDenials"] = [];
  const privileged: ProbeResult["privileged"] = [];
  const rlsDefaultDeny: ProbeResult["rlsDefaultDeny"] = [];

  // Run `fn` under a role inside a savepoint, then undo the role change and any
  // writes it made. An expected permission error aborts the savepoint only.
  async function underRole<T>(
    role: string | null,
    fn: () => Promise<T>,
  ): Promise<{ ok: boolean; value?: T }> {
    await client.query("SAVEPOINT rls_probe_attempt");
    try {
      if (role) await client.query(`SET LOCAL ROLE ${role}`);
      return { ok: true, value: await fn() };
    } catch {
      return { ok: false };
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT rls_probe_attempt");
      await client.query("RELEASE SAVEPOINT rls_probe_attempt");
    }
  }

  let begun = false;
  try {
    await client.query("BEGIN");
    begun = true;

    // Supabase-like roles. Created inside the transaction; rolled back below.
    const existing: string[] = (
      await client.query("select rolname from pg_roles where rolname in ('anon','authenticated','service_role')")
    ).rows.map((row: { rolname: string }) => row.rolname);
    for (const role of ["anon", "authenticated"]) {
      if (!existing.includes(role)) await client.query(`CREATE ROLE ${role} NOLOGIN`);
    }
    if (!existing.includes("service_role")) {
      await client.query("CREATE ROLE service_role NOLOGIN BYPASSRLS");
    } else {
      await client.query("ALTER ROLE service_role BYPASSRLS");
    }

    // Reproduce the pre-0005 posture: broad direct grants to the public roles.
    for (const table of TABLES) {
      await client.query(`GRANT ALL ON public.${table} TO anon, authenticated`);
      await client.query(`GRANT ALL ON public.${table} TO service_role`);
    }

    for (const stmt of seedStatements(token)) await client.query(stmt.sql, stmt.params);

    const before = await underRole("anon", () =>
      client.query("select count(*)::int as n from public.users where id = $1", [rowId("user")]),
    );
    const preconditionAnonCouldRead =
      before.ok && Number(before.value?.rows?.[0]?.n ?? 0) === 1;

    // Apply 0005 exactly as authored, in the disposable transaction.
    await client.query(read(MIGRATION_PATH));

    for (const table of TABLES) {
      const state = await client.query(
        "select relrowsecurity from pg_class where oid = to_regclass($1)",
        [`public.${table}`],
      );
      rlsEnabled[table] = Boolean(state.rows[0]?.relrowsecurity);
    }

    const statements = statementsFor(token);

    for (const role of ["anon", "authenticated"]) {
      for (const table of TABLES) {
        const stmt = statements[table];
        const select = await underRole(role, () => client.query(stmt.select.sql, stmt.select.params));
        const insert = await underRole(role, () => client.query(stmt.insert.sql, stmt.insert.params));
        const update = await underRole(role, () => client.query(stmt.update.sql, stmt.update.params));
        publicDenials.push({
          role,
          table,
          selectBlocked: !select.ok || Number(select.value?.rows?.[0]?.n ?? 0) === 0,
          insertBlocked: !insert.ok,
          updateBlocked: !update.ok,
        });
      }
    }

    // "postgres" models the direct DATABASE_URL owner/superuser connection the
    // app actually uses; service_role models a Supabase service-key connection.
    for (const role of ["postgres", "service_role"]) {
      for (const table of TABLES) {
        const stmt = statements[table];
        const asRole = role === "postgres" ? null : role;
        const select = await underRole(asRole, () => client.query(stmt.select.sql, stmt.select.params));
        const insert = await underRole(asRole, () => client.query(stmt.insert.sql, stmt.insert.params));
        const update = await underRole(asRole, () => client.query(stmt.update.sql, stmt.update.params));
        privileged.push({
          role,
          table,
          readVisible: select.ok && Number(select.value?.rows?.[0]?.n ?? 0) === 1,
          insertOk: insert.ok,
          updateOk: update.ok,
        });
      }
    }

    // Defense in depth: with SELECT re-granted, RLS itself must still hide rows.
    for (const table of TABLES) {
      await client.query(`GRANT SELECT ON public.${table} TO anon`);
      const stmt = statements[table];
      const select = await underRole("anon", () => client.query(stmt.select.sql, stmt.select.params));
      rlsDefaultDeny.push({
        table,
        visible: select.ok && Number(select.value?.rows?.[0]?.n ?? 0) > 0,
      });
    }

    return {
      preconditionAnonCouldRead,
      rlsEnabled,
      publicDenials,
      privileged,
      rlsDefaultDeny,
      migrationApplied: true,
    };
  } finally {
    try {
      // Nothing is committed: roles, grants, RLS flags and sentinel rows all go.
      if (begun) await client.query("ROLLBACK");
    } finally {
      await client.end();
      probeClient = null;
    }
  }
}

async function disposeProbe(): Promise<void> {
  if (probeClient) {
    await probeClient.end();
    probeClient = null;
  }
}
