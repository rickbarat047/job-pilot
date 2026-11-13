/**
 * Server-only administrator authorization.
 *
 * Admin access is intentionally NOT derived from user-editable permission
 * rows. It is controlled exclusively by the ADMIN_EMAILS environment variable.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  const allowed = adminEmails();
  if (allowed.length === 0) return false;
  const normalized = (email || "").trim().toLowerCase();
  return allowed.includes(normalized);
}