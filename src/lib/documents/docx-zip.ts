// Structural validation for DOCX (Office Open XML / ZIP) uploads.
// Uses only Node built-ins: the ZIP central directory is parsed directly and
// entry payloads are inflated with node:zlib. Nothing is ever extracted to disk.

import { inflateRawSync } from "node:zlib";

const MAX_ENTRIES = 128;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const MAX_EOCD_SEARCH_BYTES = 64 * 1024 + 22;

// Bits 1, 2 (compression hints), 3 (data descriptor) and 11 (UTF-8 names) are
// benign. Encryption, strong encryption, patched headers and reserved bits are not.
const ALLOWED_GENERAL_PURPOSE_FLAGS = 0x080e;

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_SENTINEL = 0xffffffff;

const CONTENT_TYPES_PART = "[Content_Types].xml";
const RELS_PART = "_rels/.rels";
const DOCUMENT_PART = "word/document.xml";

const CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const RELATIONSHIPS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const WORDPROCESSINGML_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

class InvalidDocxError extends Error {}

function fail(message: string): never {
  throw new InvalidDocxError(message);
}

function readU16(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.length) fail("Truncated ZIP structure.");
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) fail("Truncated ZIP structure.");
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.length - MAX_EOCD_SEARCH_BYTES);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (readU32(bytes, offset) !== EOCD_SIGNATURE) continue;
    const commentLength = readU16(bytes, offset + 20);
    // The EOCD comment must end exactly at EOF, otherwise this is a forged or
    // trailing-data archive.
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  return -1;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    value = CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function safeEntryName(nameBytes: Uint8Array): string {
  if (nameBytes.length === 0) fail("Archive contains an empty entry name.");
  for (const byte of nameBytes) {
    if (byte === 0x00 || byte === 0x5c) fail("Archive contains an unsafe entry name.");
  }

  let name = "";
  try {
    name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
  } catch {
    fail("Archive contains a non-UTF-8 entry name.");
  }

  if (/^[A-Za-z]:/.test(name)) fail("Archive contains an absolute entry path.");
  const segments = name.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") {
      fail("Archive contains an unsafe entry path.");
    }
  }
  return name;
}

// Verify an XML part starts with a declaration and has the expected root
// element bound to the expected OOXML namespace.
function hasExpectedXmlRoot(part: Uint8Array, rootName: string, namespace: string): boolean {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(part);
  } catch {
    return false;
  }
  text = text.replace(/^\uFEFF/, "");
  const declaration = /^<\?xml\s+version\s*=\s*["']1\.[01]["'][^?]*\?>/.exec(text);
  if (!declaration) return false;

  let index = declaration[0].length;
  let rest = text;
  // Tolerate whitespace, comments and processing instructions before the root.
  for (;;) {
    while (index < rest.length && /\s/.test(rest[index])) index += 1;
    if (rest.startsWith("<!--", index)) {
      const end = rest.indexOf("-->", index + 4);
      if (end < 0) return false;
      index = end + 3;
      continue;
    }
    if (rest.startsWith("<?", index)) {
      const end = rest.indexOf("?>", index + 2);
      if (end < 0) return false;
      index = end + 2;
      continue;
    }
    break;
  }

  if (rest[index] !== "<" || /[/?!]/.test(rest[index + 1] ?? "")) return false;
  const tagEnd = rest.indexOf(">", index + 1);
  if (tagEnd < 0) return false;
  const tag = rest.slice(index + 1, tagEnd);
  const match = /^([A-Za-z_][\w.\-]*)(?::([A-Za-z_][\w.\-]*))?/.exec(tag);
  if (!match) return false;
  return (match[2] ?? match[1]) === rootName && tag.includes(namespace);
}

/**
 * Validate that `bytes` is a self-consistent, bounded DOCX (OOXML ZIP) archive.
 * Returns null when valid, otherwise a human-readable rejection reason.
 */
export function validateDocxArchive(bytes: Uint8Array): string | null {
  try {
    if (bytes.length < 22) return "The DOCX archive is truncated or invalid.";

    const eocd = findEndOfCentralDirectory(bytes);
    if (eocd < 0) return "The DOCX archive has no valid directory.";

    const diskNumber = readU16(bytes, eocd + 4);
    const centralDirectoryDisk = readU16(bytes, eocd + 6);
    const entriesOnDisk = readU16(bytes, eocd + 8);
    const totalEntries = readU16(bytes, eocd + 10);
    const centralDirectorySize = readU32(bytes, eocd + 12);
    const centralDirectoryOffset = readU32(bytes, eocd + 16);

    if (diskNumber !== 0 || centralDirectoryDisk !== 0) {
      return "Multi-disk DOCX archives are not supported.";
    }
    if (entriesOnDisk !== totalEntries || totalEntries === 0 || totalEntries > MAX_ENTRIES) {
      return "The DOCX archive has an invalid number of entries.";
    }
    if (
      totalEntries === 0xffff ||
      centralDirectorySize === ZIP64_SENTINEL ||
      centralDirectoryOffset === ZIP64_SENTINEL
    ) {
      return "ZIP64 DOCX archives are not supported.";
    }
    if (centralDirectoryOffset + centralDirectorySize !== eocd) {
      return "The DOCX central directory is inconsistent.";
    }

    const parts = new Map<string, Uint8Array>();
    const seenNames = new Set<string>();
    let totalUncompressed = 0;
    let cursor = centralDirectoryOffset;
    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

    for (let index = 0; index < totalEntries; index += 1) {
      if (cursor + 46 > centralDirectoryEnd) return "The DOCX central directory is truncated.";
      if (readU32(bytes, cursor) !== CENTRAL_HEADER_SIGNATURE) {
        return "The DOCX central directory is malformed.";
      }

      const flags = readU16(bytes, cursor + 8);
      const method = readU16(bytes, cursor + 10);
      const crc = readU32(bytes, cursor + 16);
      const compressedSize = readU32(bytes, cursor + 20);
      const uncompressedSize = readU32(bytes, cursor + 24);
      const nameLength = readU16(bytes, cursor + 28);
      const extraLength = readU16(bytes, cursor + 30);
      const commentLength = readU16(bytes, cursor + 32);
      const localHeaderOffset = readU32(bytes, cursor + 42);
      const nameStart = cursor + 46;
      const nextCursor = nameStart + nameLength + extraLength + commentLength;
      if (nextCursor > centralDirectoryEnd) return "The DOCX central directory is truncated.";

      const nameBytes = bytes.subarray(nameStart, nameStart + nameLength);
      const name = safeEntryName(nameBytes);
      if (seenNames.has(name)) return "The DOCX archive contains duplicate entries.";
      seenNames.add(name);

      if ((flags & ~ALLOWED_GENERAL_PURPOSE_FLAGS) !== 0) {
        return "The DOCX archive uses unsupported or encrypted ZIP flags.";
      }
      if (method !== 0 && method !== 8) {
        return "The DOCX archive uses an unsupported compression method.";
      }
      if (compressedSize === ZIP64_SENTINEL || uncompressedSize === ZIP64_SENTINEL) {
        return "ZIP64 DOCX archives are not supported.";
      }

      totalUncompressed += uncompressedSize;
      if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        return "The DOCX archive expands beyond the safe size limit.";
      }
      if (uncompressedSize > 0) {
        if (compressedSize === 0 || uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO) {
          return "The DOCX archive contains an unsafe compression ratio.";
        }
      }

      if (localHeaderOffset + 30 > centralDirectoryOffset) {
        return "The DOCX archive has an invalid entry offset.";
      }
      if (readU32(bytes, localHeaderOffset) !== LOCAL_HEADER_SIGNATURE) {
        return "The DOCX archive has a malformed entry header.";
      }
      const localFlags = readU16(bytes, localHeaderOffset + 6);
      const localMethod = readU16(bytes, localHeaderOffset + 8);
      const localNameLength = readU16(bytes, localHeaderOffset + 26);
      const localExtraLength = readU16(bytes, localHeaderOffset + 28);
      if ((localFlags & ~ALLOWED_GENERAL_PURPOSE_FLAGS) !== 0) {
        return "The DOCX archive has unsupported local ZIP flags.";
      }
      if (localMethod !== method || localNameLength !== nameLength) {
        return "The DOCX archive entry header does not match its directory.";
      }
      const localName = bytes.subarray(localHeaderOffset + 30, localHeaderOffset + 30 + localNameLength);
      if (!bytesEqual(localName, nameBytes)) {
        return "The DOCX archive entry name does not match its directory.";
      }

      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataStart < localHeaderOffset || dataEnd < dataStart || dataEnd > centralDirectoryOffset) {
        return "The DOCX archive has a truncated entry.";
      }

      let content: Uint8Array;
      if (method === 0) {
        content = bytes.subarray(dataStart, dataEnd);
        if (content.length !== uncompressedSize) return "The DOCX archive has a truncated entry.";
      } else {
        try {
          const inflated = inflateRawSync(bytes.subarray(dataStart, dataEnd), {
            maxOutputLength: Math.max(uncompressedSize, 1),
          });
          content = new Uint8Array(inflated);
        } catch {
          return "The DOCX archive contains an invalid compressed part.";
        }
        if (content.length !== uncompressedSize) {
          return "The DOCX archive part size does not match its directory.";
        }
      }

      if (crc32(content) !== crc) return "The DOCX archive contains a corrupt part.";
      parts.set(name, content);
      cursor = nextCursor;
    }

    if (cursor !== centralDirectoryEnd) return "The DOCX central directory is inconsistent.";

    for (const required of [CONTENT_TYPES_PART, DOCUMENT_PART, RELS_PART]) {
      if (!parts.has(required)) return "The DOCX archive is missing required parts.";
    }

    if (
      !hasExpectedXmlRoot(parts.get(CONTENT_TYPES_PART)!, "Types", CONTENT_TYPES_NS) ||
      !hasExpectedXmlRoot(parts.get(DOCUMENT_PART)!, "document", WORDPROCESSINGML_NS) ||
      !hasExpectedXmlRoot(parts.get(RELS_PART)!, "Relationships", RELATIONSHIPS_NS)
    ) {
      return "The DOCX archive contains invalid Office XML parts.";
    }

    return null;
  } catch {
    return "The DOCX archive is malformed or truncated.";
  }
}
