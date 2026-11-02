import { fetchPage } from "../sources/http";
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
  let finalUrl = input.url.trim();

  if (!/^https?:\/\//i.test(finalUrl)) throw new Error("Job URL must start with http:// or https://.");

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
        finalUrl = page.finalUrl || finalUrl;
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
