import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { validateCvUpload } from "./upload-validation";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const encoder = new TextEncoder();

const pdfBytes = encoder.encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");

// --- Minimal ZIP writer used to craft valid and malicious archives. ---------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value & 0xffff, true);
  return out;
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let position = 0;
  for (const part of parts) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

interface EntrySpec {
  name: string;
  content: string;
  method?: number;
  flags?: number;
  crc?: number;
  compressedSize?: number;
  uncompressedSize?: number;
  localNameBytes?: Uint8Array;
  centralNameBytes?: Uint8Array;
  localFlags?: number;
  localMethod?: number;
}

function makeZip(
  entries: EntrySpec[],
  options: { eocdEntries?: number; cdOffset?: number; cdSize?: number } = {},
): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const contentBytes = encoder.encode(entry.content);
    const method = entry.method ?? 8;
    const flags = entry.flags ?? 0;
    const compressed = method === 8 ? deflateRawSync(contentBytes) : contentBytes;
    const crc = entry.crc ?? crc32(contentBytes);
    const compressedSize = entry.compressedSize ?? compressed.length;
    const uncompressedSize = entry.uncompressedSize ?? contentBytes.length;
    const localName = entry.localNameBytes ?? nameBytes;
    const centralName = entry.centralNameBytes ?? nameBytes;

    locals.push(
      concat([
        u32(0x04034b50), u16(20), u16(entry.localFlags ?? flags), u16(entry.localMethod ?? method),
        u16(0), u16(0), u32(crc), u32(compressedSize), u32(uncompressedSize),
        u16(localName.length), u16(0), localName, compressed,
      ]),
    );
    centrals.push(
      concat([
        u32(0x02014b50), u16(20), u16(20), u16(flags), u16(method),
        u16(0), u16(0), u32(crc), u32(compressedSize), u32(uncompressedSize),
        u16(centralName.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), centralName,
      ]),
    );
    offset += locals[locals.length - 1].length;
  }

  const centralDirectory = concat(centrals);
  const eocd = concat([
    u32(0x06054b50), u16(0), u16(0),
    u16(options.eocdEntries ?? entries.length), u16(options.eocdEntries ?? entries.length),
    u32(options.cdSize ?? centralDirectory.length), u32(options.cdOffset ?? offset), u16(0),
  ]);
  return concat([...locals, centralDirectory, eocd]);
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const DOCUMENT =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>';

function validEntries(): EntrySpec[] {
  return [
    { name: "[Content_Types].xml", content: CONTENT_TYPES },
    { name: "_rels/.rels", content: RELS },
    { name: "word/document.xml", content: DOCUMENT },
  ];
}

function validateDocx(bytes: Uint8Array) {
  return validateCvUpload({ name: "cv.docx", type: DOCX_MIME, size: bytes.length, bytes });
}

// --- Tests -----------------------------------------------------------------

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

  it("accepts a valid minimal DOCX archive with deflated parts", () => {
    const result = validateDocx(makeZip(validEntries()));
    expect(result.ok).toBe(true);
    expect(result.extension).toBe("docx");
  });

  it("accepts a valid DOCX archive with stored (uncompressed) parts", () => {
    const entries = validEntries().map((entry) => ({ ...entry, method: 0 }));
    expect(validateDocx(makeZip(entries)).ok).toBe(true);
  });

  it("accepts a valid DOCX with additional harmless parts", () => {
    const entries = [
      ...validEntries(),
      { name: "word/styles.xml", content: '<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>' },
      { name: "docProps/core.xml", content: '<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"/>' },
    ];
    expect(validateDocx(makeZip(entries)).ok).toBe(true);
  });

  it("rejects a fake DOCX that only has the ZIP magic bytes", () => {
    const fake = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    expect(validateDocx(fake).ok).toBe(false);
  });

  it("rejects an archive missing word/document.xml", () => {
    const entries = validEntries().filter((entry) => entry.name !== "word/document.xml");
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects an archive missing [Content_Types].xml", () => {
    const entries = validEntries().filter((entry) => entry.name !== "[Content_Types].xml");
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects an archive missing _rels/.rels", () => {
    const entries = validEntries().filter((entry) => entry.name !== "_rels/.rels");
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects document.xml without an XML declaration", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "word/document.xml"
        ? { ...entry, content: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>' }
        : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects document.xml with the wrong root element", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "word/document.xml"
        ? { ...entry, content: '<?xml version="1.0"?><w:sheet xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>' }
        : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects document.xml with the wrong namespace", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "word/document.xml"
        ? { ...entry, content: '<?xml version="1.0"?><w:document xmlns:w="http://example.com/evil"><w:body/></w:document>' }
        : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects [Content_Types].xml with the wrong root element", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "[Content_Types].xml"
        ? { ...entry, content: '<?xml version="1.0"?><NotTypes xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' }
        : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects _rels/.rels with the wrong root element", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "_rels/.rels"
        ? { ...entry, content: '<?xml version="1.0"?><Bogus xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' }
        : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects duplicate entry names", () => {
    const entries = [...validEntries(), { name: "word/document.xml", content: DOCUMENT }];
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects path traversal in an entry name", () => {
    const entries = [...validEntries(), { name: "word/../../evil.xml", content: "x" }];
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects an absolute path in an entry name", () => {
    const entries = [...validEntries(), { name: "/word/evil.xml", content: "x" }];
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects a Windows drive path in an entry name", () => {
    const entries = [...validEntries(), { name: "C:/word/evil.xml", content: "x" }];
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects backslashes in an entry name", () => {
    const entries = [...validEntries(), { name: "word\\evil.xml", content: "x" }];
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects NUL bytes in an entry name", () => {
    const entries = [...validEntries(), { name: "word/evil\u0000.xml", content: "x" }];
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects encrypted entries (general purpose bit 0)", () => {
    const entries = validEntries().map((entry) => ({ ...entry, flags: 0x0001 }));
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects suspicious ZIP flags (strong encryption / masked headers)", () => {
    const entries = validEntries().map((entry) => ({ ...entry, flags: 0x2000 }));
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects an unsupported compression method", () => {
    const entries = validEntries().map((entry) => ({ ...entry, method: 99 }));
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects a truncated archive", () => {
    const zip = makeZip(validEntries());
    expect(validateDocx(zip.subarray(0, zip.length - 8)).ok).toBe(false);
  });

  it("rejects an archive whose EOCD entry count disagrees with the central directory", () => {
    expect(validateDocx(makeZip(validEntries(), { eocdEntries: 2 })).ok).toBe(false);
  });

  it("rejects an archive whose central directory name differs from the local header", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "word/document.xml"
        ? { ...entry, centralNameBytes: encoder.encode("word/evil.xml") }
        : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects an entry with a bad CRC", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "word/document.xml" ? { ...entry, crc: 0 } : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects archives with more than 128 entries", () => {
    const entries = [
      ...validEntries(),
      ...Array.from({ length: 127 }, (_, index) => ({ name: `extra/file${index}.xml`, content: "x" })),
    ];
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects archives whose declared uncompressed size exceeds 60 MB", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "word/document.xml"
        ? { ...entry, method: 0, content: "x", uncompressedSize: 61 * 1024 * 1024 }
        : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects an excessive compression ratio (decompression bomb)", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "word/document.xml"
        ? { ...entry, uncompressedSize: 8 * 1024 * 1024 }
        : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
  });

  it("rejects ZIP64 sentinel sizes", () => {
    const entries = validEntries().map((entry) =>
      entry.name === "word/document.xml" ? { ...entry, uncompressedSize: 0xffffffff } : entry,
    );
    expect(validateDocx(makeZip(entries)).ok).toBe(false);
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
      size: 8,
      bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]),
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
