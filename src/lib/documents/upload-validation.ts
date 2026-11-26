// Allowlist validation for CV/document uploads. Never trust client MIME type or
// filename extension alone: both must agree with the file's magic bytes.

import { validateDocxArchive } from "./docx-zip";

export interface CvUploadInput {
  name: string;
  type: string;
  size: number;
  bytes: Uint8Array;
}

export interface CvUploadValidation {
  ok: boolean;
  extension?: string;
  error?: string;
}

export const MAX_CV_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED = {
  pdf: {
    mime: "application/pdf",
    magic: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    magic: [0x50, 0x4b, 0x03, 0x04], // PK\x03\x04
  },
} as const;

export function validateCvUpload({ name, type, size, bytes }: CvUploadInput): CvUploadValidation {
  if (!bytes || bytes.length === 0 || size <= 0) {
    return { ok: false, error: "Empty upload." };
  }
  if (size > MAX_CV_UPLOAD_BYTES) {
    return { ok: false, error: "File is too large. Maximum size is 10 MB." };
  }

  const extension = String(name || "").toLowerCase().split(".").pop() || "";
  const rule = ALLOWED[extension as keyof typeof ALLOWED];
  if (!rule) {
    return { ok: false, error: "Unsupported file type. Only PDF and DOCX files are accepted." };
  }

  if (String(type || "").toLowerCase() !== rule.mime) {
    return { ok: false, error: "The file type does not match its extension." };
  }

  if (bytes.length < rule.magic.length) {
    return { ok: false, error: "The file is truncated or invalid." };
  }
  for (let index = 0; index < rule.magic.length; index += 1) {
    if (bytes[index] !== rule.magic[index]) {
      return { ok: false, error: "The file content does not match its extension." };
    }
  }

  // A DOCX is a ZIP archive; the 4-byte magic alone proves nothing. Parse and
  // validate its OOXML structure before accepting the upload.
  if (extension === "docx") {
    const archiveError = validateDocxArchive(bytes);
    if (archiveError) {
      return { ok: false, error: archiveError };
    }
  }

  return { ok: true, extension };
}
