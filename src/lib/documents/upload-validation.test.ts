import { describe, it, expect } from "vitest";
import { validateCvUpload } from "./upload-validation";

const pdfBytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const docxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

describe("validateCvUpload", () => {
  it("accepts a real PDF with matching extension and MIME type", () => {
    const result = validateCvUpload({
      name: "My CV.pdf",
      type: "application/pdf",
      size: pdfBytes.length,
      bytes: pdfBytes,
    });
    expect(result.ok).toBe(true);
    expect(result.extension).toBe("pdf");
  });

  it("accepts a real DOCX with matching extension and MIME type", () => {
    const result = validateCvUpload({
      name: "resume.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: docxBytes.length,
      bytes: docxBytes,
    });
    expect(result.ok).toBe(true);
    expect(result.extension).toBe("docx");
  });

  it("rejects an executable regardless of filename", () => {
    const result = validateCvUpload({
      name: "cv.exe",
      type: "application/octet-stream",
      size: 10,
      bytes: new Uint8Array([0x4d, 0x5a]),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a PDF whose extension is .txt", () => {
    const result = validateCvUpload({
      name: "cv.txt",
      type: "application/pdf",
      size: pdfBytes.length,
      bytes: pdfBytes,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a file whose magic bytes do not match its extension", () => {
    const result = validateCvUpload({
      name: "cv.pdf",
      type: "application/pdf",
      size: docxBytes.length,
      bytes: docxBytes,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a MIME type that does not match the extension", () => {
    const result = validateCvUpload({
      name: "cv.pdf",
      type: "text/plain",
      size: pdfBytes.length,
      bytes: pdfBytes,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects empty and oversized uploads", () => {
    expect(
      validateCvUpload({ name: "cv.pdf", type: "application/pdf", size: 0, bytes: pdfBytes }).ok,
    ).toBe(false);
    expect(
      validateCvUpload({
        name: "cv.pdf",
        type: "application/pdf",
        size: 11 * 1024 * 1024,
        bytes: pdfBytes,
      }).ok,
    ).toBe(false);
  });
});
