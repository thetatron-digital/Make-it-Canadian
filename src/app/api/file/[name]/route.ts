import { NextResponse } from "next/server";
import { loadLocalFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves the local-disk fallback used when no Blob store is configured.
 * In production `BLOB_READ_WRITE_TOKEN` is set and uploads never land here.
 */
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!/^[23456789abcdefghijkmnpqrstuvwxyz]{4,16}\.png$/.test(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const file = await loadLocalFile(name);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
    },
  });
}
