const USER_AGENT = "JobPilotAI/1.0 (+https://github.com/jobpilot-ai; candidate-side job discovery)";

export class SourceHttpError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "SourceHttpError";
    this.status = status;
    this.url = url;
  }
}

const MAX_BYTES = 6_000_000;

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) throw new Error("Response exceeded the 6 MB safety limit.");
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

export async function fetchJson<T>(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; headers?: Record<string, string> } = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(options.timeoutMs ?? 25_000),
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new SourceHttpError(`HTTP ${response.status} from ${new URL(url).host}`, response.status, url);
  }
  const text = await readLimited(response);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON from ${new URL(url).host} but received another format.`);
  }
}

export async function fetchPage(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; maxBytes?: number } = {},
): Promise<{ text: string; contentType: string; status: number; finalUrl: string }> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http(s) URLs are supported.");
  if (isPrivateHost(parsed.hostname)) throw new Error("Private or local network URLs are not allowed.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    cache: "no-store",
  });
  const text = await readLimited(response);
  return { text, contentType: response.headers.get("content-type") ?? "", status: response.status, finalUrl: response.url || url };
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  return false;
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}




