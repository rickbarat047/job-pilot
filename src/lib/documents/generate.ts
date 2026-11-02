import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { ResumeContent, CoverLetterContent } from "../types";
import path from "node:path";
import { writeFile } from "../storage";

export interface GeneratedDocument {
  pdfPath: string;
  docxPath: string;
}

function sanitizeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "document";
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const result: string[] = [];
  let current = "";
  for (const word of words) {
    if (!word) continue;
    if ((current + " " + word).trim().length > maxChars) {
      if (current) result.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) result.push(current);
  return result.length ? result : [""];
}

export async function generateResumeDocuments(baseDir: string, resume: ResumeContent): Promise<GeneratedDocument> {
  const slug = sanitizeSegment(`${resume.targetRole}-${resume.company}`);
  const pdfRelative = path.posix.join(baseDir, "resume", `${slug}.pdf`);
  const docxRelative = path.posix.join(baseDir, "resume", `${slug}.docx`);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - 50;
  const draw = (text: string, size = 10, isBold = false, gap = 4) => {
    const currentFont = isBold ? bold : font;
    const lines = wrapText(text, 95);
    for (const line of lines) {
      if (y < 60) { page = pdf.addPage([595, 842]); y = height - 50; }
      page.drawText(line, { x: 50, y, size, font: currentFont, color: rgb(0.1, 0.1, 0.1) });
      y -= size + gap;
    }
  };
  draw(resume.header.name, 16, true, 2);
  draw(resume.header.headline, 10, false, 6);
  draw([resume.header.email, resume.header.phone, resume.header.location, resume.header.linkedin, resume.header.github, resume.header.portfolio].filter(Boolean).join(" | "), 8, false, 10);
  draw("Summary", 12, true, 4);
  draw(resume.summary, 10, false, 8);
  draw("Skills", 12, true, 4);
  draw(resume.skills.join(", "), 10, false, 8);
  if (resume.experience.length || resume.internships.length) {
    draw("Experience", 12, true, 4);
  }
  for (const item of resume.experience) {
    draw(`${item.role} — ${item.company}`, 10.5, true, 2);
    if (item.startDate || item.endDate) draw(`${item.startDate ?? ""} to ${item.endDate ?? ""}${item.location ? " | " + item.location : ""}`, 8.5, false, 2);
    draw(item.description, 9.5, false, 6);
    for (const highlight of item.highlights ?? []) draw(`• ${highlight}`, 9.5, false, 2);
  }
  if (resume.internships.length) {
    draw("Internships", 12, true, 4);
    for (const item of resume.internships) {
      draw(`${item.role} — ${item.company}`, 10.5, true, 2);
      draw(item.description, 9.5, false, 6);
    }
  }
  if (resume.projects.length) {
    draw("Projects", 12, true, 4);
  }
  for (const project of resume.projects) {
    draw(project.name, 10.5, true, 2);
    draw(project.description, 9.5, false, 2);
    if (project.technologies?.length) draw(`Technologies: ${project.technologies.join(", ")}`, 8.5, false, 6);
  }
  draw("Education", 12, true, 4);
  for (const edu of resume.education) {
    draw(`${edu.degree}${edu.field ? " in " + edu.field : ""} — ${edu.university}`, 10, true, 2);
    draw(`${edu.graduationYear ?? ""}${edu.score ? " | " + edu.score : ""}`, 8.5, false, 6);
  }
  if (resume.certifications.length) {
    draw("Certifications", 12, true, 4);
    for (const cert of resume.certifications) draw(`• ${cert}`, 9.5, false, 2);
  }
  if (resume.languages.length) {
    draw("Languages", 12, true, 4);
    draw(resume.languages.join(", "), 9.5, false, 6);
  }
  const pdfBytes = await pdf.save();
  await writeFile(pdfRelative, Buffer.from(pdfBytes));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: resume.header.name, heading: HeadingLevel.TITLE }),
        new Paragraph({ text: resume.header.headline }),
        new Paragraph({ text: [resume.header.email, resume.header.phone, resume.header.location].filter(Boolean).join(" | ") }),
        new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: resume.summary }),
        new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: resume.skills.join(", ") }),
        ...(resume.experience.length || resume.internships.length ? [new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2 })] : []),
        ...resume.experience.flatMap((item) => [
          new Paragraph({ children: [new TextRun({ text: `${item.role} — ${item.company}`, bold: true })] }),
          new Paragraph({ text: item.description }),
          ...(item.highlights ?? []).map((h) => new Paragraph({ text: `• ${h}` })),
        ]),
        ...(resume.internships.length ? [
          new Paragraph({ text: "Internships", heading: HeadingLevel.HEADING_2 }),
          ...resume.internships.flatMap((item) => [new Paragraph({ children: [new TextRun({ text: `${item.role} — ${item.company}`, bold: true })] }), new Paragraph({ text: item.description })]),
        ] : []),
        ...(resume.projects.length ? [new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_2 })] : []),
        ...resume.projects.flatMap((project) => [
          new Paragraph({ children: [new TextRun({ text: project.name, bold: true })] }),
          new Paragraph({ text: project.description }),
          ...(project.technologies?.length ? [new Paragraph({ text: `Technologies: ${project.technologies.join(", ")}` })] : []),
        ]),
        new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_2 }),
        ...resume.education.map((edu) => new Paragraph({ text: `${edu.degree}${edu.field ? " in " + edu.field : ""} — ${edu.university} ${edu.graduationYear ?? ""} ${edu.score ?? ""}`.trim() })),
        ...(resume.certifications.length ? [new Paragraph({ text: "Certifications", heading: HeadingLevel.HEADING_2 }), ...resume.certifications.map((c) => new Paragraph({ text: `• ${c}` }))] : []),
        ...(resume.languages.length ? [new Paragraph({ text: "Languages", heading: HeadingLevel.HEADING_2 }), new Paragraph({ text: resume.languages.join(", ") })] : []),
      ],
    }],
  });
  const docxBytes = await Packer.toBuffer(doc);
  await writeFile(docxRelative, Buffer.from(docxBytes));
  return { pdfPath: pdfRelative, docxPath: docxRelative };
}

export async function generateCoverLetterDocuments(baseDir: string, coverLetter: CoverLetterContent, profileName: string): Promise<GeneratedDocument> {
  const slug = sanitizeSegment(`${coverLetter.targetRole}-${coverLetter.company}`);
  const pdfRelative = path.posix.join(baseDir, "cover-letter", `${slug}.pdf`);
  const docxRelative = path.posix.join(baseDir, "cover-letter", `${slug}.docx`);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  const { height } = page.getSize();
  let y = height - 50;
  const draw = (text: string, size = 11, isBold = false, gap = 6) => {
    const currentFont = isBold ? bold : font;
    for (const line of wrapText(text, 95)) {
      if (y < 60) { page = pdf.addPage([595, 842]); y = height - 50; }
      page.drawText(line, { x: 50, y, size, font: currentFont, color: rgb(0.1, 0.1, 0.1) });
      y -= size + gap;
    }
  };
  draw(profileName || "Candidate", 14, true, 4);
  draw(coverLetter.text, 10.5, false, 4);
  const pdfBytes = await pdf.save();
  await writeFile(pdfRelative, Buffer.from(pdfBytes));

  const doc = new Document({
    sections: [{
      children: coverLetter.text.split(/\n\n+/).map((para) => new Paragraph({ text: para })),
    }],
  });
  const docxBytes = await Packer.toBuffer(doc);
  await writeFile(docxRelative, Buffer.from(docxBytes));
  return { pdfPath: pdfRelative, docxPath: docxRelative };
}






