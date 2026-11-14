import { fetchPage, resolveSafeAddresses } from "../sources/http";
import { buildNormalizedJob, stripHtml } from "../normalize";
import { newId } from "../db";

export interface ManualJobInput {
  url: string;
  title?: string;
  companyName?: string;
  description?: string;
  location?: string;
}

export async function importManualJob(input: ManualJobInput) {
  let title = input.title?.trim() ?? "";
  let company = input.companyName?.trim() ?? "";
  let description = input.description?.trim() ?? "";
  let location = input.location?.trim() ?? "";
  let finalUrl = (input.url ?? "").trim();

  if (!finalUrl) throw new Error("A job URL is required.");
  if (finalUrl.length > 2048) throw new Error("Job URL must be 2,048 characters or fewer.");
  let parsedUrl: URL;
  try { parsedUrl = new URL(finalUrl); } catch { throw new Error("Enter a valid job posting URL."); }
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    throw new Error("Job URL must be a secure https:// link without embedded credentials.");
  }
  await resolveSafeAddresses(parsedUrl.hostname);

  for (const [label, value, max] of [
    ["Role title", title, 200], ["Company name", company, 200], ["Location", location, 200], ["Job description", description, 50_000],
  ] as const) {
    if (value.length > max) throw new Error(`${label} must be ${max.toLocaleString()} characters or fewer.`);
  }

  if (!title || !description) {
    try {
      const page = await fetchPage(finalUrl, { timeoutMs: 20_000 });
      if (page.status < 400) {
        const html = page.text;
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
        const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
        if (!title) title = (ogTitle?.[1] || titleMatch?.[1] || "").trim();
        if (!description) description = stripHtml(ogDesc?.[1] || "");
        const redirectedUrl = new URL(page.finalUrl || finalUrl);
        if (redirectedUrl.protocol !== "https:") throw new Error("Job link redirected to an insecure page.");
        finalUrl = redirectedUrl.toString();
      }
    } catch {
      // Keep manual fields; URL fetch failure is not fatal.
    }
  }

  if (!title) title = "Imported job opportunity";
  if (!company) company = new URL(finalUrl).hostname.replace(/^www\./, "");
  if (!location) location = "Location not specified";

  return buildNormalizedJob({
    source: "manual",
    sourceJobId: newId("manual"),
    title,
    companyName: company,
    descriptionText: description || "Imported from a user-provided link. Review the original posting for full details.",
    location,
    applicationUrl: finalUrl,
    applicationMethod: "external",
    reliability: 0.7,
    raw: { imported: true },
  });
}
