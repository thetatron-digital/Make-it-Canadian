import { NextResponse } from "next/server";
import { deleteObjects, listAllObjects } from "@/lib/storage";
import { RETENTION_DAYS, expiredUrls } from "@/lib/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sweeps out avatars nobody has touched for a while. Run on a schedule by
 * the cron entry in vercel.json.
 *
 * Deliberately safe to call by anyone: it can only ever remove things that
 * are already past the retention window, so an unexpected caller does
 * exactly what the timer would have done anyway. When CRON_SECRET is set,
 * it is enforced as well.
 */
export async function GET(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const objects = await listAllObjects();
    const { urls, ids } = expiredUrls(objects);
    await deleteObjects(urls);
    if (ids.length > 0) console.log("retention sweep removed", { count: ids.length, ids });
    return NextResponse.json({
      retentionDays: RETENTION_DAYS,
      examined: objects.length,
      removed: ids.length,
    });
  } catch (error) {
    console.error("retention sweep failed", error);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
