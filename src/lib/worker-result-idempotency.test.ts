import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
  transaction: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("./db", () => ({
  affectedRows: (result: { rowCount?: number } | undefined) => result?.rowCount ?? 0,
  get: mocks.get,
  run: mocks.run,
  all: mocks.all,
  transaction: mocks.transaction,
  newId: () => "event_test",
  nowIso: () => "2026-11-14T00:00:00.000Z",
  parseJson: (value: unknown, fallback: unknown) => typeof value === "string" ? JSON.parse(value) : fallback,
}));

vi.mock("./repositories", () => ({
  createNotification: mocks.createNotification,
  getApplicationDetail: vi.fn(),
  getPermissionsForUser: vi.fn(),
  getProfile: vi.fn(),
}));

import { recordWorkerResult } from "./worker-tasks";

describe("browser worker result idempotency", () => {
  beforeEach(() => vi.resetAllMocks());

  it("does not duplicate tracking events or notifications for a retried success callback", async () => {
    mocks.get.mockResolvedValue({
      id: "task_1", user_id: "user_1", type: "browser-apply", status: "succeeded",
      payload: JSON.stringify({ applicationId: "app_1" }),
    });

    const result = await recordWorkerResult("task_1", { status: "applied", confirmation: "Thank you for applying" });

    expect(result).toMatchObject({ state: "Applied", status: "applied", alreadyRecorded: true });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("records the application transition and task completion in one transaction", async () => {
    mocks.get
      .mockResolvedValueOnce({
        id: "task_1", user_id: "user_1", type: "browser-apply", status: "running",
        payload: JSON.stringify({ applicationId: "app_1" }), attempts: 1,
      })
      .mockResolvedValueOnce({ id: "app_1", state: "Applying" })
      .mockResolvedValueOnce({ title: "Engineer" });
    const tx = {
      get: vi.fn()
        .mockResolvedValueOnce({ status: "running" })
        .mockResolvedValueOnce({ state: "Applying" }),
      run: vi.fn().mockResolvedValue({ rowCount: 1 }),
      all: vi.fn(),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));

    const result = await recordWorkerResult("task_1", {
      status: "applied", confirmation: "Thank you for applying", finalUrl: "https://jobs.example/apply",
    });

    expect(result).toMatchObject({ state: "Applied", status: "applied" });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(tx.run).toHaveBeenCalledTimes(3);
    expect(tx.run.mock.calls[1][0]).toContain("state='Applied'");
    expect(tx.run.mock.calls[2][0]).toContain("application.submitted_browser");
    expect(mocks.createNotification).toHaveBeenCalledOnce();
  });
});
