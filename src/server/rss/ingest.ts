import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rssFeeds, torrentItems, type RssFeed, type TorrentItem } from "@/db/schema";
import { parseTorrentTitle } from "@/lib/parser";
import { matchTorrentAgainstRules } from "../matcher";
import { fetchAndParseFeed } from "./parse";

export interface RefreshResult {
  inserted: number;
  skipped: number;
  error?: string;
}

/**
 * Fetch one feed, insert new items (dedup by info_hash via the unique
 * index) and run the matcher against every freshly inserted torrent.
 * Never throws — fetch/parse failures are recorded on the feed row.
 */
export async function refreshFeed(feed: RssFeed): Promise<RefreshResult> {
  let items;
  try {
    items = await fetchAndParseFeed(feed.url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(rssFeeds)
      .set({ lastFetchedAt: new Date(), lastError: message.slice(0, 500) })
      .where(eq(rssFeeds.id, feed.id));
    return { inserted: 0, skipped: 0, error: message };
  }

  let inserted: TorrentItem[] = [];
  if (items.length > 0) {
    inserted = await db
      .insert(torrentItems)
      .values(
        items.map((item) => {
          const parsed = parseTorrentTitle(item.title);
          return {
            feedId: feed.id,
            title: item.title,
            description: item.description,
            magnet: item.magnet,
            torrentUrl: item.torrentUrl,
            infoHash: item.infoHash,
            size: item.size,
            publishTime: item.publishTime,
            category: item.category,
            animeTitle: parsed.animeTitle,
            season: parsed.season,
            episode: parsed.episode,
            resolution: parsed.resolution,
          };
        })
      )
      .onConflictDoNothing({ target: torrentItems.infoHash })
      .returning();
  }

  await db
    .update(rssFeeds)
    .set({ lastFetchedAt: new Date(), lastError: null })
    .where(eq(rssFeeds.id, feed.id));

  // Rules run only on genuinely new torrents
  for (const torrent of inserted) {
    try {
      await matchTorrentAgainstRules(torrent);
    } catch (err) {
      console.error(`[ingest] matcher failed for #${torrent.id}:`, err);
    }
  }

  return { inserted: inserted.length, skipped: items.length - inserted.length };
}
