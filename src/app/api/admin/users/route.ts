import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { all, get } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireApiUser();
    // Admin access is server-controlled and never derived from editable
    // permission rows.
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Try query with login tracking columns first
    let users: any[] = [];
    try {
      users = await all<{
        id: string;
        email: string;
        name: string;
        created_at: string;
        last_login_at: string | null;
        login_count: number | null;
        deleted_at: string | null;
      }>(
        `SELECT u.id, u.email, u.name, u.created_at, u.last_login_at, u.login_count, u.deleted_at
         FROM users u
         WHERE u.deleted_at IS NULL
         ORDER BY u.last_login_at DESC NULLS LAST, u.created_at DESC`
      );
    } catch {
      // Fallback: query without login tracking columns (if migration hasn't run yet)
      users = await all<{
        id: string;
        email: string;
        name: string;
        created_at: string;
        last_login_at: string | null;
        login_count: number | null;
        deleted_at: string | null;
      }>(
        `SELECT u.id, u.email, u.name, u.created_at, NULL as last_login_at, 0 as login_count, u.deleted_at
         FROM users u
         WHERE u.deleted_at IS NULL
         ORDER BY u.created_at DESC`
      );
    }

    // Get session count per user (active sessions)
    const sessions = await all<{ user_id: string; c: number }>(
      "SELECT user_id, COUNT(*) as c FROM sessions WHERE expires_at > ? GROUP BY user_id",
      [new Date().toISOString()],
    );
    const sessionMap = new Map(sessions.map((s) => [s.user_id, Number(s.c)]));

    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at ?? null,
      loginCount: Number(u.login_count ?? 0),
      activeSessions: sessionMap.get(u.id) ?? 0,
    }));

    return NextResponse.json({ users: result, total: result.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}