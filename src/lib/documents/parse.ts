import { extractText } from "unpdf";
import mammoth from "mammoth";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WordExtractor = require("word-extractor");
import { extractSkills, canonicalSkill } from "../taxonomy";
import type { ParsedCv, CandidateProject, CandidateExperience, CandidateEducation } from "../types";

export interface ParseResult {
  text: string;
  parsed: ParsedCv;
  warnings: string[];
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+91[\s-]?)?[6-9]\d{9}|\b\d{10}\b/;
const URL_RE = /https?:\/\/[^\s)]+/i;
const LINKEDIN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i;
const GITHUB_RE = /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/?/i;

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function sectionText(text: string, headings: string[]): string {
  const lower = text.toLowerCase();
  const starts = headings.map((h) => lower.indexOf(h.toLowerCase())).filter((i) => i >= 0);
  if (!starts.length) return "";
  const start = Math.min(...starts);
  const after = text.slice(start);
  const nextHeadings = ["experience", "education", "skills", "projects", "certifications", "languages", "summary", "objective", "internship", "achievements", "contact"];
  let end = after.length;
  const lowerAfter = after.toLowerCase();
  for (const h of nextHeadings) {
    const idx = lowerAfter.indexOf(h, 40);
    if (idx > 0 && idx < end) end = idx;
  }
  return after.slice(0, end).trim();
}

function parseName(text: string): string {
  const first = lines(text)[0] ?? "";
  if (first.toLowerCase().includes("resume") || first.toLowerCase().includes("curriculum")) {
    return lines(text)[1] ?? "";
  }
  return first.replace(/[^A-Za-z .'-]/g, "").trim().slice(0, 80);
}

function parseEducation(text: string): CandidateEducation[] {
  const block = sectionText(text, ["education", "academic", "qualification"]);
  const source = block || text;
  const degrees = source.match(/(B\.?\s?Tech|B\.?\s?E|Bachelor of [A-Za-z ]+|M\.?\s?Tech|MBA|B\.?\s?Sc|B\.?\s?Com|Diploma)[^\n]*/gi) ?? [];
  const years = source.match(/\b(19|20)\d{2}\b/g) ?? [];
  const universities = source.match(/(?:University|Institute|College|IIT|NIT|BITS)[^\n]*/gi) ?? [];
  return degrees.slice(0, 4).map((degree, index) => ({
    degree: degree.trim().slice(0, 120),
    field: degree.match(/Automobile|Mechanical|Electrical|Computer|Civil|Electronics|Information Technology/i)?.[0] ?? null,
    university: universities[index]?.trim().slice(0, 120) ?? "",
    graduationYear: years[index] ?? years[0] ?? null,
    score: source.match(/CGPA\s*[:\-]?\s*[\d.]+|Percentage\s*[:\-]?\s*[\d.]+/i)?.[0] ?? null,
  }));
}

function parseExperienceBlock(text: string, heading: string): CandidateExperience[] {
  const block = sectionText(text, [heading]);
  if (!block) return [];
  const chunks = block.split(/\n(?=[A-Z][^\n]{3,80}\n)/).map((c) => c.trim()).filter((c) => c.length > 20);
  const items: CandidateExperience[] = [];
  for (const chunk of chunks.slice(0, 8)) {
    const chunkLines = lines(chunk);
    const role = chunkLines[0]?.slice(0, 80) ?? "Role";
    const company = chunkLines[1]?.slice(0, 80) ?? "Company";
    const dates = chunk.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(?:19|20)\d{2}\s*(?:-|to|–)\s*(?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(?:19|20)\d{2})/i)?.[0] ?? "";
    items.push({
      role,
      company,
      startDate: dates.split(/-|to|–/i)[0]?.trim() || null,
      endDate: dates.split(/-|to|–/i)[1]?.trim() || null,
      location: null,
      description: chunkLines.slice(2).join(" ").slice(0, 1200),
      highlights: chunkLines.slice(2).slice(0, 6),
    });
  }
  return items;
}

function parseProjects(text: string): CandidateProject[] {
  const block = sectionText(text, ["projects", "project"]);
  if (!block) return [];
  const chunks = block.split(/\n(?=[A-Z][^\n]{3,90})/).map((c) => c.trim()).filter((c) => c.length > 20);
  return chunks.slice(0, 8).map((chunk) => {
    const chunkLines = lines(chunk);
    const technologies = extractSkills(chunk).slice(0, 8);
    return {
      name: chunkLines[0]?.slice(0, 90) ?? "Project",
      description: chunkLines.slice(1).join(" ").slice(0, 1200),
      technologies,
      link: chunk.match(URL_RE)?.[0] ?? null,
    };
  });
}

function parseCertifications(text: string): string[] {
  const block = sectionText(text, ["certifications", "certificates", "licenses"]);
  const source = block || text;
  const matches = source.match(/(?:AWS|Azure|GCP|Python|Java|Six Sigma|Lean|AutoCAD|SolidWorks|CATIA|MATLAB|Google|Microsoft|Coursera|Udemy|NPTEL)[^\n]*/gi) ?? [];
  return [...new Set(matches.map((m) => m.trim().slice(0, 120)))].slice(0, 12);
}

function parseLanguages(text: string): string[] {
  const block = sectionText(text, ["languages"]);
  const source = block || text;
  const known = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Urdu"];
  return known.filter((lang) => new RegExp(`\\b${lang}\\b`, "i").test(source));
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await extractText(new Uint8Array(buffer), { mergePages: true });
  const text = (result.text ?? "").trim();
  if (text.length >= 80) return text;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require("@napi-rs/canvas");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createWorker } = require("tesseract.js");

    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    const worker = await createWorker("eng");
    const pages = Math.min(pdf.numPages, 5);
    const chunks: string[] = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, viewport }).promise;
      const { data } = await worker.recognize(canvas.toBuffer("image/png"));
      if (data.text?.trim()) chunks.push(data.text.trim());
    }
    await worker.terminate();
    return chunks.join("\n\n").trim() || text;
  } catch {
    return text;
  }
}

export async function extractImageText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createWorker } = require("tesseract.js");
  const worker = await createWorker("eng");
  const { data } = await worker.recognize(buffer);
  await worker.terminate();
  return (data.text ?? "").trim();
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value ?? "").trim();
}

export async function extractDocText(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractor();
  const document = await extractor.extract(buffer);
  return (document.getBody() ?? "").trim();
}

export function extractPlainText(buffer: Buffer): string {
  return buffer.toString("utf8").trim();
}

export function parseCvText(rawText: string): ParsedCv {
  const text = rawText.replace(/\u0000/g, " ").trim();
  const email = text.match(EMAIL_RE)?.[0] ?? "";
  const phone = text.match(PHONE_RE)?.[0]?.replace(/\s+/g, "") ?? "";
  const linkedin = text.match(LINKEDIN_RE)?.[0] ?? "";
  const github = text.match(GITHUB_RE)?.[0] ?? "";
  const portfolioMatch = text.match(URL_RE)?.[0] ?? "";
  const portfolio = portfolioMatch && !/linkedin|github/i.test(portfolioMatch) ? portfolioMatch : "";
  const skills = extractSkills(text, 40).map((skill) => canonicalSkill(skill));
  const experience = parseExperienceBlock(text, "experience");
  const internships = parseExperienceBlock(text, "internship");
  const projects = parseProjects(text);
  const certifications = parseCertifications(text);
  const education = parseEducation(text);
  const languages = parseLanguages(text);
  const degreeMatch = text.match(/\b(B\.?\s?Tech|B\.?\s?E|Bachelor of [A-Za-z ]+|M\.?\s?Tech|MBA|B\.?\s?Sc|B\.?\s?Com|Diploma)\b[^\n]*/i)?.[0] ?? "";
  const universityMatch = text.match(/(?:University|Institute|College|IIT|NIT|BITS)[^\n]*/i)?.[0] ?? "";
  const graduationYear = text.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
  const cgpa = text.match(/(?:CGPA|GPA|Percentage|Score)\s*[:\-]?\s*[\d.]+/i)?.[0] ?? "";
  const summaryBlock = sectionText(text, ["summary", "objective", "profile", "about"]);
  const summary = summaryBlock ? summaryBlock.replace(/^(summary|objective|profile|about me)\s*/i, "").slice(0, 900) : lines(text).slice(0, 4).join(" ").slice(0, 500);

  return {
    fullName: parseName(text),
    email,
    phone,
    city: "",
    state: "",
    country: "India",
    linkedinUrl: linkedin,
    githubUrl: github,
    portfolioUrl: portfolio,
    degree: degreeMatch.trim().slice(0, 120),
    university: universityMatch.trim().slice(0, 120),
    graduationYear,
    cgpa,
    skills: [...new Set(skills)],
    projects,
    internships,
    experience,
    certifications,
    languages,
    summary,
    rawText: text,
  };
}

export async function parseCv(buffer: Buffer, mimeType: string, filename: string): Promise<ParseResult> {
  const warnings: string[] = [];
  let text = "";
  const lowerName = filename.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || lowerName.endsWith(".docx");
  const isDoc = mimeType === "application/msword" || lowerName.endsWith(".doc");
  const isText = mimeType.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".md");
  const isImage = mimeType.startsWith("image/") || lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".webp");

  if (isPdf) {
    text = await extractPdfText(buffer);
    if (text.length < 80) warnings.push("This PDF appears to be scanned or image-based and OCR could not extract enough text. Paste the CV text manually or upload a DOCX.");
  } else if (isDocx) {
    text = await extractDocxText(buffer);
  } else if (isDoc) {
    text = await extractDocText(buffer);
  } else if (isText) {
    text = extractPlainText(buffer);
  } else if (isImage) {
    text = await extractImageText(buffer);
    if (text.length < 40) warnings.push("OCR could not extract enough text from this image. Try a clearer scan or paste the CV text manually.");
  } else {
    throw new Error("Unsupported file type. Upload a PDF, DOCX, DOC, TXT, PNG, JPG, or WEBP file.");
  }

  if (!text || text.length < 40) {
    throw new Error("No readable text was found in the uploaded file.");
  }
  const parsed = parseCvText(text);
  if (!parsed.email) warnings.push("No email address was detected. Please add it in your profile.");
  if (!parsed.phone) warnings.push("No phone number was detected. Please add it in your profile.");
  if (parsed.skills.length === 0) warnings.push("No skills were detected automatically. Add your skills manually.");
  return { text, parsed, warnings };
}


