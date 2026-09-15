import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { normalizeConfig, type AvatarConfig } from "./types";

/** No look-alike characters: these ids get read aloud and retyped. */
export const newId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 8);

const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/**
 * The local-disk fallback is only honest on a developer's machine. On a
 * serverless host the filesystem is per-instance and thrown away, so a save
 * would appear to work and then hand out a link that dies - worse than
 * refusing. Say so instead.
 */
export function storageUnavailableReason(): string | null {
  if (hasBlob() || !process.env.VERCEL) return null;
  return "Saving is not set up on this deployment yet. Add a Blob store to the project in the Vercel dashboard (Storage → Blob → Connect), then redeploy.";
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
