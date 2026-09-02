import "dotenv/config";
import { parseFeed, ingestGlobalItems } from "@/server/rss/fetch";

/**
 * One-shot fetcher for a cross-series RSS feed (Mikan's global "Classic"
 * list by default). Pulls the feed once, inserts any torrents that are new
 * (dedup by info-hash), and hands each new torrent to the linker so it
 * attaches to a tracked bangumi when the title matches, then exits.
 *
 * Scheduling is left to an external scheduler (BaoTa 宝塔 / system cron /
 * Windows Task Scheduler), which calls this script repeatedly:
 *
 *   tsx src/db/fetch-feed.ts [url]
 */

const DEFAULT_URL = "https://mikanani.me/RSS/Classic";

async function fetchOnce(url: string): Promise<void> {
  const started = new Date();
  console.log(`[fetch-feed] ${started.toISOString()} fetching ${url}`);
  const { items } = await parseFeed(url);
  const result = await ingestGlobalItems(items);
  console.log(
    `[fetch-feed] done in ${Date.now() - started.getTime()}ms: ` +
      `${result.created} created, ${result.skipped} skipped`
  );
}

async function main(): Promise<void> {
  const url = process.argv[2]?.trim() || DEFAULT_URL;
  await fetchOnce(url);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
