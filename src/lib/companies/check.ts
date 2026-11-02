import { get, run, nowIso, newId } from "../db";
import { fetchPage } from "../sources/http";
import { parseLocation } from "../normalize";

interface CompanyPageResult {
  companyId: string;
  url: string;
  status: "checked" | "unreachable" | "blocked";
  jobLinks: number;
  keywords: string[];
  lastCheckedAt: string;
  error?: string;
}

export async function checkCompanyCareerPage(companyId: string): Promise<CompanyPageResult> {
  const company = await get<{ id: string; name: string; careers_url: string | null }>("SELECT id, name, careers_url FROM companies WHERE id = ?", [companyId]);
  if (!company?.careers_url) throw new Error("Company has no careers URL.");
  const url = company.careers_url;
  const checkedAt = nowIso();
  try {
    const page = await fetchPage(url, { timeoutMs: 20_000 });
    if (page.status >= 400) {
      await run("UPDATE company_career_pages SET status='unreachable', last_checked_at=? WHERE company_id=? AND url=?", [checkedAt, companyId, url]);
      return { companyId, url, status: "unreachable", jobLinks: 0, keywords: [], lastCheckedAt: checkedAt, error: `HTTP ${page.status}` };
    }
    const html = page.text;
    const jobLinkMatches = html.match(/href="[^"]*(?:job|career|position|vacancy|opening)[^"]*"/gi) ?? [];
    const keywords = ["engineer", "developer", "analyst", "manager", "trainee", "intern", "support", "operations"]
      .filter((word) => new RegExp(word, "i").test(html));
    const status = jobLinkMatches.length > 0 ? "checked" : "checked";
    await run("UPDATE company_career_pages SET status=?, last_checked_at=?, verified_at=? WHERE company_id=? AND url=?", [status, checkedAt, checkedAt, companyId, url]);
    return { companyId, url, status: "checked", jobLinks: jobLinkMatches.length, keywords, lastCheckedAt: checkedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await run("UPDATE company_career_pages SET status='unreachable', last_checked_at=? WHERE company_id=? AND url=?", [checkedAt, companyId, url]);
    return { companyId, url, status: "unreachable", jobLinks: 0, keywords: [], lastCheckedAt: checkedAt, error: message };
  }
}







