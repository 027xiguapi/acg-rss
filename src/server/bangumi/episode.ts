import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bangumi, bangumiEpisodes, bangumiInfos, episodeInfos } from "@/db/schema";
import type { BangumiEpisode, BangumiWithTitle, TorrentItem } from "@/db/schema";
import { loadBangumiDetail } from "@/server/bangumi/detail";
import type { BangumiDetail, EpisodeBucket } from "@/server/bangumi/detail";

/** One localized title/synopsis row of an episode. */
export interface EpisodeInfoRow {
  lang: string;
  title: string | null;
  content: string | null;
}

/** Everything the episode detail page renders, derived in one place. */
export interface EpisodeDetail {
  episode: BangumiEpisode;
  series: BangumiWithTitle;
  /** Release variants of this episode, newest first. */
  torrents: TorrentItem[];
  /** Neighbour episodes in number order, for prev/next navigation. */
  prev: EpisodeBucket | null;
  next: EpisodeBucket | null;
  /** Series-wide context: sidebar, picker and related grid. */
  seriesDetail: BangumiDetail;
  /** Newest release of this episode that actually has a magnet or .torrent link. */
  bestHref: string | null;
  /** Multilingual title/synopsis rows, oldest first for a stable fallback. */
  infos: EpisodeInfoRow[];
}

export async function loadEpisode(
  id: number
): Promise<{ episode: BangumiEpisode; series: BangumiWithTitle } | null> {
  const rows = await db
    .select({ episode: bangumiEpisodes, series: bangumi })
    .from(bangumiEpisodes)
    .innerJoin(bangumi, eq(bangumiEpisodes.bangumiId, bangumi.id))
    .where(eq(bangumiEpisodes.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const primary = await db
    .select({ title: bangumiInfos.title })
    .from(bangumiInfos)
    .where(
      and(eq(bangumiInfos.bangumiId, row.series.id), eq(bangumiInfos.kind, "primary"))
    )
    .limit(1);
  return {
    episode: row.episode,
    series: { ...row.series, title: primary[0]?.title ?? "" },
  };
}

/**
 * The series detail powers everything around the episode: sidebar stats,
 * basic info, the episode picker and related recommendations. Prev/next
 * are simply the neighbours of this episode inside episodesAsc.
 */
export async function loadEpisodeDetail(episodeId: number): Promise<EpisodeDetail | null> {
  const row = await loadEpisode(episodeId);
  if (!row) return null;
  const { episode, series } = row;

  const seriesDetail = await loadBangumiDetail(series.id);
  if (!seriesDetail) return null;
  const index = seriesDetail.episodesAsc.findIndex((bucket) => bucket.id === episodeId);
  const bucket = index >= 0 ? seriesDetail.episodesAsc[index] : null;

  const infoRows = await db
    .select({
      lang: episodeInfos.lang,
      title: episodeInfos.title,
      content: episodeInfos.content,
    })
    .from(episodeInfos)
    .where(eq(episodeInfos.episodeId, episodeId))
    .orderBy(asc(episodeInfos.createdAt));

  return {
    episode,
    series,
    torrents: bucket?.torrents ?? [],
    prev: index > 0 ? seriesDetail.episodesAsc[index - 1] : null,
    next:
      index >= 0 && index < seriesDetail.episodesAsc.length - 1
        ? seriesDetail.episodesAsc[index + 1]
        : null,
    seriesDetail,
    bestHref: bucket?.href ?? null,
    infos: infoRows,
  };
}
