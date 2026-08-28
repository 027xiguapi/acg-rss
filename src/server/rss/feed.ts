import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { torrentItems } from "@/db/schema";
import type { TorrentItem } from "@/db/schema";

/**
 * RSS 2.0 generation for the public /rss endpoints. Output mirrors a Mikan
 * bangumi feed: one <item> per torrent release, the .torrent link inside
 * <enclosure>, and the size / release time inside a namespaced <torrent>
 * element so torrent-aware readers can act on the result.
 */

/** Escape text so it is safe inside XML text nodes and attribute values. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 1123 timestamp — the format RSS 2.0 expects for <pubDate>. */
function rfc1123(date: Date): string {
  return date.toUTCString();
}

/** Channel metadata rendered into the feed's <channel> block. */
export interface RssChannel {
  title: string;
  description: string;
  /** Absolute self link (the URL a reader subscribes to). */
  link: string;
}

/** One torrent release, resolved to the fields the feed renders. */
export interface RssItem {
  title: string;
  description: string;
  /** Absolute on-site page URL (episode page when known, else bangumi). */
  link: string;
  /** Download URL for the enclosure: .torrent when present, else magnet. */
  enclosureUrl: string;
  /** Content length in bytes, when known. */
  size: number | null;
  /** Release time, when known. */
  publishTime: Date | null;
}

/** The public origin for absolute URLs, derived from the request headers. */
export function siteBaseUrl(request: Request): string {
  const first = (value: string | null) => value?.split(",")[0]?.trim() ?? "";
  const host =
    first(request.headers.get("x-forwarded-host")) ||
    request.headers.get("host") ||
    "";
  const proto = first(request.headers.get("x-forwarded-proto")) || "http";
  return `${proto}://${host}`;
}

/** Download URL for a release; null when it has no magnet or .torrent. */
export function enclosureUrl(torrent: TorrentItem): string | null {
  return torrent.torrentUrl ?? torrent.magnet ?? null;
}

/** Absolute on-site page URL: the episode page when linked, else the bangumi. */
export function torrentPageUrl(base: string, torrent: TorrentItem): string {
  const path =
    torrent.episodeId != null
      ? `/episode/${torrent.episodeId}`
      : `/bangumi/${torrent.bangumiId}`;
  return `${base}${path}`;
}

/** Convert torrent rows to feed items, dropping releases with no link. */
export function toRssItems(base: string, torrents: TorrentItem[]): RssItem[] {
  const items: RssItem[] = [];
  for (const torrent of torrents) {
    const url = enclosureUrl(torrent);
    if (!url) continue;
    items.push({
      title: torrent.title,
      description: torrent.description ?? torrent.title,
      link: torrentPageUrl(base, torrent),
      enclosureUrl: url,
      size: torrent.size,
      publishTime: torrent.publishTime,
    });
  }
  return items;
}

/** Serialize a channel and its items to an RSS 2.0 XML document. */
export function renderRss(channel: RssChannel, items: RssItem[]): string {
  const itemBlocks = items.map((item) => {
    const guid = escapeXml(item.title);
    const link = escapeXml(item.link);
    const enclosure = escapeXml(item.enclosureUrl);
    const size = item.size != null ? String(item.size) : null;
    const lengthAttr = size != null ? ` length="${size}"` : "";

    const lines: string[] = [
      "    <item>",
      `      <guid isPermaLink="false">${guid}</guid>`,
      `      <link>${link}</link>`,
      `      <title>${guid}</title>`,
      `      <description>${escapeXml(item.description)}</description>`,
    ];
    if (item.publishTime) {
      lines.push(`      <pubDate>${rfc1123(item.publishTime)}</pubDate>`);
    }
    lines.push('      <torrent xmlns="https://mikanani.me/0.1/">');
    lines.push(`        <link>${link}</link>`);
    if (size != null) {
      lines.push(`        <contentLength>${size}</contentLength>`);
    }
    if (item.publishTime) {
      lines.push(`        <pubDate>${item.publishTime.toISOString()}</pubDate>`);
    }
    lines.push("      </torrent>");
    lines.push(
      `      <enclosure type="application/x-bittorrent"${lengthAttr} url="${enclosure}"/>`
    );
    lines.push("    </item>");
    return lines.join("\n");
  });

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    ...itemBlocks,
    "  </channel>",
    "</rss>",
  ].join("\n");
}

/** Torrents of one tracked series, newest first (releases without a date
 * fall back to ingestion time so they never sort ahead of dated ones). */
export async function loadBangumiTorrents(
  bangumiId: number
): Promise<TorrentItem[]> {
  return db
    .select()
    .from(torrentItems)
    .where(eq(torrentItems.bangumiId, bangumiId))
    .orderBy(
      desc(sql`coalesce(${torrentItems.publishTime}, ${torrentItems.createdAt})`)
    );
}

/** Project-linked torrents for the aggregate feed, newest first. */
export async function loadAllTorrents(limit = 200): Promise<TorrentItem[]> {
  return db
    .select()
    .from(torrentItems)
    .where(isNotNull(torrentItems.bangumiId))
    .orderBy(
      desc(sql`coalesce(${torrentItems.publishTime}, ${torrentItems.createdAt})`)
    )
    .limit(limit);
}
