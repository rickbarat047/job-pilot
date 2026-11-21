import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("push_subscriptions schema consistency", () => {
  it("has a sequential migration creating push_subscriptions", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0003_push_subscriptions.sql"), "utf8");
    expect(sql).toMatch(/create table if not exists public\.push_subscriptions/i);
  });

  it("migration includes user_id foreign key with cascade", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0003_push_subscriptions.sql"), "utf8");
    expect(sql).toMatch(/user_id text not null references public\.users\(id\) on delete cascade/i);
  });

  it("migration includes unique constraint on user_id + endpoint", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0003_push_subscriptions.sql"), "utf8");
    expect(sql).toMatch(/unique\s*\(\s*user_id\s*,\s*endpoint\s*\)/i);
  });

  it("sqlite schema defines push_subscriptions", () => {
    const sql = readFileSync(resolve(process.cwd(), "src/lib/schema.ts"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS push_subscriptions/);
  });

  it("bootstrap does not duplicate the push_subscriptions definition (migration is authoritative)", () => {
    const sql = readFileSync(resolve(process.cwd(), "src/lib/bootstrap.ts"), "utf8");
    expect(sql).not.toMatch(/CREATE TABLE IF NOT EXISTS push_subscriptions/);
  });
});
