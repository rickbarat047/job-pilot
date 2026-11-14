const ATS_HOSTS: Record<string, string[]> = {
  greenhouse: ["greenhouse.io"],
  lever: ["lever.co"],
  ashby: ["ashbyhq.com"],
  smartrecruiters: ["smartrecruiters.com"],
  workday: ["myworkdayjobs.com", "workday.com"],
};

/** Return an ATS adapter only for HTTPS URLs on an actual ATS domain. */
export function supportedAtsForUrl(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  for (const [ats, domains] of Object.entries(ATS_HOSTS)) {
    if (domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return ats;
  }
  return null;
}
