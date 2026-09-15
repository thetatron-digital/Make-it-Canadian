import { NextResponse } from "next/server";
import { isValidId, newId, saveConfig, storageUnavailableReason } from "@/lib/storage";
import { normalizeConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unavailable = storageUnavailableReason();
  if (unavailable) return NextResponse.json({ error: unavailable }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const payload = body as { id?: unknown; config?: unknown };
  const config = normalizeConfig(payload.config);
  if (!config) {
    return NextResponse.json({ error: "That configuration is missing an image." }, { status: 400 });
  }

  // Re-saving an existing avatar keeps its id, so bookmarked links and any
  // OBS source already pointing at it keep working.
  const requested = typeof payload.id === "string" ? payload.id : "";
  const id = requested && isValidId(requested) ? requested : newId();

  try {
    await saveConfig(id, config);
    return NextResponse.json({ id });
  } catch (error) {
    console.error("config save failed", error);
    return NextResponse.json({ error: "The settings could not be saved. Try again in a moment." }, { status: 500 });
  }
}
