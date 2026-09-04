import { and, desc, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bangumi,
  bangumiEpisodes,
  bangumiFavorites,
  bangumiInfos,
  torrentItems,
  type Bangumi,
  type BangumiWithTitle,
} from "@/db/schema";

/** One bangumi plus its latest episode number, as shown on a poster card. */
export type BangumiCardData = {
  item: BangumiWithTitle;
  latest: number | null;
  /** Primary title used to resolve the local poster filename. */
  coverName: string | null;
};

export type BangumiIndex = {
  /** Total tracked bangumi, regardless of the search filter. */
  total: number;
  /** Bangumi matching the search query (all bangumi when the query is empty). */
  results: BangumiCardData[];
  /** One section per ISO weekday (1=Mon … 7=Sun) that has entries, Sunday first. */
  daySections: { day: number; entries: BangumiCardData[] }[];
  /** Bangumi typed MOVIE, shown as their own category. */
  movie: BangumiCardData[];
  /** Bangumi typed OVA, shown as their own category. */
  ova: BangumiCardData[];
  /** Bangumi without a valid weekly air day. */
  unscheduled: BangumiCardData[];
  /** Distinct air years present across all tracked bangumi, newest first. */
  years: number[];
};

/** Primary display names of every bangumi (kind=primary in bangumi_infos). */
export async function primaryTitleMap(): Promise<Map<number, string>> {
  const rows = await db
    .select({ bangumiId: bangumiInfos.bangumiId, title: bangumiInfos.title })
    .from(bangumiInfos)
    .where(eq(bangumiInfos.kind, "primary"));
  return new Map(rows.map((row) => [row.bangumiId, row.title]));
}

/** Decorate raw bangumi rows with their primary display name and sort by it. */
export async function withTitles(rows: Bangumi[]): Promise<BangumiWithTitle[]> {
  const titles = await primaryTitleMap();
  return rows
    .map((r) => ({ ...r, title: titles.get(r.id) ?? "" }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Load the public index: tracked bangumi with episode stats, optionally
 * filtered by a title/synonym search and grouped by weekly air day. */
export async function getBangumiIndex(
  query: string,
  year?: number | null
): Promise<BangumiIndex> {
  const [rows, episodeStats, nameRows] = await Promise.all([
    db.select().from(bangumi),
    db
      .select({
        bangumiId: bangumiEpisodes.bangumiId,
        latest: max(bangumiEpisodes.number),
      })
      .from(bangumiEpisodes)
      .groupBy(bangumiEpisodes.bangumiId),
    // All names (primary + synonyms) for display and search
    db
      .select({
        bangumiId: bangumiInfos.bangumiId,
        title: bangumiInfos.title,
        lang: bangumiInfos.lang,
      })
      .from(bangumiInfos),
  ]);

  const decorated = await withTitles(rows);
  const latestMap = new Map(episodeStats.map((s) => [s.bangumiId, s.latest]));
  const toEntry = (item: BangumiWithTitle): BangumiCardData => ({
    item,
    latest: latestMap.get(item.id) ?? null,
    coverName: item.title || null,
  });

  // Distinct air years for the year filter, newest first
  const years = [
    ...new Set(rows.map((r) => r.year).filter((y): y is number => y != null)),
  ].sort((a, b) => b - a);

  // The year filter narrows the set before the text search
  let visible = year != null ? decorated.filter((r) => r.year === year) : decorated;
  if (query) {
    const needle = query.toLowerCase();
    const synonymHit = new Set<number>();
    for (const row of nameRows) {
      if (row.title.toLowerCase().includes(needle)) synonymHit.add(row.bangumiId);
    }
    visible = decorated.filter((r) => r.title.toLowerCase().includes(needle) || synonymHit.has(r.id));
  }

  // Group by weekly air day (ISO weekday), rendered Sunday-first (7→1) with
  // only the days that actually have entries; MOVIE / OVA get their own
  // categories and the rest land in "unscheduled"
  const byDay = new Map<number, BangumiCardData[]>();
  const movie: BangumiCardData[] = [];
  const ova: BangumiCardData[] = [];
  const unscheduled: BangumiCardData[] = [];
  for (const item of visible) {
    if (item.type === "MOVIE") {
      movie.push(toEntry(item));
      continue;
    }
    if (item.type === "OVA") {
      ova.push(toEntry(item));
      continue;
    }
    if (item.airDay && item.airDay >= 1 && item.airDay <= 7) {
      const entries = byDay.get(item.airDay) ?? [];
      entries.push(toEntry(item));
      byDay.set(item.airDay, entries);
    } else {
      unscheduled.push(toEntry(item));
    }
  }

  return {
    total: rows.length,
    results: visible.map(toEntry),
    daySections: [7, 6, 5, 4, 3, 2, 1]
      .map((day) => ({ day, entries: byDay.get(day) ?? [] }))
      .filter((section) => section.entries.length > 0),
    movie,
    ova,
    unscheduled,
    years,
  };
}

/** Load bangumi cards for a set of ids, preserving the caller's order. */
async function loadCardEntries(ids: number[]): Promise<BangumiCardData[]> {
  if (ids.length === 0) return [];
  const [rows, episodeStats, titleRows] = await Promise.all([
    db.select().from(bangumi).where(inArray(bangumi.id, ids)),
    db
      .select({
        bangumiId: bangumiEpisodes.bangumiId,
        latest: max(bangumiEpisodes.number),
      })
      .from(bangumiEpisodes)
      .where(inArray(bangumiEpisodes.bangumiId, ids))
      .groupBy(bangumiEpisodes.bangumiId),
    db
      .select({ bangumiId: bangumiInfos.bangumiId, title: bangumiInfos.title })
      .from(bangumiInfos)
      .where(
        and(
          inArray(bangumiInfos.bangumiId, ids),
          eq(bangumiInfos.kind, "primary")
        )
      ),
  ]);
  const titleMap = new Map(titleRows.map((r) => [r.bangumiId, r.title]));
  const latestMap = new Map(episodeStats.map((s) => [s.bangumiId, s.latest]));
  const bangumiMap = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => {
      const item = bangumiMap.get(id);
      if (!item) return null;
      return {
        item: { ...item, title: titleMap.get(id) ?? "" },
        latest: latestMap.get(id) ?? null,
        coverName: titleMap.get(id) ?? null,
      };
    })
    .filter((e): e is BangumiCardData => e != null);
}

/** Newest releases first: bangumi ordered by their latest torrent time. */
export async function getRecentBangumi(limit = 12): Promise<BangumiCardData[]> {
  const recentRows = await db
    .select({ bangumiId: torrentItems.bangumiId })
    .from(torrentItems)
    .where(isNotNull(torrentItems.bangumiId))
    .groupBy(torrentItems.bangumiId)
    .orderBy(
      desc(sql`max(coalesce(${torrentItems.publishTime}, ${torrentItems.createdAt}))`)
    )
    .limit(limit);
  return loadCardEntries(
    recentRows
      .map((r) => r.bangumiId)
      .filter((id): id is number => id != null)
  );
}

/** A user's favorited bangumi, newest favorite first. */
export async function getUserFavorites(
  userId: number,
  limit = 12
): Promise<BangumiCardData[]> {
  const favoriteRows = await db
    .select({ bangumiId: bangumiFavorites.bangumiId })
    .from(bangumiFavorites)
    .where(eq(bangumiFavorites.userId, userId))
    .orderBy(desc(bangumiFavorites.createdAt))
    .limit(limit);
  return loadCardEntries(favoriteRows.map((r) => r.bangumiId));
}
