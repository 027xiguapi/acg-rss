import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bangumi, bangumiEpisodes, bangumiInfos, episodeInfos } from "@/db/schema";

/** One indexable detail page: its id and last modification time. */
export interface SeoPath {
  id: number;
  lastModified: Date;
}

/** Every tracked bangumi id with its last modification time. */
export async function listBangumiPaths(): Promise<SeoPath[]> {
  return db
    .select({ id: bangumi.id, lastModified: bangumi.updatedAt })
    .from(bangumi)
    .orderBy(desc(bangumi.updatedAt));
}

/** Every episode id with its last modification time. */
export async function listEpisodePaths(): Promise<SeoPath[]> {
  return db
    .select({ id: bangumiEpisodes.id, lastModified: bangumiEpisodes.updatedAt })
    .from(bangumiEpisodes)
    .orderBy(desc(bangumiEpisodes.updatedAt));
}

/** One series as listed in /llms.txt. */
export interface LlmSeries {
  id: number;
  title: string;
  season: number;
  year: number | null;
  type: string | null;
}

/** Every series with its primary title, for the LLM catalog. */
export async function listSeriesForLlm(): Promise<LlmSeries[]> {
  return db
    .select({
      id: bangumi.id,
      title: bangumiInfos.title,
      season: bangumi.season,
      year: bangumi.year,
      type: bangumi.type,
    })
    .from(bangumi)
    .innerJoin(
      bangumiInfos,
      and(eq(bangumiInfos.bangumiId, bangumi.id), eq(bangumiInfos.kind, "primary"))
    )
    .orderBy(asc(bangumiInfos.title));
}

/** One episode as listed in /llms.txt, carrying its series title. */
export interface LlmEpisode {
  id: number;
  number: number;
  seriesTitle: string;
}

/** Every episode with its series title, for the LLM catalog. */
export async function listEpisodesForLlm(): Promise<LlmEpisode[]> {
  return db
    .select({
      id: bangumiEpisodes.id,
      number: bangumiEpisodes.number,
      seriesTitle: bangumiInfos.title,
    })
    .from(bangumiEpisodes)
    .innerJoin(bangumi, eq(bangumiEpisodes.bangumiId, bangumi.id))
    .innerJoin(
      bangumiInfos,
      and(eq(bangumiInfos.bangumiId, bangumi.id), eq(bangumiInfos.kind, "primary"))
    )
    .orderBy(asc(bangumiInfos.title), asc(bangumiEpisodes.number));
}

/** One episode inside a series, for /llms-full.txt. */
export interface LlmEpisodeEntry {
  id: number;
  number: number;
  /** Localized episode title, in the preferred available language. */
  title: string | null;
  /** Localized episode synopsis, when maintained. */
  content: string | null;
}

/** One series with everything /llms-full.txt needs, per series. */
export interface LlmSeriesFull {
  id: number;
  title: string;
  /** Chinese synopsis stored on the primary name row, when present. */
  content: string | null;
  /** Alternate names (synonyms) across all languages. */
  synonyms: string[];
  season: number;
  year: number | null;
  origin: string | null;
  type: string | null;
  airDay: number | null;
  episodes: LlmEpisodeEntry[];
}

/**
 * Preferred order for picking one localized episode title/synopsis: English
 * first (the LLM document is English), then the other maintained languages.
 */
const EPISODE_LANG_ORDER = ["en", "zh-CN", "ja", "ko"];

function langRank(lang: string): number {
  const index = EPISODE_LANG_ORDER.indexOf(lang);
  return index === -1 ? EPISODE_LANG_ORDER.length : index;
}

/**
 * The whole catalog (series + synonyms + synopses + episodes) in one pass,
 * for the /llms-full.txt companion document. The dataset is small enough
 * (tens of series) that loading it in memory is simpler than many joins.
 */
export async function listSeriesFullForLlm(): Promise<LlmSeriesFull[]> {
  const [seriesRows, infoRows, episodeRows, episodeInfoRows] = await Promise.all([
    db.select().from(bangumi),
    db
      .select({
        bangumiId: bangumiInfos.bangumiId,
        kind: bangumiInfos.kind,
        lang: bangumiInfos.lang,
        title: bangumiInfos.title,
        content: bangumiInfos.content,
      })
      .from(bangumiInfos),
    db
      .select({
        id: bangumiEpisodes.id,
        bangumiId: bangumiEpisodes.bangumiId,
        number: bangumiEpisodes.number,
      })
      .from(bangumiEpisodes),
    db
      .select({
        episodeId: episodeInfos.episodeId,
        lang: episodeInfos.lang,
        title: episodeInfos.title,
        content: episodeInfos.content,
      })
      .from(episodeInfos),
  ]);

  // Primary title/synopsis per series, plus the collected synonyms.
  const primaryTitle = new Map<number, string>();
  const primaryContent = new Map<number, string>();
  const synonyms = new Map<number, string[]>();
  for (const info of infoRows) {
    if (info.kind === "primary") {
      if (info.title) primaryTitle.set(info.bangumiId, info.title);
      const content = info.content?.trim();
      if (content) primaryContent.set(info.bangumiId, content);
    } else if (info.title) {
      const list = synonyms.get(info.bangumiId) ?? [];
      list.push(info.title);
      synonyms.set(info.bangumiId, list);
    }
  }

  // One title/synopsis per episode, keeping the preferred language.
  const episodeMeta = new Map<number, { lang: string; title: string | null; content: string | null }>();
  for (const info of episodeInfoRows) {
    const current = episodeMeta.get(info.episodeId);
    if (!current || langRank(info.lang) < langRank(current.lang)) {
      episodeMeta.set(info.episodeId, {
        lang: info.lang,
        title: info.title,
        content: info.content,
      });
    }
  }

  const episodesBySeries = new Map<number, LlmEpisodeEntry[]>();
  for (const episode of episodeRows) {
    const meta = episodeMeta.get(episode.id);
    const list = episodesBySeries.get(episode.bangumiId) ?? [];
    list.push({
      id: episode.id,
      number: episode.number,
      title: meta?.title?.trim() || null,
      content: meta?.content?.trim() || null,
    });
    episodesBySeries.set(episode.bangumiId, list);
  }
  for (const list of episodesBySeries.values()) {
    list.sort((a, b) => a.number - b.number);
  }

  return seriesRows
    .map((row) => ({
      id: row.id,
      title: primaryTitle.get(row.id) ?? "",
      content: primaryContent.get(row.id) ?? null,
      synonyms: synonyms.get(row.id) ?? [],
      season: row.season,
      year: row.year,
      origin: row.origin,
      type: row.type,
      airDay: row.airDay,
      episodes: episodesBySeries.get(row.id) ?? [],
    }))
    .filter((series) => series.title.length > 0)
    // Explicit "en" collation keeps the order stable and consistent with the
    // ASCII ordering listSeriesForLlm gets from the database.
    .sort((a, b) => a.title.localeCompare(b.title, "en"));
}
