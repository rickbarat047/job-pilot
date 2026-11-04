import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { all, get, newId, nowIso, parseJson, run, toJson, transaction } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { DEFAULT_PERMISSIONS } from "./permissions";
import type { AutonomyLevel } from "./permissions";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "jobpilot_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createUser(input: { email: string; password: string; name: string }): Promise<SessionUser> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("Enter a valid email address.", 400);
  if (name.length < 2) throw new AuthError("Enter your full name.", 400);
  if (input.password.length < 8) throw new AuthError("Password must be at least 8 characters.", 400);
  const existing = await get<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) throw new AuthError("An account with this email already exists.", 409);

  const id = newId("usr");
  const now = nowIso();
  const passwordHash = await hashPassword(input.password);
  await run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [id, email, passwordHash, name, now, now]);
  await run("INSERT INTO candidate_profiles (user_id, full_name, email, country, created_at, updated_at) VALUES (?, ?, ?, 'India', ?, ?)", [id, name, email, now, now]);
  await run("INSERT INTO candidate_preferences (user_id, target_roles, experience_levels, employment_types, work_modes, preferred_locations, all_india, remote_india, international_remote, min_salary_lpa, salary_flexible, unpaid_internship, paid_internship, industries, flexibility, match_weights, updated_at) VALUES (?, '[]', '[\"Fresher\",\"Entry-level\"]', '[\"Full-time\",\"Internship\",\"Graduate trainee\"]', '[\"On-site\",\"Hybrid\",\"Remote\"]', '[]', 1, 1, 0, NULL, 1, 0, 1, '[]', '{\"anyIndustry\":true,\"anyRole\":true,\"willingToLearn\":true,\"willingToRelocate\":false,\"willingToRemote\":true,\"entryLevel\":true,\"startups\":true,\"nonCore\":true}', '{}', ?)", [id, now]);
  const p = DEFAULT_PERMISSIONS;
  await run("INSERT INTO user_permissions (user_id, autonomy_level, search_jobs, analyze_jobs, match_jobs, generate_resumes, generate_cover_letters, save_drafts, submit_applications, send_recruiter_emails, answer_sensitive_questions, accept_offers, share_personal_info, auto_apply_categories, auto_apply_min_score, allow_duplicate_applications, demo_mode, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'never', ?, '[]', ?, 0, ?, ?)", [id, p.autonomyLevel, p.searchJobs, p.analyzeJobs, p.matchJobs, p.generateResumes, p.generateCoverLetters, p.saveDrafts, p.submitApplications, p.sendRecruiterEmails, p.answerSensitiveQuestions, p.sharePersonalInfo, p.autoApplyMinScore, p.demoMode ? 1 : 0, now]);
  await run("INSERT INTO notification_preferences (user_id, email_enabled, daily_digest, application_updates, interview_reminders, frequency, updated_at) VALUES (?, 0, 1, 1, 1, 'daily', ?)", [id, now]);
  await run("INSERT INTO scheduled_searches (id, user_id, name, frequency, hour_local, sources, enabled, next_run_at, created_at, updated_at) VALUES (?, ?, 'Daily opportunity scan', 'daily', 8, '[]', 1, ?, ?, ?)", [newId("sch"), id, nextDailyRun(8), now, now]);
  await run("INSERT INTO audit_logs (id, user_id, action, entity, entity_id, detail, created_at) VALUES (?, ?, 'account.created', 'user', ?, '{}', ?)", [newId("aud"), id, id, now]);
  return { id, email, name, createdAt: now };
}

export function nextDailyRun(hour: number, from = new Date()): string {
  const next = new Date(from);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = await get<{ id: string; email: string; name: string; password_hash: string; created_at: string; deleted_at: string | null }>(
    "SELECT id, email, name, password_hash, created_at, deleted_at FROM users WHERE email = ?",
    [normalizeEmail(email)],
  );
  if (!user || user.deleted_at) return null;
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, createdAt: user.created_at };
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000);
  await run("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)", [
    newId("ses"), userId, tokenHash, expires.toISOString(), now.toISOString(),
  ]);
  // Clean up expired sessions lazily — don't block the login response.
  void run("DELETE FROM sessions WHERE expires_at <= ?", [now.toISOString()]).catch(() => {});
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await run("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  jar.set(COOKIE_NAME, "", { httpOnly: true, path: "/", expires: new Date(0) });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const row = await get<{ id: string; email: string; name: string; created_at: string; expires_at: string }>(
    `SELECT u.id, u.email, u.name, u.created_at, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND u.deleted_at IS NULL`,
    [hashToken(token)],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Sign in to continue.", 401);
  return user;
}

/** Same-origin check for cookie-authenticated mutations. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AuthError("Invalid request origin.", 403);
  }
  const allowedHost = process.env.APP_URL ? new URL(process.env.APP_URL).host : host;
  if (host && originHost !== host && originHost !== allowedHost) {
    throw new AuthError("Cross-site request blocked.", 403);
  }
}

export async function audit(userId: string, action: string, entity: string, entityId: string | null, detail: unknown = {}, ip?: string): Promise<void> {
  await run(
    "INSERT INTO audit_logs (id, user_id, action, entity, entity_id, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [newId("aud"), userId, action, entity, entityId, toJson(detail), ip ?? null, nowIso()],
  );
}

export async function getUserCount(): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL");
  return Number(row?.c ?? 0);
}

export async function getPermissions(userId: string): Promise<{
  autonomyLevel: AutonomyLevel;
  searchJobs: string; analyzeJobs: string; matchJobs: string; generateResumes: string; generateCoverLetters: string;
  saveDrafts: string; submitApplications: string; sendRecruiterEmails: string; answerSensitiveQuestions: string;
  acceptOffers: "never"; sharePersonalInfo: string; autoApplyCategories: string[]; autoApplyMinScore: number;
  allowDuplicateApplications: boolean; demoMode: boolean;
} > {
  const row = await get<Record<string, unknown>>("SELECT * FROM user_permissions WHERE user_id = ?", [userId]);
  if (!row) return { ...DEFAULT_PERMISSIONS };
  const parseArr = (v: unknown): string[] => parseJson<string[]>(v, []);
  return {
    autonomyLevel: Number(row.autonomy_level) as AutonomyLevel,
    searchJobs: String(row.search_jobs),
    analyzeJobs: String(row.analyze_jobs),
    matchJobs: String(row.match_jobs),
    generateResumes: String(row.generate_resumes),
    generateCoverLetters: String(row.generate_cover_letters),
    saveDrafts: String(row.save_drafts),
    submitApplications: String(row.submit_applications),
    sendRecruiterEmails: String(row.send_recruiter_emails),
    answerSensitiveQuestions: String(row.answer_sensitive_questions),
    acceptOffers: "never",
    sharePersonalInfo: String(row.share_personal_info),
    autoApplyCategories: parseArr(row.auto_apply_categories),
    autoApplyMinScore: Number(row.auto_apply_min_score ?? 85),
    allowDuplicateApplications: Number(row.allow_duplicate_applications) === 1,
    demoMode: Number(row.demo_mode) === 1,
  };
}

export async function listSessions(userId: string): Promise<{ id: string; created_at: string; expires_at: string }[]> {
  return await all("SELECT id, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC", [userId]);
}








