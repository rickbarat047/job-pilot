import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Supabase RLS hardening migration", () => {
  it("enables default-deny RLS on previously unprotected tables", () => {
    const sql = read("supabase/migrations/0005_rls_hardening.sql");
    for (const table of [
      "users",
      "company_career_pages",
      "worker_status",
      "app_meta",
      "company_reviews",
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("revokes anon and authenticated access on protected tables", () => {
    const sql = read("supabase/migrations/0005_rls_hardening.sql");
    expect(sql).toMatch(/revoke all on public\.users from anon, authenticated/i);
    expect(sql).toMatch(/revoke all on public\.worker_status from anon, authenticated/i);
  });

  it("does not leave a broad PUBLIC schema grant in setup", () => {
    const setup = read("scripts/setup-supabase.js");
    expect(setup).not.toMatch(/grant all on schema public to public/i);
  });

  it("applies migrations 0001 through 0005 in order", () => {
    const setup = read("scripts/setup-supabase.js");
    const names = [...setup.matchAll(/000\d_[a-z_]+\.sql/g)].map((match) => match[0]);
    expect(names).toEqual([
      "0001_schema.sql",
      "0002_rls.sql",
      "0003_push_subscriptions.sql",
      "0004_push_subscriptions_rls.sql",
      "0005_rls_hardening.sql",
    ]);
  });
});
