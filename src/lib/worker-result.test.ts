import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  affectedRows: vi.fn(),
  newId: vi.fn(() => "evt-test"),
  nowIso: vi.fn(() => "2026-11-26T00:00:00.000Z"),
  parseJson: vi.fn((value: unknown) => (typeof value === "string" ? JSON.parse(value) : value)),
  createNotification: vi.fn(async () => undefined),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock("./db", () => ({
  transaction: mocks.transaction,
  affectedRows: mocks.affectedRows,
  newId: mocks.newId,
  nowIso: mocks.nowIso,
  parseJson: mocks.parseJson,
}));

vi.mock("./repositories", () => ({ createNotification: mocks.createNotification }));

import { recordWorkerResult } from "./worker-result";

const task = {
  id: "task-1",
  user_id: "user-1",
  type: "browser-apply",
  status: "running",
  attempts: 1,
  max_attempts: 3,
  payload: JSON.stringify({ applicationId: "app-1", submit: true }),
};
const application = { id: "app-1", user_id: "user-1", state: "Applying" };

function setup(taskStatus = "running", attempts = 1) {
  let currentStatus = taskStatus;
  mocks.dbRun.mockReset();
  mocks.dbGet.mockReset();
  mocks.affectedRows.mockReset();
  mocks.createNotification.mockReset();
  mocks.transaction.mockReset();
  mocks.affectedRows.mockReturnValue(1);
  mocks.transaction.mockImplementation(async (fn: (db: { get: typeof mocks.dbGet; run: typeof mocks.dbRun }) => unknown) => {
    const db = { get: mocks.dbGet, run: mocks.dbRun };
    mocks.dbGet.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM automation_tasks")) {
        return { ...task, status: currentStatus, attempts };
      }
      if (sql.includes("FROM applications")) return application;
      if (sql.includes("FROM jobs")) return { title: "Software Engineer" };
      return undefined;
    });
    mocks.dbRun.mockImplementation(async (sql: string) => {
      if (sql.includes("UPDATE automation_tasks")) {
        // Parameterized atomic gate: the second argument carries the new status.
        const params = (mocks.dbRun.mock.calls.at(-1)?.[1] ?? []) as unknown[];
        if (Array.isArray(params) && params.length > 0) currentStatus = String(params[0]);
        return undefined;
      }
      return undefined;
    });
    return fn(db);
  });
  return {
    currentStatus: () => currentStatus,
  };
}

describe("recordWorkerResult idempotency", () => {
  beforeEach(() => setup());

  it("records a fresh applied result and notifies once", async () => {
    const result = await recordWorkerResult("task-1", { status: "applied", confirmation: "Thank you" });
    expect(result).toMatchObject({ ok: true, status: "applied", state: "Applied" });
    expect(mocks.dbRun.mock.calls.some(([sql]) => String(sql).includes("application.submitted_browser"))).toBe(true);
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
  });

  it("ignores a duplicate applied result without new events or notifications", async () => {
    await recordWorkerResult("task-1", { status: "applied", confirmation: "Thank you" });
    const before = mocks.dbRun.mock.calls.length;
    const duplicate = await recordWorkerResult("task-1", { status: "applied", message: "duplicate" });
    expect(duplicate).toMatchObject({ ok: true, duplicate: true, status: "duplicate" });
    expect(mocks.dbRun.mock.calls.length).toBe(before);
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
  });

  it("ignores a different result after a terminal task state", async () => {
    setup("succeeded", 1);
    const result = await recordWorkerResult("task-1", { status: "failed" });
    expect(result).toMatchObject({ duplicate: true, status: "duplicate" });
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("accepts a retry after a network timeout when the task is still queued", async () => {
    setup("queued", 1);
    const result = await recordWorkerResult("task-1", { status: "applied", confirmation: "Thank you" });
    expect(result).toMatchObject({ ok: true, status: "applied" });
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
  });

  it("treats concurrent duplicates as a single write", async () => {
    mocks.affectedRows.mockReturnValueOnce(1).mockReturnValue(0);
    const results = await Promise.all([
      recordWorkerResult("task-1", { status: "applied", confirmation: "Thank you" }),
      recordWorkerResult("task-1", { status: "applied", confirmation: "Thank you" }),
    ]);
    expect(results.filter((r) => r.status === "applied")).toHaveLength(1);
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
  });

  it("records manual_required without marking the application Applied", async () => {
    const result = await recordWorkerResult("task-1", { status: "manual_required", message: "captcha" });
    expect(result).toMatchObject({ ok: true, status: "manual_required", state: "Approved" });
    expect(mocks.dbRun.mock.calls.some(([sql]) => String(sql).includes("'Applied'"))).toBe(false);
  });

  it("schedules a retry for a non-terminal failure", async () => {
    const result = await recordWorkerResult("task-1", { status: "failed" });
    expect(result).toMatchObject({ ok: true, status: "retry_queued" });
    expect(
      mocks.dbRun.mock.calls.some(
        ([sql, params]) =>
          String(sql).includes("UPDATE automation_tasks") &&
          Array.isArray(params) &&
          params[0] === "queued" &&
          Boolean(params[2]),
      ),
    ).toBe(true);
  });
});
