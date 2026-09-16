import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { normalizeConfig, type AvatarConfig } from "./types";

/** No look-alike characters: these ids get read aloud and retyped. */
export const newId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 8);

/**
 * Read an environment variable at runtime. The dynamic key matters: a
 * bundler can substitute a literal `process.env.FOO` with whatever it saw
 * at build time, and a value that only exists at runtime would then be
 * baked in as undefined.
 */
function readEnv(name: string): string | undefined {
  return process.env[name];
}

const hasBlob = () => Boolean(readEnv("BLOB_READ_WRITE_TOKEN"));

/**
 * The local-disk fallback is only honest on a developer's machine. On a
 * serverless host the filesystem is per-instance and thrown away, so a save
 * would appear to work and then hand out a link that dies - worse than
 * refusing. Say so instead.
 */
export function storageUnavailableReason(): string | null {
  if (hasBlob() || !readEnv("VERCEL")) return null;
  // Names only, never values, so the reason is visible in the runtime logs.
  console.error("blob token missing at runtime", {
    vercelEnv: readEnv("VERCEL_ENV") ?? null,
    matchingKeys: Object.keys(process.env).filter((key) => /BLOB|STORAGE/i.test(key)),
    totalKeys: Object.keys(process.env).length,
  });
  return "Saving is not set up on this deployment yet. On Vercel, Storage lives on the account page, not inside the project: create a Blob store there with Public access, then add its BLOB_READ_WRITE_TOKEN under the project's Settings → Environment Variables and redeploy. The README has the full walkthrough.";
}

const configPath = (id: string) => `configs/${id}.json`;
const avatarPath = (id: string) => `avatars/${id}.png`;

/** Local disk stand-in so `npm run dev` works before a Blob store exists. */
const localDir = path.join(os.tmpdir(), "make-it-canadian");
const localFile = (name: string) => path.join(localDir, name.replace(/[^a-z0-9._-]/gi, "_"));

export function isValidId(id: string): boolean {
  return /^[23456789abcdefghijkmnpqrstuvwxyz]{4,16}$/.test(id);
}

/** Width and height straight out of the PNG IHDR chunk. */
export function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24) return null;
  for (let i = 0; i < signature.length; i++) if (bytes[i] !== signature[i]) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width < 1 || height < 1 || width > 8192 || height > 8192) return null;
  return { width, height };
}

/**
 * Turn a Blob failure into something the person staring at the editor can
 * act on. The two that actually happen during setup are a store created
 * with Private access - this app needs Public, because OBS fetches the
 * artwork with no token - and a stale or missing token.
 */
export function describeStorageError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/private|access|forbidden|not allowed/i.test(message)) {
    return "The Blob store refused the upload. It was most likely created with Private access — this app needs a Public store, because OBS loads the artwork without a token. Create a public store and update BLOB_READ_WRITE_TOKEN.";
  }
  if (/token|unauthorized|401|invalid/i.test(message)) {
    return "The Blob store token is missing or no longer valid. Check BLOB_READ_WRITE_TOKEN in the project settings, then redeploy.";
  }
  return "The image could not be saved. Try again in a moment.";
}

export async function saveAvatar(id: string, bytes: Uint8Array, origin: string): Promise<string> {
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(avatarPath(id), Buffer.from(bytes), {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000,
    });
    return blob.url;
  }
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(localFile(`${id}.png`), bytes);
  return `${origin}/api/file/${id}.png`;
}

export async function saveConfig(id: string, config: AvatarConfig): Promise<void> {
  const body = JSON.stringify(config);
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    await put(configPath(id), body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      // The editor can overwrite this, so it must not be cached.
      cacheControlMaxAge: 0,
    });
    return;
  }
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(localFile(`${id}.json`), body, "utf8");
}

export async function loadConfig(id: string): Promise<AvatarConfig | null> {
  if (hasBlob()) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: configPath(id), limit: 1 });
    const match = blobs.find((blob) => blob.pathname === configPath(id));
    if (!match) return null;
    const response = await fetch(match.url, { cache: "no-store" });
    if (!response.ok) return null;
    return normalizeConfig(await response.json());
  }
  try {
    return normalizeConfig(JSON.parse(await fs.readFile(localFile(`${id}.json`), "utf8")));
  } catch {
    return null;
  }
}

export async function loadLocalFile(name: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(localFile(name));
  } catch {
    return null;
  }
}
