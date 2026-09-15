import { NextResponse } from "next/server";
import { isValidId, loadConfig } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const config = await loadConfig(id);
    if (!config) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { id, config },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("config load failed", error);
    return NextResponse.json({ error: "Could not load that avatar." }, { status: 500 });
  }
}
