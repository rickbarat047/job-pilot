import { createHash } from "node:crypto";
import type { EmploymentType, NormalizedJob, RemoteStatus } from "./types";
import { extractSkills } from "./taxonomy";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
  "&mdash;": "—",
  "&ndash;": "–",
  "&bull;": "•",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** Convert untrusted HTML into readable plain text. Never execute or trust it. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr|section|article|ul|ol|table)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

const INDIAN_CITIES = [
  "bengaluru", "bangalore", "mumbai", "pune", "hyderabad", "chennai", "delhi", "new delhi",
  "gurugram", "gurgaon", "noida", "greater noida", "kolkata", "ahmedabad", "jaipur", "indore",
  "coimbatore", "kochi", "cochin", "trivandrum", "thiruvananthapuram", "chandigarh", "lucknow",
  "nagpur", "surat", "vadodara", "baroda", "bhopal", "mysuru", "mysore", "mangaluru", "mangalore",
  "visakhapatnam", "vizag", "vijayawada", "tirupati", "madurai", "tiruchirappalli", "trichy",
  "salem", "hosur", "ooty", "erode", "vellore", "gangaikondan", "pithampur", "sanand", "halol",
  "manesar", "bawal", "rudrapur", "pantnagar", "haridwar", "jamshedpur", "adityapur", "aurangabad",
  "nashik", "kolhapur", "rajkot", "jamnagar", "bhubaneswar", "guwahati", "patna", "ranchi",
  "dehradun", "goa", "panaji", "jodhpur", "udaipur", "ajmer", "raipur", "bilaspur", "jabalpur",
  "gwalior", "agra", "meerut", "kanpur", "varanasi", "allahabad", "prayagraj", "amritsar",
  "ludhiana", "jalandhar", "chandigarh", "mohali", "panchkula", "faridabad", "ghaziabad",
];

const CITY_DISPLAY: Record<string, string> = {
  bengaluru: "Bengaluru", bangalore: "Bengaluru", mumbai: "Mumbai", pune: "Pune",
  hyderabad: "Hyderabad", chennai: "Chennai", delhi: "Delhi", "new delhi": "New Delhi",
  gurugram: "Gurugram", gurgaon: "Gurugram", noida: "Noida", "greater noida": "Greater Noida",
  kolkata: "Kolkata", ahmedabad: "Ahmedabad", jaipur: "Jaipur", indore: "Indore",
  coimbatore: "Coimbatore", kochi: "Kochi", cochin: "Kochi", trivandrum: "Thiruvananthapuram",
  thiruvananthapuram: "Thiruvananthapuram", chandigarh: "Chandigarh", lucknow: "Lucknow",
  nagpur: "Nagpur", surat: "Surat", vadodara: "Vadodara", baroda: "Vadodara", bhopal: "Bhopal",
  mysuru: "Mysuru", mysore: "Mysuru", mangaluru: "Mangaluru", mangalore: "Mangaluru",
  visakhapatnam: "Visakhapatnam", vizag: "Visakhapatnam", vijayawada: "Vijayawada",
  tirupati: "Tirupati", madurai: "Madurai", tiruchirappalli: "Tiruchirappalli", trichy: "Tiruchirappalli",
  salem: "Salem", hosur: "Hosur", erode: "Erode", vellore: "Vellore", gangaikondan: "Gangaikondan",
  pithampur: "Pithampur", sanand: "Sanand", halol: "Halol", manesar: "Manesar", bawal: "Bawal",
  rudrapur: "Rudrapur", pantnagar: "Pantnagar", haridwar: "Haridwar", jamshedpur: "Jamshedpur",
  aurangabad: "Aurangabad", nashik: "Nashik", kolhapur: "Kolhapur", rajkot: "Rajkot",
  bhubaneswar: "Bhubaneswar", guwahati: "Guwahati", patna: "Patna", ranchi: "Ranchi",
  dehradun: "Dehradun", goa: "Goa", panaji: "Panaji", jodhpur: "Jodhpur", udaipur: "Udaipur",
  raipur: "Raipur", jabalpur: "Jabalpur", gwalior: "Gwalior", agra: "Agra", meerut: "Meerut",
  kanpur: "Kanpur", varanasi: "Varanasi", amritsar: "Amritsar", ludhiana: "Ludhiana",
  jalandhar: "Jalandhar", mohali: "Mohali", faridabad: "Faridabad", ghaziabad: "Ghaziabad",
};

export interface ParsedLocation {
  location: string;
  city: string | null;
  country: string;
  remoteStatus: RemoteStatus;
}

export function parseLocation(rawLocation: string, description = "", workplaceType = ""): ParsedLocation {
  const raw = normalizeWhitespace(rawLocation || "");
  const haystack = `${raw} ${workplaceType} ${description.slice(0, 1500)}`.toLowerCase();
  const remoteStatus: RemoteStatus =
    /(^|\b)(fully remote|remote[- ]first|work from anywhere|remote)\b/.test(haystack) && !/remote (india|us|usa|uk|europe|canada|australia) only/.test(haystack)
      ? "remote"
      : /\bhybrid\b/.test(haystack)
        ? "hybrid"
        : raw
          ? "onsite"
          : "unknown";

  if (!raw) {
    return {
      location: remoteStatus === "remote" ? "Remote" : "Location not specified",
      city: null,
      country: /india/i.test(description) ? "India" : "Unknown",
      remoteStatus,
    };
  }

  const lower = raw.toLowerCase();
  const isIndia =
    /\bindia\b|\b(ind|in)\b/.test(lower) ||
    INDIAN_CITIES.some((c) => lower.includes(c)) ||
    /\b(bangalore|bengaluru|mumbai|pune|hyderabad|chennai|gurgaon|noida|kolkata)\b/.test(lower);

  let city: string | null = null;
  for (const candidate of INDIAN_CITIES) {
    if (lower.includes(candidate)) {
      city = CITY_DISPLAY[candidate] ?? candidate;
      break;
    }
  }
  if (!city) {
    const parts = raw.split(/[,|/]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0 && parts[0].length < 40 && !/remote|worldwide|anywhere|india/i.test(parts[0])) {
      city = parts[0].replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  let country = "Unknown";
  if (isIndia) country = "India";
  else if (/\b(usa|united states|us)\b/.test(lower)) country = "United States";
  else if (/\b(uk|united kingdom|england|london)\b/.test(lower)) country = "United Kingdom";
  else if (/\b(canada|toronto|vancouver)\b/.test(lower)) country = "Canada";
  else if (/\b(germany|berlin|munich)\b/.test(lower)) country = "Germany";
  else if (/\b(australia|sydney|melbourne)\b/.test(lower)) country = "Australia";
  else if (/\b(singapore)\b/.test(lower)) country = "Singapore";
  else if (/\b(uae|dubai|abu dhabi)\b/.test(lower)) country = "UAE";
  else if (/worldwide|anywhere|global/.test(lower)) country = "Worldwide";

  return { location: raw, city, country, remoteStatus };
}

export function isIndiaEligibleRemote(location: string, description = ""): boolean {
  const hay = `${location} ${description.slice(0, 800)}`.toLowerCase();
  if (/\bindia\b/.test(hay)) return true;
  if (/worldwide|work from anywhere|anywhere in the world|global remote/.test(hay)) return true;
  if (/remote/.test(hay) && !/only|must be based|must reside|authorized to work|eligible to work/.test(hay)) return true;
  return false;
}

export function detectEmploymentType(title: string, rawType = "", description = ""): EmploymentType {
  const hay = `${title} ${rawType} ${description.slice(0, 1000)}`.toLowerCase();
  if (/\bintern(ship)?\b/.test(hay)) return "internship";
  if (/\bapprentice(ship)?\b/.test(hay)) return "apprenticeship";
  if (/\b(graduate trainee|management trainee|trainee engineer|\bget\b|trainee)\b/.test(hay)) return "trainee";
  if (/\bpart[- ]time\b/.test(hay)) return "part-time";
  if (/\bcontract(or)?\b|\bfixed[- ]term\b|\bconsultant\b/.test(hay)) return "contract";
  if (/\btemporary\b|\bseasonal\b/.test(hay)) return "temporary";
  if (/\bfull[- ]time\b|\bpermanent\b/.test(hay)) return "full-time";
  return "unknown";
}

export function parseExperience(description: string, title = ""): { label: string | null; minYears: number | null; maxYears: number | null; fresherFriendly: boolean } {
  const text = normalizeWhitespace(`${title} ${description.slice(0, 8000)}`).toLowerCase();
  const fresherTitle = /\b(intern|trainee|apprentice|fresher|graduate)\b/.test(title.toLowerCase());
  if (fresherTitle || /\b(fresher|no experience|0[- ]?years?|entry[- ]level|recent graduate)\b/.test(text)) {
    const range = text.match(/(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})\s*(?:\+)?\s*years?/);
    if (range) return { label: `${range[1]}–${range[2]} years`, minYears: Number(range[1]), maxYears: Number(range[2]), fresherFriendly: Number(range[1]) <= 1 };
    return { label: "Fresher / entry-level", minYears: 0, maxYears: 1, fresherFriendly: true };
  }
  const range = text.match(/(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})\s*(?:\+)?\s*years?/);
  if (range) {
    return { label: `${range[1]}–${range[2]} years`, minYears: Number(range[1]), maxYears: Number(range[2]), fresherFriendly: Number(range[1]) === 0 };
  }
  const plus = text.match(/(\d{1,2})\s*\+\s*years?/);
  if (plus) return { label: `${plus[1]}+ years`, minYears: Number(plus[1]), maxYears: null, fresherFriendly: Number(plus[1]) === 0 };
  const min = text.match(/(?:minimum|min\.?|at least|over)\s*(?:of\s*)?(\d{1,2})\s*years?/);
  if (min) return { label: `${min[1]}+ years`, minYears: Number(min[1]), maxYears: null, fresherFriendly: Number(min[1]) === 0 };
  const single = text.match(/(\d{1,2})\s*years?(?:\s+of)?\s+(?:relevant\s+)?experience/);
  if (single) return { label: `${single[1]}+ years`, minYears: Number(single[1]), maxYears: null, fresherFriendly: Number(single[1]) === 0 };
  return { label: null, minYears: null, maxYears: null, fresherFriendly: /\bintern\b/.test(text) };
}

export function parseEducationRequirements(description: string): string | null {
  const text = normalizeWhitespace(description.slice(0, 12000));
  const patterns: { re: RegExp; label: string }[] = [
    { re: /\b(chartered accountant|ca\b|icwa|icai)\b/i, label: "CA / ICWA" },
    { re: /\b(mbbs|md\b|bds|nursing|registered nurse)\b/i, label: "Medical / nursing qualification" },
    { re: /\b(llb|law degree|legal qualification)\b/i, label: "Law degree" },
    { re: /\b(mba|pgdm)\b/i, label: "MBA / PGDM" },
    { re: /\b(b\.?tech|b\.?e\b|bachelor of engineering|engineering degree|be\/btech)\b/i, label: "B.E. / B.Tech" },
    { re: /\b(b\.?sc|bachelor of science)\b/i, label: "B.Sc" },
    { re: /\b(b\.?com|bachelor of commerce)\b/i, label: "B.Com" },
    { re: /\b(diploma)\b/i, label: "Diploma" },
    { re: /\b(any graduate|bachelor'?s degree|graduation)\b/i, label: "Any graduate" },
  ];
  const found = patterns.filter((p) => p.re.test(text)).map((p) => p.label);
  return found.length ? [...new Set(found)].slice(0, 3).join(" / ") : null;
}

export function parseSalary(text: string): { minLpa: number | null; maxLpa: number | null; text: string | null; currency: string | null } {
  const source = normalizeWhitespace(text);
  if (!source) return { minLpa: null, maxLpa: null, text: null, currency: null };
  const inr = /₹|rs\.?|inr|lpa|lakh|lakhs|crore/i.test(source);
  if (!inr) {
    return { minLpa: null, maxLpa: null, text: source.slice(0, 120), currency: /usd|\$/i.test(source) ? "USD" : null };
  }
  const cleaned = source.replace(/,/g, "").toLowerCase();
  const lpaRange = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b)/);
  if (lpaRange) return { minLpa: Number(lpaRange[1]), maxLpa: Number(lpaRange[2]), text: source.slice(0, 120), currency: "INR" };
  const lpaSingle = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b)/);
  if (lpaSingle) return { minLpa: Number(lpaSingle[1]), maxLpa: null, text: source.slice(0, 120), currency: "INR" };
  const rupeeRange = cleaned.match(/(?:₹|rs\.?|inr)\s*(\d{5,9})\s*(?:-|to|–)\s*(?:₹|rs\.?|inr)?\s*(\d{5,9})/);
  if (rupeeRange) return { minLpa: Math.round(Number(rupeeRange[1]) / 100000 * 10) / 10, maxLpa: Math.round(Number(rupeeRange[2]) / 100000 * 10) / 10, text: source.slice(0, 120), currency: "INR" };
  const rupeeSingle = cleaned.match(/(?:₹|rs\.?|inr)\s*(\d{5,9})/);
  if (rupeeSingle) return { minLpa: Math.round(Number(rupeeSingle[1]) / 100000 * 10) / 10, maxLpa: null, text: source.slice(0, 120), currency: "INR" };
  return { minLpa: null, maxLpa: null, text: source.slice(0, 120), currency: "INR" };
}

export function normalizeTitleForFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(urgent|immediate|hiring|job|opening|required|wanted|apply now)\b/g, " ")
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function companySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|llc|corp|corporation|group|india|technologies|technology|solutions|services)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "company";
}

export function jobFingerprint(companyName: string, title: string, city: string | null | undefined): string {
  const base = `${companySlug(companyName)}|${normalizeTitleForFingerprint(title)}|${(city ?? "").toLowerCase()}`;
  return createHash("sha256").update(base).digest("hex");
}

export interface NormalizeInput {
  source: string;
  sourceJobId: string;
  title: string;
  companyName: string;
  companyWebsite?: string | null;
  careerPageUrl?: string | null;
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  location?: string | null;
  workplaceType?: string | null;
  employmentType?: string | null;
  salaryText?: string | null;
  applicationUrl: string;
  applicationMethod?: NormalizedJob["applicationMethod"];
  postedAt?: string | Date | null;
  reliability?: number;
  raw?: unknown;
}

export function buildNormalizedJob(input: NormalizeInput): NormalizedJob {
  const description = stripHtml(input.descriptionHtml) || stripHtml(input.descriptionText);
  const loc = parseLocation(input.location ?? "", description, input.workplaceType ?? "");
  const exp = parseExperience(description, input.title);
  const salary = parseSalary(input.salaryText ?? extractSalarySnippet(description));
  const employmentType = detectEmploymentType(input.title, input.employmentType ?? "", description);
  const skills = extractSkills(`${input.title} ${description}`);
  const postedAt = input.postedAt ? new Date(input.postedAt) : null;
  return {
    id: `${input.source}:${input.sourceJobId}`,
    source: input.source,
    sourceJobId: input.sourceJobId,
    title: normalizeWhitespace(input.title),
    companyName: normalizeWhitespace(input.companyName),
    companySlug: companySlug(input.companyName),
    companyWebsite: input.companyWebsite ?? null,
    careerPageUrl: input.careerPageUrl ?? null,
    description,
    descriptionHtml: input.descriptionHtml ?? null,
    location: loc.location,
    city: loc.city,
    country: loc.country,
    remoteStatus: loc.remoteStatus,
    employmentType,
    experienceRequired: exp.label,
    educationRequirements: parseEducationRequirements(description),
    skillsRequired: skills,
    salaryMin: salary.minLpa,
    salaryMax: salary.maxLpa,
    salaryCurrency: salary.currency,
    salaryText: salary.text,
    applicationUrl: input.applicationUrl,
    applicationMethod: input.applicationMethod ?? "external",
    postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt.toISOString() : null,
    lastVerifiedAt: new Date().toISOString(),
    status: "active",
    reliability: input.reliability ?? 0.8,
    fingerprint: jobFingerprint(input.companyName, input.title, loc.city),
    raw: input.raw,
  };
}

export function extractSalarySnippet(text: string): string {
  const re = /(?:₹|rs\.?|inr)\s?[\d,.]+\s*(?:-|to|–)?\s*(?:₹|rs\.?|inr)?\s?[\d,.]*\s*(?:lpa|lakhs?|per annum|p\.a\.|\/month|per month)?|\b\d+(?:\.\d+)?\s*(?:-|to|–)\s*\d+(?:\.\d+)?\s*lpa\b/gi;
  const match = text.match(re);
  return match?.[0]?.slice(0, 120) ?? "";
}

export function parseIndianCitiesFromText(text: string): string[] {
  const lower = text.toLowerCase();
  return [...new Set(INDIAN_CITIES.filter((c) => lower.includes(c)).map((c) => CITY_DISPLAY[c] ?? c))];
}

export { INDIAN_CITIES, CITY_DISPLAY };
