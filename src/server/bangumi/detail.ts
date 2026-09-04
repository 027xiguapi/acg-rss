import { and, desc, eq, isNull, max, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { bangumi, bangumiEpisodes, bangumiInfos, torrentItems } from "@/db/schema";
import type { BangumiWithTitle, TorrentItem } from "@/db/schema";
import { withTitles } from "@/server/bangumi/queries";

/** One bangumi episode with every release variant collected for it. */
export interface EpisodeBucket {
  id: number;
  number: number;
  torrents: TorrentItem[];
  /** Newest release that actually has a magnet or .torrent link. */
  href: string | null;
}

/** Entry of the related-recommendations grid. */
export interface RelatedEntry {
  item: BangumiWithTitle;
  /** Latest parsed episode number, when the series has episodes. */
  latest: number | null;
}

/** Everything the bangumi detail page renders, derived in one place. */
export interface BangumiDetail {
  item: BangumiWithTitle;
  /** Episode buckets newest-first (desc number), as grouped from the query. */
  episodes: EpisodeBucket[];
  /** Same buckets ascending by number, for the episode picker. */
  episodesAsc: EpisodeBucket[];
  firstEpisode: EpisodeBucket | null;
  latestEpisode: number | null;
  /** Torrents linked to this bangumi but without a parsed episode number. */
  unparsed: TorrentItem[];
  torrentCount: number;
  primaryTitle: string;
  synonyms: string[];
  /** Primary title, used to resolve the local poster file. */
  coverName: string | null;
  /** Up to 12 other tracked series, closest type/origin first. */
  related: RelatedEntry[];
  /** Newest downloadable release overall (parsed or not), for the big CTA. */
  bestHref: string | null;
}

/**
 * Newest release that actually has a magnet or .torrent link.
 * Torrents arrive newest-first, so `find` keeps the freshest variant.
 */
function downloadHref(torrents: TorrentItem[]): string | null {
  const best =
    torrents.find((torrent) => torrent.magnet) ??
    torrents.find((torrent) => torrent.torrentUrl);
  return best ? (best.magnet ?? best.torrentUrl) : null;
}

/** An bangumi row with its primary display name resolved from bangumi_infos. */
export async function loadBangumi(id: number): Promise<BangumiWithTitle | null> {
  const rows = await db.select().from(bangumi).where(eq(bangumi.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const primary = await db
    .select({ title: bangumiInfos.title })
    .from(bangumiInfos)
    .where(and(eq(bangumiInfos.bangumiId, id), eq(bangumiInfos.kind, "primary")))
    .limit(1);
  return { ...row, title: primary[0]?.title ?? "" };
}

export async function loadBangumiDetail(bangumiId: number): Promise<BangumiDetail | null> {
  const item = await loadBangumi(bangumiId);
  if (!item) return null;

  // Episodes with their torrents (newest first inside each episode)
  const episodeRows = await db
    .select({
      episodeId: bangumiEpisodes.id,
      number: bangumiEpisodes.number,
      torrent: torrentItems,
    })
    .from(bangumiEpisodes)
    .leftJoin(torrentItems, eq(torrentItems.episodeId, bangumiEpisodes.id))
    .where(eq(bangumiEpisodes.bangumiId, bangumiId))
    .orderBy(
      desc(bangumiEpisodes.number),
      desc(torrentItems.publishTime),
      desc(torrentItems.createdAt)
    );

  // Linked to this bangumi but no parsed episode number
  const unparsed = await db
    .select()
    .from(torrentItems)
    .where(and(eq(torrentItems.bangumiId, bangumiId), isNull(torrentItems.episodeId)))
    .orderBy(desc(torrentItems.publishTime), desc(torrentItems.createdAt));

  const [totals, titleRows, otherRows, latestRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(torrentItems)
      .where(eq(torrentItems.bangumiId, bangumiId)),
    // Structured names for the basic info card
    db.select().from(bangumiInfos).where(eq(bangumiInfos.bangumiId, bangumiId)),
    // Other tracked series feed the related-recommendations grid
    db.select().from(bangumi).where(ne(bangumi.id, bangumiId)),
    db
      .select({ bangumiId: bangumiEpisodes.bangumiId, latest: max(bangumiEpisodes.number) })
      .from(bangumiEpisodes)
      .groupBy(bangumiEpisodes.bangumiId),
  ]);

  const torrentCount = totals[0]?.count ?? 0;

  const episodes = new Map<number, EpisodeBucket>();
  const allTorrents: TorrentItem[] = [];
  for (const row of episodeRows) {
    const bucket =
      episodes.get(row.episodeId) ??
      { id: row.episodeId, number: row.number, torrents: [], href: null };
    if (row.torrent) {
      bucket.torrents.push(row.torrent);
      allTorrents.push(row.torrent);
    }
    episodes.set(row.episodeId, bucket);
  }
  for (const bucket of episodes.values()) {
    bucket.href = downloadHref(bucket.torrents);
  }

  const episodesDesc = [...episodes.values()];
  const episodesAsc = [...episodesDesc].sort((a, b) => a.number - b.number);
  const latestEpisode = episodesAsc.length
    ? episodesAsc[episodesAsc.length - 1].number
    : null;

  const bestTorrent = [...allTorrents, ...unparsed]
    .filter((torrent) => torrent.magnet || torrent.torrentUrl)
    .sort(
      (a, b) =>
        (b.publishTime?.getTime() ?? b.createdAt.getTime()) -
        (a.publishTime?.getTime() ?? a.createdAt.getTime())
    )[0];

  // Related: same type/origin first, then most recently updated, then by title
  const latestMap = new Map(latestRows.map((row) => [row.bangumiId, row.latest]));
  const related: RelatedEntry[] = (await withTitles(otherRows))
    .map((other) => ({ item: other, latest: latestMap.get(other.id) ?? null }))
    .sort((a, b) => {
      const score = (entry: RelatedEntry) =>
        (entry.item.type && entry.item.type === item.type ? 2 : 0) +
        (entry.item.origin && entry.item.origin === item.origin ? 1 : 0);
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      if (a.latest !== b.latest) return (b.latest ?? -1) - (a.latest ?? -1);
      return a.item.title.localeCompare(b.item.title);
    })
    .slice(0, 12);

  const primaryTitle = titleRows.find((row) => row.kind === "primary")?.title ?? "";
  const coverName = primaryTitle || null;

  return {
    item: { ...item, title: primaryTitle },
    episodes: episodesDesc,
    episodesAsc,
    firstEpisode: episodesAsc[0] ?? null,
    latestEpisode,
    unparsed,
    torrentCount,
    primaryTitle,
    synonyms: titleRows.filter((row) => row.kind === "synonym").map((row) => row.title),
    coverName,
    related,
    bestHref: bestTorrent ? (bestTorrent.magnet ?? bestTorrent.torrentUrl) : null,
  };
}
