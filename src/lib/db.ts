import path from "node:path";
import { mkdirSync } from "node:fs";
import { SCHEMA_SQL } from "./schema";

export type DbProvider = "sqlite" | "postgres";

const provider: DbProvider = process.env.DATABASE_URL || process.env.POSTGRES_URL ? "postgres" : "sqlite";
let sqliteDb: any = null;
let pgPool: any = null;

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH || "./data/jobpilot.db";
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

import { DatabaseSync } from "node:sqlite";

function getSqlite() {
  if (!sqliteDb) {
    const filePath = resolveDbPath();
    if (filePath !== ":memory:") mkdirSync(path.dirname(filePath), { recursive: true });
    sqliteDb = new DatabaseSync(filePath);
    sqliteDb.exec("PRAGMA foreign_keys = ON;");
    sqliteDb.exec("PRAGMA busy_timeout = 5000;");
    if (filePath !== ":memory:") sqliteDb.exec("PRAGMA journal_mode = WAL;");
    sqliteDb.exec(SCHEMA_SQL);
  }
  return sqliteDb;
}

function getPg() {
  if (!pgPool) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require("pg");
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    pgPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_SIZE || 3),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: true,
    });
  }
  return pgPool;
}

function toPgPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizeParams(params: any[]): any[] {
  return params.map((value) => (value === undefined ? null : value));
}

export function getProvider(): DbProvider {
  return provider;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = "id"): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomUUID } = require("node:crypto");
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === "object") return value as T;
  return fallback;
}

export function toBoolInt(value: boolean | number | null | undefined): number {
  return value ? 1 : 0;
}

export function fromBoolInt(value: number | boolean | null | undefined): boolean {
  return value === true || value === 1;
}

export async function run(sql: string, params: (string | number | null | Uint8Array)[] = []): Promise<any> {
  const normalized = normalizeParams(params as any[]);
  if (provider === "postgres") {
    return getPg().query(toPgPlaceholders(sql), normalized);
  }
  const db = getSqlite();
  return db.prepare(sql).run(...normalized);
}

export async function get<T = any>(sql: string, params: (string | number | null | Uint8Array)[] = []): Promise<T | undefined> {
  const normalized = normalizeParams(params as any[]);
  if (provider === "postgres") {
    const result = await getPg().query(toPgPlaceholders(sql), normalized);
    return result.rows[0] as T | undefined;
  }
  const db = getSqlite();
  return db.prepare(sql).get(...normalized) as T | undefined;
}

export async function all<T = any>(sql: string, params: (string | number | null | Uint8Array)[] = []): Promise<T[]> {
  const normalized = normalizeParams(params as any[]);
  if (provider === "postgres") {
    const result = await getPg().query(toPgPlaceholders(sql), normalized);
    return result.rows as T[];
  }
  const db = getSqlite();
  return db.prepare(sql).all(...normalized) as T[];
}

export async function exec(sql: string): Promise<void> {
  if (provider === "postgres") {
    await getPg().query(sql);
    return;
  }
  getSqlite().exec(sql);
}

export async function count(sql: string, params: (string | number | null)[] = []): Promise<number> {
  const row = await get<{ c: number | string }>(sql, params as any);
  return Number(row?.c ?? 0);
}

/** Number of rows changed by a `run()` call on either database provider. */
export function affectedRows(result: unknown): number {
  if (!result || typeof result !== "object") return 0;
  const value = result as { changes?: unknown; rowCount?: unknown };
  if (typeof value.changes === "number") return value.changes;
  if (typeof value.rowCount === "number") return value.rowCount;
  return 0;
}

export interface DbClient {
  run(sql: string, params?: any[]): Promise<any>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;
}

export async function transaction<T>(fn: (db: DbClient) => Promise<T>): Promise<T> {
  if (provider === "postgres") {
    const client = await getPg().connect();
    const tx: DbClient = {
      run: async (sql, params = []) => client.query(toPgPlaceholders(sql), normalizeParams(params)),
      get: async (sql, params = []) => {
        const result = await client.query(toPgPlaceholders(sql), normalizeParams(params));
        return result.rows[0];
      },
      all: async (sql, params = []) => {
        const result = await client.query(toPgPlaceholders(sql), normalizeParams(params));
        return result.rows;
      },
    };
    await client.query("BEGIN");
    try {
      const result = await fn(tx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const db = getSqlite();
  db.exec("BEGIN IMMEDIATE");
  const tx: DbClient = {
    run: async (sql, params = []) => db.prepare(sql).run(...normalizeParams(params)),
    get: async (sql, params = []) => db.prepare(sql).get(...normalizeParams(params)),
    all: async (sql, params = []) => db.prepare(sql).all(...normalizeParams(params)),
  };
  try {
    const result = await fn(tx);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getDb(): any {
  return provider === "postgres" ? getPg() : getSqlite();
}

export async function ensureSchema(): Promise<void> {
  if (provider === "sqlite") {
    const db = getSqlite();
    // schema already applied in getSqlite
    void db;
  }
}









