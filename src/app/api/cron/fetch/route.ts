import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { rssFeeds } from "@/db/schema";
import { ingestFeed } from "@/server/rss/fetch";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint for auto-fetching every enabled RSS feed.
 *
 * Protected by a shared secret: set CRON_SECRET and call this route from
 * an external scheduler (system cron, a cron service, etc.):
 *
 *   curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     https://your-host/api/cron/fetch
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const feeds = await db
    .select()
    .from(rssFeeds)
    .where(eq(rssFeeds.enabled, true));

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const feed of feeds) {
    const result = await ingestFeed(feed);
    created += result.created;
    skipped += result.skipped;
    if (result.error) errors.push(`${feed.name}: ${result.error}`);
  }

  revalidatePath("/", "layout");

  return NextResponse.json({
    ok: true,
    feeds: feeds.length,
    created,
    skipped,
    errors,
    at: new Date().toISOString(),
  });
}
