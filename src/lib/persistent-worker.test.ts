import { describe, it, expect } from "vitest";
import {
  createPersistentWorker,
  computeBackoffMs,
  normalizeTaskResult,
  submissionOutcome,
} from "../../scripts/persistent-worker.mjs";

// The worker is deliberately dependency-injected: every test uses a virtual
// clock (sleep advances `now`), a fake fetch, and a real AbortController. No
// timers, network, browser, database or credentials are involved.

type Json = Record<string, any>;

interface FakeResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

interface FakeRequest {
  url: string;
  path: string;
  method: string;
  body: Json;
  headers: Record<string, string>;
  call: number;
}

type Responder = (req: FakeRequest) => FakeResponse | Promise<FakeResponse>;

function jsonResponse(status: number, body: Json): FakeResponse {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

function networkFailure(): never {
  throw new TypeError("fetch failed");
}

function harness(options: {
  config?: Record<string, any>;
  responder?: Responder;
  executeTask?: (payload: any, ctx: any) => Promise<any>;
  token?: string;
  initialAbort?: boolean;
} = {}) {
  let time = 1_700_000_000_000;
  const controller = new AbortController();
  const requests: FakeRequest[] = [];
  const sleeps: number[] = [];
  const logs: string[] = [];
  const executorCalls: any[] = [];
  let call = 0;
  const token = options.token ?? "test-worker-token";

  const defaultResponder: Responder = (req) => {
    if (req.path === "/api/automation/worker") return jsonResponse(200, { ok: true });
    if (req.path.endsWith("/claim")) return jsonResponse(200, { task: null });
    if (req.path.endsWith("/result")) return jsonResponse(200, { ok: true, duplicate: false });
    return jsonResponse(200, {});
  };
  const responder = options.responder ?? defaultResponder;

  const fetchImpl = async (url: string, init: any): Promise<FakeResponse> => {
    let body: Json = {};
    try {
      body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    } catch {
      body = { raw: String(init?.body) };
    }
    const req: FakeRequest = {
      url,
      path: new URL(url).pathname,
      method: init?.method ?? "GET",
      body,
      headers: init?.headers ?? {},
      call: ++call,
    };
    requests.push(req);
    return await responder(req);
  };

  const sleep = async (ms: number) => {
    sleeps.push(ms);
    time += ms;
  };
  const log = (level: string, message: string) => {
    logs.push(`${level}: ${message}`);
  };

  const worker = createPersistentWorker({
    config: {
      baseUrl: "https://app.example.test",
      token,
      pollIntervalMs: 1_000,
      heartbeatIntervalMs: 5_000,
      maxAttempts: 3,
      baseRetryMs: 100,
      maxRetryMs: 1_000,
      heartbeatFailureLimit: 3,
      maxTasks: 1,
      maxPolls: 50,
      ...(options.config ?? {}),
    },
    deps: {
      fetch: fetchImpl,
      sleep,
      now: () => time,
      signal: controller.signal,
      log,
      executeTask: options.executeTask ?? (async (payload: any) => {
        executorCalls.push(payload);
        return { status: "manual_required", message: "test task not submitted" };
      }),
    },
  });

  if (options.initialAbort) controller.abort();

  return {
    worker,
    controller,
    requests,
    sleeps,
    logs,
    executorCalls,
    token,
    now: () => time,
    callCount: () => call,
  };
}

const heartbeats = (requests: FakeRequest[]) => requests.filter((r) => r.path === "/api/automation/worker");
const claims = (requests: FakeRequest[]) => requests.filter((r) => r.path.endsWith("/claim"));
const results = (requests: FakeRequest[]) => requests.filter((r) => r.path.endsWith("/result"));

describe("persistent worker - startup", () => {
  it("posts an online, idle heartbeat before claiming and sends the token only in headers", async () => {
    const h = harness();

    const summary = await h.worker.run();

    const first = h.requests[0];
    expect(first.path).toBe("/api/automation/worker");
    expect(first.method).toBe("POST");
    expect(first.body.status).toBe("online");
    expect(first.body.meta.processing).toBe(false);
    expect(first.body).not.toHaveProperty("token");
    expect(first.headers["x-worker-token"]).toBe(h.token);
    expect(summary.exitCode).toBe(0);
  });

  it("never posts offline between polls; offline is only sent at shutdown", async () => {
    const h = harness();

    await h.worker.run();

    const offline = heartbeats(h.requests).filter((r) => r.body.status === "offline");
    expect(offline).toHaveLength(1);
    expect(h.requests[h.requests.length - 1]).toBe(offline[0]);
  });
});

describe("persistent worker - bounded retries and backoff", () => {
  it("retries a transient claim failure with exponential delays and then succeeds", async () => {
    let claimCalls = 0;
    const h = harness({
      responder: (req) => {
        if (req.path.endsWith("/claim")) {
          claimCalls += 1;
          if (claimCalls <= 2) return networkFailure();
          return jsonResponse(200, { task: { id: "task-1" }, job: { title: "Role" } });
        }
        return jsonResponse(200, { ok: true });
      },
    });

    const summary = await h.worker.run();

    expect(claimCalls).toBe(3);
    expect(h.sleeps.slice(0, 2)).toEqual([100, 200]);
    expect(h.executorCalls).toHaveLength(1);
    expect(summary.exitCode).toBe(0);
  });

  it("caps retries at maxAttempts and reports a non-zero exit instead of looping forever", async () => {
    let claimCalls = 0;
    let stop: (() => void) | undefined;
    const h = harness({
      config: { maxTasks: 1 },
      responder: (req) => {
        if (req.path.endsWith("/claim")) {
          claimCalls += 1;
          // Stop the outer poll loop once one bounded retry cycle is spent;
          // the test uses a virtual clock so no wall-clock timer is involved.
          if (claimCalls === 3) stop?.();
          return networkFailure();
        }
        return jsonResponse(200, { ok: true });
      },
    });
    stop = () => h.controller.abort();

    const summary = await h.worker.run();

    expect(claimCalls).toBeGreaterThanOrEqual(3);
    expect(h.sleeps.slice(0, 2)).toEqual([100, 200]);
    expect(h.logs.join(" ")).toMatch(/claim failed/i);
    expect(summary.exitCode).toBe(1);
  });

  it("computes exponential backoff bounded by the configured maximum", () => {
    expect(computeBackoffMs(1, 100, 1000)).toBe(100);
    expect(computeBackoffMs(2, 100, 1000)).toBe(200);
    expect(computeBackoffMs(3, 100, 1000)).toBe(400);
    expect(computeBackoffMs(10, 100, 1000)).toBe(1000);
  });
});

const withTask = (id = "task-1"): Responder => (req) => {
  if (req.path.endsWith("/claim")) return jsonResponse(200, { task: { id }, job: { title: "Role", company: "Employer" } });
  return jsonResponse(200, { ok: true });
};

describe("persistent worker - heartbeat renewal", () => {
  it("refreshes the lease while idle without posting any offline heartbeat between polls", async () => {
    const h = harness({ config: { maxPolls: 20 } });

    const summary = await h.worker.run();

    const online = heartbeats(h.requests).filter((r) => r.body.status === "online");
    expect(online.length).toBeGreaterThan(1);
    expect(heartbeats(h.requests).filter((r) => r.body.status === "offline")).toHaveLength(1);
    expect(claims(h.requests)).toHaveLength(20);
    expect(results(h.requests)).toHaveLength(0);
    expect(summary.exitCode).toBe(0);
  });

  it("renews the lease with processing:true while a task is in flight", async () => {
    const h = harness({
      responder: withTask("task-7"),
      executeTask: async (payload: any, ctx: any) => {
        for (let i = 0; i < 4; i += 1) await ctx.sleep(5_000);
        return { status: "manual_required", message: "prepared for manual completion" };
      },
    });

    await h.worker.run();

    const during = heartbeats(h.requests).filter(
      (r) => r.body.status === "online" && r.body.meta?.processing === true && r.body.meta?.taskId === "task-7",
    );
    expect(during.length).toBeGreaterThan(0);
    expect(results(h.requests)[0].body.status).toBe("manual_required");
  });
});

describe("persistent worker - graceful shutdown", () => {
  it("stops claiming promptly on SIGTERM and posts offline exactly once", async () => {
    let stop: (() => void) | undefined;
    let claimCalls = 0;
    const h = harness({
      config: { maxTasks: 1_000, maxPolls: 1_000 },
      responder: (req) => {
        if (req.path.endsWith("/claim")) {
          claimCalls += 1;
          if (claimCalls === 2) stop?.();
          return jsonResponse(200, { task: null });
        }
        return jsonResponse(200, { ok: true });
      },
    });
    stop = () => h.controller.abort();

    const summary = await h.worker.run();

    expect(claimCalls).toBe(2);
    expect(heartbeats(h.requests).filter((r) => r.body.status === "offline")).toHaveLength(1);
    expect(results(h.requests)).toHaveLength(0);
    expect(summary.exitCode).toBe(0);
  });

  it("never reports applied when SIGTERM arrives during a task", async () => {
    let stop: (() => void) | undefined;
    const h = harness({
      config: { maxTasks: 1_000, maxPolls: 1_000 },
      responder: withTask("task-9"),
      executeTask: async () => {
        stop?.();
        return { status: "applied", confirmation: "Thank you, application received", message: "submitted" };
      },
    });
    stop = () => h.controller.abort();

    const summary = await h.worker.run();

    expect(results(h.requests)).toHaveLength(1);
    expect(results(h.requests)[0].body.status).toBe("manual_required");
    expect(heartbeats(h.requests).filter((r) => r.body.status === "offline")).toHaveLength(1);
    expect(summary.exitCode).toBe(1);
  });

  it("does not execute or report a result for a duplicate/empty claim response", async () => {
    const h = harness({ config: { maxPolls: 3 } });

    await h.worker.run();

    expect(h.executorCalls).toHaveLength(0);
    expect(results(h.requests)).toHaveLength(0);
  });

  it("treats an idempotent duplicate result response as success", async () => {
    const h = harness({
      responder: (req) => {
        if (req.path.endsWith("/result")) return jsonResponse(200, { ok: true, duplicate: true });
        if (req.path.endsWith("/claim")) return withTask("task-3")(req);
        return jsonResponse(200, { ok: true });
      },
    });

    const summary = await h.worker.run();

    expect(h.logs.join(" ")).toMatch(/duplicate/i);
    expect(summary.exitCode).toBe(0);
  });
});

describe("persistent worker - reconnect and lease recovery", () => {
  it("reconnects after a network outage and processes the next task", async () => {
    let claimCalls = 0;
    let heartbeatCalls = 0;
    const h = harness({
      responder: (req) => {
        if (req.path.endsWith("/claim")) {
          claimCalls += 1;
          if (claimCalls === 1) return networkFailure();
          return jsonResponse(200, { task: { id: "task-4" } });
        }
        if (req.path === "/api/automation/worker") {
          heartbeatCalls += 1;
          if (heartbeatCalls === 1) return networkFailure();
          return jsonResponse(200, { ok: true });
        }
        return jsonResponse(200, { ok: true });
      },
    });

    const summary = await h.worker.run();

    expect(h.executorCalls).toHaveLength(1);
    expect(results(h.requests)).toHaveLength(1);
    expect(h.logs.join(" ")).toMatch(/retry in \d+ms/i);
    expect(summary.exitCode).toBe(0);
  });

  it("abandons a task whose lease cannot be renewed instead of reporting applied", async () => {
    const h = harness({
      responder: (req) => {
        if (req.path.endsWith("/claim")) return withTask("task-11")(req);
        if (req.path === "/api/automation/worker") return networkFailure();
        return jsonResponse(200, { ok: true });
      },
      executeTask: async (payload: any, ctx: any) => {
        // Yield to the event loop so the heartbeat pump can run alongside the
        // "browser" work; virtual time advances via the pump's sleeps.
        for (let i = 0; i < 100 && !ctx.shouldStop?.(); i += 1) {
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
        return { status: "applied", confirmation: "Thank you, application received", message: "submitted" };
      },
    });

    await h.worker.run();

    expect(h.logs.join(" ")).toMatch(/lease renewal failed/i);
    expect(results(h.requests)).toHaveLength(1);
    expect(results(h.requests)[0].body.status).toBe("failed");
    expect(results(h.requests)[0].body.status).not.toBe("applied");
  });

  it("does not re-execute a task id the server hands out twice", async () => {
    const h = harness({
      config: { maxTasks: 2, maxPolls: 10 },
      responder: withTask("task-duplicate"),
    });

    await h.worker.run();

    expect(h.executorCalls).toHaveLength(1);
    expect(results(h.requests)).toHaveLength(1);
    expect(h.logs.join(" ")).toMatch(/duplicate/i);
  });

  it("logs and continues when the server rejects a claim for an expired lock (422)", async () => {
    let claimCalls = 0;
    const h = harness({
      responder: (req) => {
        if (req.path.endsWith("/claim")) {
          claimCalls += 1;
          if (claimCalls === 1) return jsonResponse(422, { error: "Worker lock expired; task recovered." });
          return jsonResponse(200, { task: { id: "task-12" } });
        }
        return jsonResponse(200, { ok: true });
      },
    });

    const summary = await h.worker.run();

    expect(claimCalls).toBe(2);
    expect(h.executorCalls).toHaveLength(1);
    expect(results(h.requests)).toHaveLength(1);
    expect(h.logs.join(" ")).toMatch(/422|lock/i);
    expect(summary.exitCode).toBe(0);
  });
});

describe("persistent worker - credential safety and fatal errors", () => {
  it("stops before claiming when the heartbeat reports invalid credentials", async () => {
    const h = harness({
      responder: (req) => {
        if (req.path === "/api/automation/worker") return jsonResponse(401, { error: "Invalid worker token." });
        return jsonResponse(200, { ok: true });
      },
    });

    const summary = await h.worker.run();

    expect(claims(h.requests)).toHaveLength(0);
    expect(summary.exitCode).toBe(1);
    expect(h.logs.join(" ")).toMatch(/401|token/i);
  });

  it("never prints the worker token in logs or serializes it into a request body", async () => {
    const secret = "s3cr3t-worker-token-xyz";
    const h = harness({
      config: { maxPolls: 2 },
      token: secret,
      responder: (req) => {
        if (req.path.endsWith("/claim")) return jsonResponse(500, { error: `upstream refused credential ${secret}` });
        return jsonResponse(200, { ok: true });
      },
    });

    await h.worker.run();

    expect(h.logs.join(" ")).not.toContain(secret);
    expect(h.requests.every((r) => !JSON.stringify(r.body).includes(secret))).toBe(true);
    expect(h.requests.every((r) => r.headers["x-worker-token"] === secret)).toBe(true);
  });

  it("does not let a failed offline heartbeat conceal an earlier result failure", async () => {
    const h = harness({
      responder: (req) => {
        if (req.path.endsWith("/result")) return networkFailure();
        if (req.path === "/api/automation/worker" && req.body.status === "offline") return networkFailure();
        if (req.path.endsWith("/claim")) return withTask("task-13")(req);
        return jsonResponse(200, { ok: true });
      },
    });

    const summary = await h.worker.run();

    expect(h.logs.join(" ")).toMatch(/result report failed/i);
    expect(h.logs.join(" ")).toMatch(/offline heartbeat failed/i);
    expect(summary.exitCode).toBe(1);
  });
});

describe("persistent worker - result safety", () => {
  it("downgrades applied-without-confirmation to manual_required", () => {
    const r = normalizeTaskResult({ status: "applied", message: "submitted" });
    expect(r.status).toBe("manual_required");
    expect(r.confirmation).toBeUndefined();
  });

  it("keeps applied when an explicit confirmation string is present", () => {
    const r = normalizeTaskResult({ status: "applied", confirmation: "Thank you, application received" });
    expect(r.status).toBe("applied");
    expect(r.confirmation).toBe("Thank you, application received");
  });

  it("treats unknown statuses as failed rather than success", () => {
    expect(normalizeTaskResult({ status: "success" }).status).toBe("failed");
    expect(normalizeTaskResult(null).status).toBe("failed");
  });

  it("only classifies an application as applied for explicit employer confirmation", () => {
    expect(submissionOutcome({ successCount: 1, clicked: true }).status).toBe("manual_required");
    expect(submissionOutcome({ successCount: 1, clicked: true, confirmation: "Thank you for applying" }).status).toBe("applied");
    expect(submissionOutcome({ errorCount: 1, clicked: true }).status).toBe("manual_required");
  });
});
