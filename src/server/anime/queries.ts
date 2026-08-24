import { eq, max } from "drizzle-orm";
import { db } from "@/db";
import {
  anime,
  animeEpisodes,
  animeInfos,
  type Anime,
  type AnimeWithTitle,
} from "@/db/schema";

/** One anime plus its latest episode number, as shown on a poster card. */
export type AnimeCardData = { item: AnimeWithTitle; latest: number | null };

export type AnimeIndex = {
  /** Total tracked anime, regardless of the search filter. */
  total: number;
  /** Anime matching the search query (all anime when the query is empty). */
  results: AnimeCardData[];
  /** One section per ISO weekday (1=Mon … 7=Sun), empty sections included. */
  daySections: { day: number; entries: AnimeCardData[] }[];
  /** Anime without a valid weekly air day. */
  unscheduled: AnimeCardData[];
};

/** Primary display names of every anime (kind=primary in anime_infos). */
export async function primaryTitleMap(): Promise<Map<number, string>> {
  const rows = await db
    .select({ animeId: animeInfos.animeId, title: animeInfos.title })
    .from(animeInfos)
    .where(eq(animeInfos.kind, "primary"));
  return new Map(rows.map((row) => [row.animeId, row.title]));
}

/** Decorate raw anime rows with their primary display name and sort by it. */
export async function withTitles(rows: Anime[]): Promise<AnimeWithTitle[]> {
  const titles = await primaryTitleMap();
  return rows
    .map((r) => ({ ...r, title: titles.get(r.id) ?? "" }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Load the public index: tracked anime with episode stats, optionally
 * filtered by a title/synonym search and grouped by weekly air day. */
export async function getAnimeIndex(query: string): Promise<AnimeIndex> {
  const [rows, episodeStats, nameRows] = await Promise.all([
    db.select().from(anime),
    db
      .select({
        animeId: animeEpisodes.animeId,
        latest: max(animeEpisodes.number),
      })
      .from(animeEpisodes)
      .groupBy(animeEpisodes.animeId),
    // All names (primary + synonyms) for display and search
    db
      .select({ animeId: animeInfos.animeId, title: animeInfos.title })
      .from(animeInfos),
  ]);

  const decorated = await withTitles(rows);
  const latestMap = new Map(episodeStats.map((s) => [s.animeId, s.latest]));
  const toEntry = (item: AnimeWithTitle): AnimeCardData => ({
    item,
    latest: latestMap.get(item.id) ?? null,
  });

  // Search matches the primary title and all synonym names
  let visible = decorated;
  if (query) {
    const needle = query.toLowerCase();
    const synonymHit = new Set<number>();
    for (const row of nameRows) {
      if (row.title.toLowerCase().includes(needle)) synonymHit.add(row.animeId);
    }
    visible = decorated.filter((r) => r.title.toLowerCase().includes(needle) || synonymHit.has(r.id));
  }

  // Group by weekly air day (ISO weekday); the rest land in "unscheduled"
  const byDay = new Map<number, AnimeCardData[]>();
  const unscheduled: AnimeCardData[] = [];
  for (const item of visible) {
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
    daySections: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
      day,
      entries: byDay.get(day) ?? [],
    })),
    unscheduled,
  };
}
