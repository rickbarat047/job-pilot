import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("push_subscriptions RLS migration (0004)", () => {
  const raw = readFileSync(resolve(process.cwd(), "supabase/migrations/0004_push_subscriptions_rls.sql"), "utf8");
  // Strip SQL line comments so documentation mentions do not trip the checks.
  const sql = raw.replace(/--[^\n]*/g, "");

  it("enables RLS on push_subscriptions", () => {
    expect(sql).toMatch(/alter table public\.push_subscriptions enable row level security/i);
  });

  it("does not use auth.uid()", () => {
    expect(sql).not.toMatch(/auth\.uid\(\)/i);
  });

  it("does not enable FORCE ROW LEVEL SECURITY", () => {
    expect(sql).not.toMatch(/force row level security/i);
  });

  it("does not drop or recreate the table", () => {
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/create table/i);
  });

  it("revokes direct access from anon and authenticated", () => {
    expect(sql).toMatch(/revoke all on public\.push_subscriptions from anon/i);
    expect(sql).toMatch(/revoke all on public\.push_subscriptions from authenticated/i);
  });

  it("creates no permissive policy", () => {
    expect(sql).not.toMatch(/create policy/i);
  });
});

// Runtime permission tests require a PostgreSQL instance with role setup.
// They are UNVERIFIED in this environment (no PG available).
describe("push_subscriptions RLS runtime (UNVERIFIED)", () => {
  it.skip("anon role cannot SELECT push_subscriptions (requires PostgreSQL)", () => {});
  it.skip("authenticated role cannot SELECT push_subscriptions (requires PostgreSQL)", () => {});
  it.skip("application role retains SELECT/INSERT/UPDATE/DELETE (requires PostgreSQL)", () => {});
});
describe("push_subscriptions application-level isolation (verified by code review)", () => {
  it("subscribe route filters by user_id", () => {
    const code = readFileSync(resolve(process.cwd(), "src/app/api/push/subscribe/route.ts"), "utf8");
    expect(code).toMatch(/WHERE user_id = \?/);
    expect(code).toMatch(/requireApiUser/);
  });
});
