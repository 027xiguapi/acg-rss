import Parser from "rss-parser";
import {
  buildMagnet,
  extractInfoHash,
  extractMagnet,
} from "@/lib/parser";
import { parseSizeToBytes } from "@/lib/format";
import { sha1Hex } from "../crypto";

export interface ParsedRssItem {
  title: string;
  description?: string;
  magnet?: string;
  torrentUrl?: string;
  infoHash: string;
  size?: number;
  publishTime?: Date;
  category?: string;
}

// Custom fields used by popular torrent feeds (nyaa.si etc.)
const parser = new Parser({
  timeout: 20_000,
  customFields: {
    item: [
      ["nyaa:infoHash", "infoHash"],
      ["nyaa:size", "nyaaSize"],
      ["nyaa:category", "nyaaCategory"],
      ["torrent:magnetURI", "magnetURI"],
    ],
  },
});

interface RssItemEx {
  title?: string;
  link?: string;
  guid?: string;
  description?: string;
  "content:encoded"?: string;
  isoDate?: string;
  pubDate?: string;
  categories?: Array<string | { _: string }>;
  enclosure?: { url?: string; length?: string };
  infoHash?: string;
  nyaaSize?: string;
  nyaaCategory?: string;
  magnetURI?: string;
}

function pickEnclosureUrl(item: RssItemEx): string | undefined {
  const url = item.enclosure?.url;
  if (!url) return undefined;
  return url;
}

/**
 * Fetch and parse a torrent RSS feed into normalized items.
 * Throws when the feed cannot be fetched or parsed.
 */
export async function fetchAndParseFeed(url: string): Promise<ParsedRssItem[]> {
  const feed = await parser.parseURL(url);
  const items: ParsedRssItem[] = [];

  for (const raw of feed.items ?? []) {
    const item = raw as RssItemEx;
    const title = (item.title ?? "").trim();
    if (!title) continue;

    const candidates = [
      item.magnetURI,
      item.link,
      item.guid,
      item.description,
      pickEnclosureUrl(item),
    ];

    // Magnet link
    let magnet: string | undefined;
    for (const c of candidates) {
      const found = extractMagnet(c);
      if (found) {
        magnet = found;
        break;
      }
    }

    // Info hash: custom field > magnet > any text containing btih
    let infoHash = item.infoHash ? extractInfoHash(`btih:${item.infoHash}`) : null;
    if (!infoHash && magnet) infoHash = extractInfoHash(magnet);
    if (!infoHash) {
      for (const c of candidates) {
        infoHash = extractInfoHash(c);
        if (infoHash) break;
      }
    }

    // Direct .torrent file URL
    const enclosure = pickEnclosureUrl(item);
    const torrentUrl = [enclosure, item.link, item.guid].find((u) =>
      u?.toLowerCase().includes(".torrent")
    );

    if (!infoHash) {
      if (torrentUrl) {
        // No btih available anywhere: fall back to a stable hash of the URL
        infoHash = sha1Hex(torrentUrl);
      } else {
        continue; // Nothing downloadable, skip the item
      }
    }

    if (!magnet) magnet = buildMagnet(infoHash, title);

    const size =
      parseSizeToBytes(item.enclosure?.length) ??
      parseSizeToBytes(item.nyaaSize) ??
      parseSizeToBytes(extractSizeText(item.description));

    const publishTime = item.isoDate ?? item.pubDate;

    items.push({
      title,
      description: item.description?.slice(0, 2000),
      magnet,
      torrentUrl,
      infoHash,
      size: size ?? undefined,
      publishTime: publishTime ? new Date(publishTime) : undefined,
      category: normalizeCategory(item.categories) ?? item.nyaaCategory,
    });
  }

  return items;
}

function normalizeCategory(
  categories: RssItemEx["categories"]
): string | undefined {
  const first = categories?.[0];
  if (!first) return undefined;
  const value = typeof first === "string" ? first : first._;
  return value?.slice(0, 128) || undefined;
}

const SIZE_TEXT_RE = /(\d[\d.,]*\s*(?:KiB|MiB|GiB|TiB|KB|MB|GB|TB|B))\b/i;

function extractSizeText(text?: string): string | undefined {
  if (!text) return undefined;
  return SIZE_TEXT_RE.exec(text)?.[1];
}
