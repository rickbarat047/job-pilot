import dns from "node:dns";
import net from "node:net";
import http from "node:http";
import https from "node:https";

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

export function pinnedLookup(address: string, family: number): any {
  return (_hostname: any, options: any, callback: any) => {
    if (options && options.all) {
      callback(null, [{ address, family }]);
    } else {
      callback(null, address, family);
    }
  };
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

export async function resolveSafeAddresses(hostname: string): Promise<ResolvedAddress[]> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isPrivateHost(host)) throw new Error("Private or local network hosts are not allowed.");

  // Literal IP addresses are validated directly.
  if (net.isIP(host)) {
    return [{ address: host, family: net.isIP(host) }];
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = (await dns.promises.lookup(host, { all: true, verbatim: true })) as ResolvedAddress[];
  } catch {
    throw new Error("Unable to resolve host.");
  }
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error("Unable to resolve host.");
  }
  for (const entry of addresses) {
    if (isPrivateHost(entry.address)) {
      throw new Error("Host resolves to a private or reserved IP address.");
    }
  }
  return addresses;
}

async function safeRequest(url: string, init: RequestInit): Promise<Response> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http(s) URLs are supported.");
  }
  const addresses = await resolveSafeAddresses(parsed.hostname);
  const pinned = addresses[0];
  const isHttps = parsed.protocol === "https:";
  const mod = isHttps ? https : http;

  return await new Promise<Response>((resolve, reject) => {
    const req = mod.request(parsed, {
      method: init.method || "GET",
      headers: init.headers as http.OutgoingHttpHeaders,
      lookup: pinnedLookup(pinned.address, pinned.family),
      servername: isHttps ? parsed.hostname : undefined,
    }, (res) => {
      const chunks: Buffer[] = [];
      let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.byteLength;
        if (total > MAX_BYTES) {
          req.destroy(new Error("Response exceeded the 6 MB safety limit."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) headers.append(key, item);
          } else if (typeof value === "string") {
            headers.set(key, value);
          }
        }
        const response = new Response(body, {
          status: res.statusCode || 0,
          statusText: res.statusMessage,
          headers,
        });
        Object.defineProperty(response, "url", { value: url, writable: true });
        resolve(response);
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Request timed out.")));
    if (init.signal) {
      const abort = () => req.destroy(new Error("Request aborted."));
      if (init.signal.aborted) abort();
      init.signal.addEventListener("abort", abort, { once: true });
    }
    req.end();
  });
}

const MAX_REDIRECTS = 5;

async function fetchWithValidatedRedirects(
  url: string,
  init: RequestInit,
  fetchImpl?: typeof fetch,
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = url;
  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    const parsed = new URL(currentUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only http(s) URLs are supported.");
    }
    if (isPrivateHost(parsed.hostname)) {
      throw new Error("Private or local network URLs are not allowed.");
    }
    // DNS resolution is validated in the production path. When an injected
    // fetch implementation is supplied (tests), keep it testable without DNS.
    if (!fetchImpl) await resolveSafeAddresses(parsed.hostname);
    const requester = fetchImpl ?? safeRequest;
    const response = await requester(currentUrl, { ...init, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect response is missing a Location header.");
      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        throw new Error("Redirect Location header is invalid.");
      }
      currentUrl = nextUrl;
      continue;
    }
    const finalUrl = response.url || currentUrl;
    if (isPrivateHost(new URL(finalUrl).hostname)) {
      throw new Error("Redirects to private or local network URLs are not allowed.");
    }
    return { response, finalUrl };
  }
  throw new Error("Too many redirects.");
}

export async function fetchJson<T>(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; headers?: Record<string, string> } = {},
): Promise<T> {
  // Do not fall back to the global fetch: that would bypass DNS resolution and
  // address pinning. Only an explicitly injected implementation (tests) is used.
  const fetchImpl = options.fetchImpl;
  const { response, finalUrl } = await fetchWithValidatedRedirects(
    url,
    {
      signal: AbortSignal.timeout(options.timeoutMs ?? 25_000),
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    },
    fetchImpl,
  );
  if (!response.ok) {
    throw new SourceHttpError(`HTTP ${response.status} from ${new URL(finalUrl).host}`, response.status, finalUrl);
  }
  const text = await readLimited(response);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON from ${new URL(finalUrl).host} but received another format.`);
  }
}

export async function fetchPage(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; maxBytes?: number } = {},
): Promise<{ text: string; contentType: string; status: number; finalUrl: string }> {
  const fetchImpl = options.fetchImpl;
  const { response, finalUrl } = await fetchWithValidatedRedirects(
    url,
    {
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
    },
    fetchImpl,
  );
  const text = await readLimited(response);
  return { text, contentType: response.headers.get("content-type") ?? "", status: response.status, finalUrl };
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;

  // IPv6
  if (host.includes(":")) {
    if (host === "::" || host === "0:0:0:0:0:0:0:0" || host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
    if (/^f[cd][0-9a-f]{2}:/.test(host)) return true; // ULA fc00::/7
    if (/^fe[89ab][0-9a-f]:/.test(host)) return true; // link-local fe80::/10
    if (host.startsWith("ff")) return true; // multicast ff00::/8
    if (host.startsWith("2001:db8:")) return true; // documentation prefix
    if (host.startsWith("::ffff:")) {
      const mapped = host.slice("::ffff:".length);
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(mapped)) return isPrivateHost(mapped);
    }
    return false;
  }

  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
    const [a, b, c] = parts;
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a === 192 && b === 0) return true; // IETF protocol assignments
    if (a === 198 && b === 51 && c === 100) return true; // documentation
    if (a === 203 && b === 0 && c === 113) return true; // documentation
    if (a >= 224) return true; // multicast/reserved
    if (a === 255 && b === 255 && c === 255) return true;
    return false;
  }

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




