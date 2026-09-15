import { NextResponse } from "next/server";
import { newId, readPngSize, saveAvatar, storageUnavailableReason } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Comfortably under the platform's request body limit, and far bigger than any sane avatar. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const unavailable = storageUnavailableReason();
  if (unavailable) return NextResponse.json({ error: unavailable }, { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "That upload did not arrive in one piece. Try again." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That PNG is larger than 4 MB. Try a smaller one." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const size = readPngSize(bytes);
  if (!size) {
    return NextResponse.json({ error: "That file is not a PNG. Save it as a PNG and upload it again." }, { status: 400 });
  }

  const id = newId();
  const origin = new URL(request.url).origin;
  try {
    const url = await saveAvatar(id, bytes, origin);
    return NextResponse.json({ id, url, width: size.width, height: size.height });
  } catch (error) {
    console.error("avatar upload failed", error);
    return NextResponse.json({ error: "The image could not be saved. Try again in a moment." }, { status: 500 });
  }
}
