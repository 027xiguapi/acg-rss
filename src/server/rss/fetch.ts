import { eq } from "drizzle-orm";
import Parser from "rss-parser";
import { db } from "@/db";
import { rssFeeds, torrentItems, type RssFeed } from "@/db/schema";
import { findOrCreateEpisode } from "@/server/bangumi/linker";
import { resolveSubgroupId } from "@/server/subgroups/resolve";
import {
  computeInfoHash,
  extractMagnet,
  extractSubgroup,
  parseTorrentTitle,
} from "@/lib/parser";

/** Outcome of fetching one feed. */
export interface FeedFetchResult {
  created: number;
  skipped: number;
  error?: string;
}

function newParser(): Parser {
  return new Parser({
    customFields: {
      item: [["torrent", "pubDate", { keepArray: false }]],
    },
  });
}

/** One normalized item from a parsed RSS feed. */
interface NormalizedItem {
  title: string;
  magnet: string | null;
  torrentUrl: string | null;
  size: number | null;
  publishTime: Date | null;
  description: string | null;
  category: string | null;
}

/** Channel metadata needed to auto-create a bangumi before ingestion. */
export interface ParsedFeed {
  /** Channel title, e.g. "Mikan Project - <series>" on Mikan feeds */
  title: string | null;
  /** Channel home link; for Mikan bangumi feeds this is a series page */
  link: string | null;
  items: NormalizedItem[];
}

/**
 * Parse pasted/raw feed XML text into torrent-shaped records. Mikan puts
 * the .torrent link in `<enclosure>` and may expose a magnet in several
 * places, so we scan the common fields and let the torrent URL fall back
 * to the enclosure.
 */
export async function parseFeedXml(xml: string): Promise<ParsedFeed> {
  const parser = newParser();
  return normalizeParsedFeed(await parser.parseString(xml));
}

async function parseFeed(url: string): Promise<ParsedFeed> {
  const parser = newParser();
  const feed = await parser.parseURL(url);
  return normalizeParsedFeed(feed);
}

async function normalizeParsedFeed(
  feed: Awaited<ReturnType<Parser["parseString"]>>
): Promise<ParsedFeed> {
  const items: NormalizedItem[] = [];
  for (const item of feed.items) {
    if (!item.title) continue;

    const enclosureUrl = item.enclosure?.url;
    const magnet =
      extractMagnet(enclosureUrl) ??
      extractMagnet(item.link) ??
      extractMagnet(item.content) ??
      extractMagnet(item.contentSnippet) ??
      extractMagnet((item as { magnet?: string }).magnet) ??
      null;

    const torrentUrl =
      enclosureUrl && !enclosureUrl.startsWith("magnet:")
        ? enclosureUrl
        : null;

    const iso = item.isoDate ? new Date(item.isoDate) : null;
    // Mikan puts pubDate inside the namespaced <torrent> element, which
    // customFields surfaces as an object — unwrap the string from it.
    const rawPub = (item as { pubDate?: unknown }).pubDate;
    let pubStr: string | undefined;
    if (typeof rawPub === "string") {
      pubStr = rawPub;
    } else if (rawPub && typeof rawPub === "object") {
      const inner = (rawPub as { pubDate?: string | string[] }).pubDate;
      pubStr = Array.isArray(inner) ? inner[0] : inner;
    }
    const pub = !iso && pubStr ? new Date(pubStr) : null;
    const publishTime = iso ?? pub;

    const rawLen = item.enclosure?.length;
    const size = rawLen != null ? Number(rawLen) : null;

    items.push({
      title: item.title,
      magnet,
      torrentUrl,
      size: size != null && !Number.isNaN(size) ? size : null,
      publishTime:
        publishTime && !Number.isNaN(publishTime.getTime()) ? publishTime : null,
      description: item.contentSnippet ?? item.content ?? null,
      category: item.categories?.[0] ?? null,
    });
  }
  return { title: feed.title ?? null, link: feed.link ?? null, items };
}

/**
 * Channel metadata (title, first item title, item count) for a feed URL.
 * The batch importer uses this to derive the series name before creating a
 * bangumi + subscription; the first item title is a fallback when the
 * channel title is empty.
 */
export async function fetchFeedMeta(url: string): Promise<{
  title: string | null;
  firstItemTitle: string | null;
  itemCount: number;
}> {
  const { title, items } = await parseFeed(url);
  return { title, firstItemTitle: items[0]?.title ?? null, itemCount: items.length };
}

/**
 * Ingest already-parsed items into one bangumi: insert torrents (dedup by
 * info-hash) and link them to the bangumi/episode. Shared by the URL fetch
 * path and the pasted-XML batch importer.
 */
export async function ingestItems(
  bangumiId: number,
  items: NormalizedItem[]
): Promise<FeedFetchResult> {
  const result: FeedFetchResult = { created: 0, skipped: 0 };

  for (const item of items) {
    const infoHash = computeInfoHash(item.magnet, item.torrentUrl);
    const parsed = parseTorrentTitle(item.title);
    const subgroup = extractSubgroup(item.title);
    const subgroupId = await resolveSubgroupId(subgroup);

    const inserted = await db
      .insert(torrentItems)
      .values({
        title: item.title,
        description: item.description,
        magnet: item.magnet,
        torrentUrl: item.torrentUrl,
        infoHash,
        size: item.size,
        publishTime: item.publishTime,
        category: item.category,
        bangumiTitle: parsed.bangumiTitle,
        season: parsed.season,
        episode: parsed.episode,
        resolution: parsed.resolution,
        subgroup,
        subgroupId,
      })
      .onConflictDoNothing({ target: torrentItems.infoHash })
      .returning();

    const row = inserted[0];
    if (!row) {
      result.skipped += 1;
      continue;
    }

    const episodeId =
      row.episode != null
        ? await findOrCreateEpisode(bangumiId, row.episode)
        : null;
    await db
      .update(torrentItems)
      .set({ bangumiId, episodeId })
      .where(eq(torrentItems.id, row.id));

    result.created += 1;
  }

  return result;
}

/**
 * Fetch one feed, ingest new torrents and link them straight to the feed's
 * bangumi (a Mikan bangumi feed is scoped to a single series). Duplicate
 * info-hashes are skipped via the unique index.
 */
export async function ingestFeed(feed: RssFeed): Promise<FeedFetchResult> {
  const result: FeedFetchResult = { created: 0, skipped: 0 };

  try {
    const { items } = await parseFeed(feed.url);
    const ingested = await ingestItems(feed.bangumiId, items);
    result.created = ingested.created;
    result.skipped = ingested.skipped;

    await db
      .update(rssFeeds)
      .set({ lastFetchedAt: new Date(), lastError: null })
      .where(eq(rssFeeds.id, feed.id));
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    await db
      .update(rssFeeds)
      .set({ lastError: result.error })
      .where(eq(rssFeeds.id, feed.id));
  }

  return result;
}
