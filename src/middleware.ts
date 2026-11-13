import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "jobpilot_session";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  if (SAFE_METHODS.has(request.method)) {
    return NextResponse.next();
  }
  // Worker, cron, and other token/secret-authenticated endpoints do not carry
  // the browser session cookie and are validated by their own secrets.
  if (!request.cookies.get(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.json({ error: "Missing request origin." }, { status: 403 });
  }
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const host = request.headers.get("host");
  let allowedHost: string | null = null;
  if (process.env.APP_URL) {
    try {
      allowedHost = new URL(process.env.APP_URL).host;
    } catch {
      allowedHost = null;
    }
  }
  // A missing Host header cannot be validated; reject rather than fall open.
  if (!host) {
    return NextResponse.json({ error: "Missing request host." }, { status: 403 });
  }
  if (originHost !== host && originHost !== allowedHost) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};