import { get, run, all, newId, nowIso } from "../db";
import { fetchPage } from "../sources/http";

export interface CompanyContactRecord {
  id: string;
  companyId: string;
  name: string | null;
  role: string | null;
  email: string;
  linkedinUrl: string | null;
  sourceUrl: string | null;
  verificationStatus: "verified" | "unverified";
  createdAt: string;
}

function domainOf(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase();
  }
}

function registrableDomain(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

function inferRole(email: string): string {
  const local = email.split("@")[0].toLowerCase();
  if (local.includes("career") || local.includes("job")) return "Careers";
  if (local.includes("hr") || local.includes("talent") || local.includes("recruit")) return "Human Resources";
  if (local.includes("contact") || local.includes("info")) return "Contact";
  return "Public contact";
}

function isRoleEmail(email: string): boolean {
  const local = email.split("@")[0].toLowerCase();
  return /(career|job|hr|talent|recruit|contact|info|hiring)/.test(local);
}

function extractEmails(html: string): string[] {
  const matches = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((email) => email.toLowerCase().trim()))];
}

function candidateUrls(company: { website: string | null; careers_url: string | null }): string[] {
  const urls = new Set<string>();
  if (company.careers_url) urls.add(company.careers_url);
  if (company.website) {
    urls.add(company.website);
    try {
      const origin = new URL(company.website).origin;
      for (const path of ["/contact", "/contact-us", "/careers", "/jobs", "/about", "/about-us"]) {
        urls.add(`${origin}${path}`);
      }
    } catch {
      // Ignore malformed website URLs.
    }
  }
  return [...urls];
}

export async function discoverCompanyContacts(companyId: string): Promise<CompanyContactRecord[]> {
  const company = await get<{ id: string; name: string; website: string | null; careers_url: string | null }>(
    "SELECT id, name, website, careers_url FROM companies WHERE id = ?",
    [companyId],
  );
  if (!company) throw new Error("Company not found.");

  const companyDomain = registrableDomain(domainOf(company.website || company.careers_url));
  const found = new Map<string, { email: string; sourceUrl: string }>();

  for (const url of candidateUrls(company)) {
    try {
      const page = await fetchPage(url, { timeoutMs: 15000 });
      if (page.status >= 400) continue;
      for (const email of extractEmails(page.text)) {
        if (!found.has(email)) found.set(email, { email, sourceUrl: page.finalUrl || url });
      }
    } catch {
      // Ignore unreachable pages; contact discovery is best-effort.
    }
  }

  const contacts: CompanyContactRecord[] = [];
  for (const { email, sourceUrl } of found.values()) {
    const emailDomain = registrableDomain(domainOf(email));
    const verified = Boolean(companyDomain) && emailDomain === companyDomain;
    const verificationStatus: "verified" | "unverified" = verified ? "verified" : "unverified";
    const role = inferRole(email);
    const now = nowIso();

    const existing = await get<{ id: string }>("SELECT id FROM company_contacts WHERE company_id = ? AND email = ?", [companyId, email]);
    if (existing) {
      await run(
        "UPDATE company_contacts SET role = ?, source_url = ?, verification_status = ? WHERE id = ?",
        [role, sourceUrl, verificationStatus, existing.id],
      );
      contacts.push({ id: existing.id, companyId, name: null, role, email, linkedinUrl: null, sourceUrl, verificationStatus, createdAt: now });
    } else {
      const id = newId("cnt");
      await run(
        "INSERT INTO company_contacts (id, company_id, name, role, email, linkedin_url, source_url, verification_status, created_at) VALUES (?, ?, NULL, ?, ?, NULL, ?, ?, ?)",
        [id, companyId, role, email, sourceUrl, verificationStatus, now],
      );
      contacts.push({ id, companyId, name: null, role, email, linkedinUrl: null, sourceUrl, verificationStatus, createdAt: now });
    }
  }

  return contacts.sort((a, b) => {
    if (a.verificationStatus !== b.verificationStatus) return a.verificationStatus === "verified" ? -1 : 1;
    return Number(isRoleEmail(b.email)) - Number(isRoleEmail(a.email));
  });
}

export async function getCompanyContacts(companyId: string): Promise<CompanyContactRecord[]> {
  const rows = await all<any>("SELECT * FROM company_contacts WHERE company_id = ? ORDER BY verification_status, created_at", [companyId]);
  return rows.map((row: any) => ({
    id: String(row.id),
    companyId: String(row.company_id),
    name: row.name ? String(row.name) : null,
    role: row.role ? String(row.role) : null,
    email: String(row.email),
    linkedinUrl: row.linkedin_url ? String(row.linkedin_url) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    verificationStatus: row.verification_status === "verified" ? "verified" : "unverified",
    createdAt: String(row.created_at),
  }));
}

export async function getVerifiedRecruiterContact(companySlug: string): Promise<CompanyContactRecord | null> {
  const company = await get<{ id: string }>("SELECT id FROM companies WHERE slug = ?", [companySlug]);
  if (!company) return null;
  const rows = await all<any>(
    "SELECT * FROM company_contacts WHERE company_id = ? AND verification_status = 'verified' ORDER BY created_at ASC",
    [company.id],
  );
  const preferred = rows.find((row: any) => isRoleEmail(String(row.email))) || rows[0];
  if (!preferred) return null;
  return {
    id: String(preferred.id),
    companyId: company.id,
    name: preferred.name ? String(preferred.name) : null,
    role: preferred.role ? String(preferred.role) : null,
    email: String(preferred.email),
    linkedinUrl: preferred.linkedin_url ? String(preferred.linkedin_url) : null,
    sourceUrl: preferred.source_url ? String(preferred.source_url) : null,
    verificationStatus: "verified",
    createdAt: String(preferred.created_at),
  };
}
