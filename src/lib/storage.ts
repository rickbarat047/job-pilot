import path from "node:path";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";

function storageRootPath(): string {
  return path.resolve(process.env.STORAGE_DIR || "./storage");
}

export function storageRoot(): string {
  return storageRootPath();
}

export function userDir(userId: string): string {
  return path.join(storageRootPath(), "users", userId);
}

export function relativeStoragePath(absolutePath: string): string {
  return path.relative(storageRootPath(), absolutePath).replace(/\\/g, "/");
}

export function absoluteStoragePath(relativePath: string): string {
  const resolved = path.resolve(storageRootPath(), relativePath);
  if (!resolved.startsWith(storageRootPath())) throw new Error("Invalid storage path.");
  return resolved;
}

function supabaseStorage() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "jobpilot";
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@supabase/supabase-js");
  return { client: createClient(url, key), bucket };
}

export async function writeFile(relativePath: string, data: Buffer | string): Promise<string> {
  const storage = supabaseStorage();
  const buffer = typeof data === "string" ? Buffer.from(data) : data;
  if (storage) {
    const { error } = await storage.client.storage.from(storage.bucket).upload(relativePath, buffer, { upsert: true, contentType: contentTypeFor(relativePath) });
    if (error) throw new Error(error.message);
    return relativePath;
  }
  const absolute = absoluteStoragePath(relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, buffer);
  return relativePath;
}

export async function readFile(relativePath: string): Promise<Buffer> {
  const storage = supabaseStorage();
  if (storage) {
    const { data, error } = await storage.client.storage.from(storage.bucket).download(relativePath);
    if (error || !data) throw new Error(error?.message || "Unable to read file.");
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  return readFileSync(absoluteStoragePath(relativePath));
}

export async function fileExists(relativePath: string): Promise<boolean> {
  const storage = supabaseStorage();
  if (storage) {
    const { data, error } = await storage.client.storage.from(storage.bucket).download(relativePath);
    if (error || !data) return false;
    return true;
  }
  try {
    return existsSync(absoluteStoragePath(relativePath));
  } catch {
    return false;
  }
}

export async function deleteFile(relativePath: string): Promise<void> {
  const storage = supabaseStorage();
  if (storage) {
    await storage.client.storage.from(storage.bucket).remove([relativePath]);
    return;
  }
  try {
    rmSync(absoluteStoragePath(relativePath), { force: true });
  } catch {
    // ignore
  }
}

function contentTypeFor(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".json") return "application/json";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
}



