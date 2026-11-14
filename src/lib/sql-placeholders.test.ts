import { describe, expect, it } from "vitest";
import { toPgPlaceholders } from "./sql-placeholders";

describe("toPgPlaceholders", () => {
  it("converts placeholders in SQL code only", () => {
    const sql = "SELECT ? AS value, '?' AS question, \"?column\" FROM jobs WHERE id = ?";
    expect(toPgPlaceholders(sql)).toBe("SELECT $1 AS value, '?' AS question, \"?column\" FROM jobs WHERE id = $2");
  });

  it("leaves line and nested block comments untouched", () => {
    const sql = "SELECT ? -- ?\n/* ? /* ? */ ? */ WHERE id = ?";
    expect(toPgPlaceholders(sql)).toBe("SELECT $1 -- ?\n/* ? /* ? */ ? */ WHERE id = $2");
  });

  it("leaves dollar-quoted bodies and JSON existence operators untouched", () => {
    const sql = "SELECT $$?$$, $body$ ? $body$, data ? 'key', data ?| array['x'], data ?& array['y'] FROM jobs WHERE id = ?";
    expect(toPgPlaceholders(sql)).toBe("SELECT $$?$$, $body$ ? $body$, data ? 'key', data ?| array['x'], data ?& array['y'] FROM jobs WHERE id = $1");
  });

  it("handles escaped quotes and E-string escapes", () => {
    const sql = "SELECT 'it''s ?', E'escaped\\'? still text', ?";
    expect(toPgPlaceholders(sql)).toBe("SELECT 'it''s ?', E'escaped\\'? still text', $1");
  });
});
