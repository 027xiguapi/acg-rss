import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  rssFeeds,
  type RssFeed,
} from "@/db/schema";
import { fetchFeedMeta, ingestFeed } from "@/server/rss/fetch";
import {
  cleanSeriesTitle,
  createBangumi,
  findBangumiIdByTitle,
  findImportOwner,
} from "@/server/rss/import";
import { parseTorrentTitle } from "@/lib/parser";

/** Default Mikan feed when none is passed on the command line. */
const DEFAULT_URL = "https://mikanani.me/RSS/Bangumi?bangumiId=3941";

/**
 * Batch-import a Mikan bangumi RSS feed: create (or reuse) the tracked
 * bangumi, register the subscription, then ingest every torrent and link
 * it to the bangumi/episode. Safe to re-run — URLs, info-hashes and
 * (bangumi, number) pairs are all deduplicated by unique indexes.
 *
 * Usage: tsx src/db/import-feed.ts [url] [feedName]
 */
async function main(): Promise<void> {
  const url = process.argv[2] ?? DEFAULT_URL;
  const nameOverride = process.argv[3]?.trim() || undefined;

  console.log(`Fetching feed metadata: ${url}`);
  const meta = await fetchFeedMeta(url);

  const rawTitle = meta.title ?? null;
  const firstItemTitle = meta.firstItemTitle ?? null;
  const seriesTitle =
    cleanSeriesTitle(rawTitle) ??
    cleanSeriesTitle(parseTorrentTitle(firstItemTitle ?? "").bangumiTitle);

  if (!seriesTitle) {
    throw new Error(
      `Could not determine the series title from the feed ` +
        `(channel title: ${JSON.stringify(rawTitle)}). ` +
        `Pass one explicitly: tsx src/db/import-feed.ts "${url}" "<title>".`
    );
  }

  const owner = await findImportOwner();
  const season = parseTorrentTitle(firstItemTitle ?? "").season ?? 1;

  console.log(
    `Series: "${seriesTitle}" (season ${season}, ${meta.itemCount} item(s))`
  );

  // Reuse the existing subscription (and its bangumi) on a re-run.
  const [existingFeed] = await db
    .select()
    .from(rssFeeds)
    .where(eq(rssFeeds.url, url))
    .limit(1);

  let feed: RssFeed;
  if (existingFeed) {
    feed = existingFeed;
    console.log(
      `Feed already subscribed (id=${feed.id}, bangumi=${feed.bangumiId}) — re-fetching.`
    );
  } else {
    let bangumiId = await findBangumiIdByTitle(seriesTitle);
    if (bangumiId == null) {
      bangumiId = await createBangumi(owner, seriesTitle, season);
      console.log(`Created bangumi #${bangumiId} "${seriesTitle}"`);
    } else {
      console.log(`Reusing existing bangumi #${bangumiId} "${seriesTitle}"`);
    }

    feed = (
      await db
        .insert(rssFeeds)
        .values({ name: nameOverride ?? seriesTitle, url, bangumiId })
        .returning()
    )[0];
    console.log(`Created feed #${feed.id} "${feed.name}" → bangumi #${bangumiId}`);
  }

  const result = await ingestFeed(feed);
  console.log(
    `Import complete: ${result.created} torrent(s) created, ${result.skipped} skipped` +
      (result.error ? ` (error: ${result.error})` : "")
  );

  process.exit(result.error ? 1 : 0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
