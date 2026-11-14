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
    const { error } = await storage.client.storage.from(storage.bucket).remove([relativePath]);
    if (error) throw new Error(error.message);
    return;
  }
  try {
    rmSync(absoluteStoragePath(relativePath), { force: true });
  } catch {
    // ignore
  }
}

/** Remove every uploaded or generated object belonging to an account. */
export async function deleteUserFiles(userId: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) throw new Error("Invalid user storage key.");

  const storage = supabaseStorage();
  if (storage) {
    const bucket = storage.client.storage.from(storage.bucket);
    const prefix = `users/${userId}`;
    const listFiles = async (folder: string): Promise<string[]> => {
      const files: string[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await bucket.list(folder, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
        if (error) throw new Error(error.message);
        const entries = data ?? [];
        for (const entry of entries) {
          const objectPath = `${folder}/${entry.name}`;
          if (entry.id) files.push(objectPath);
          else files.push(...await listFiles(objectPath));
        }
        if (entries.length < 1000) break;
        offset += entries.length;
      }
      return files;
    };

    const files = await listFiles(prefix);
    for (let start = 0; start < files.length; start += 100) {
      const { error } = await bucket.remove(files.slice(start, start + 100));
      if (error) throw new Error(error.message);
    }
    return;
  }

  const usersRoot = path.resolve(storageRootPath(), "users");
  const accountRoot = path.resolve(usersRoot, userId);
  if (!accountRoot.startsWith(`${usersRoot}${path.sep}`)) throw new Error("Invalid user storage path.");
  rmSync(accountRoot, { recursive: true, force: true });
}

function contentTypeFor(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".json") return "application/json";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
}



