import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  anime,
  animeEpisodes,
  animeInfos,
  torrentItems,
  type Anime,
  type TorrentItem,
} from "@/db/schema";

/**
 * Anime tracker linking: attaches torrents to tracked series by comparing
 * the parsed series title against every structured name of the anime
 * (primary + synonyms, any language; case-insensitive containment in
 * either direction). When the episode number is parsed too, the torrent
 * is also attached to the anime's episode row.
 *
 * Torrents carry no owner column, so matching runs over all tracked anime
 * (single-admin deployment).
 */

/** All matching names (lowercased) of the given anime rows, keyed by id. */
export async function animeNameMap(rows: Anime[]): Promise<Map<number, string[]>> {
  if (rows.length === 0) return new Map();
  const titles = await db
    .select({ animeId: animeInfos.animeId, title: animeInfos.title })
    .from(animeInfos)
    .where(
      inArray(
        animeInfos.animeId,
        rows.map((r) => r.id)
      )
    );
  const map = new Map<number, string[]>();
  for (const { animeId, title } of titles) {
    const list = map.get(animeId);
    const value = title.trim().toLowerCase();
    if (!value) continue;
    if (list) list.push(value);
    else map.set(animeId, [value]);
  }
  return map;
}

function matchesName(haystack: string | null | undefined, needles: string[]): boolean {
  if (!haystack) return false;
  const title = haystack.toLowerCase();
  return needles.some(
    (n) => title.includes(n) || (n.length >= 3 && n.includes(title))
  );
}

/** Find the episode row of an anime, creating it on first sight. */
export async function findOrCreateEpisode(
  animeId: number,
  number: number
): Promise<number> {
  const existing = await db
    .select({ id: animeEpisodes.id })
    .from(animeEpisodes)
    .where(and(eq(animeEpisodes.animeId, animeId), eq(animeEpisodes.number, number)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(animeEpisodes)
    .values({ animeId, number })
    .onConflictDoNothing({
      target: [animeEpisodes.animeId, animeEpisodes.number],
    })
    .returning({ id: animeEpisodes.id });
  if (inserted[0]) return inserted[0].id;

  // Lost a concurrent insert race — take the winner's row
  const winner = await db
    .select({ id: animeEpisodes.id })
    .from(animeEpisodes)
    .where(and(eq(animeEpisodes.animeId, animeId), eq(animeEpisodes.number, number)))
    .limit(1);
  if (!winner[0]) throw new Error(`episode row vanished: anime=${animeId} ep=${number}`);
  return winner[0].id;
}

/**
 * Attach a torrent to an anime (and its episode row when the episode
 * number is known). Returns the anime id when a match was found.
 */
async function attachTorrent(
  torrent: TorrentItem,
  target: Anime
): Promise<number | null> {
  const episodeId =
    torrent.episode != null
      ? await findOrCreateEpisode(target.id, torrent.episode)
      : null;
  await db
    .update(torrentItems)
    .set({ animeId: target.id, episodeId })
    .where(eq(torrentItems.id, torrent.id));
  return target.id;
}

/** Try to link one (freshly ingested) torrent to a tracked anime. */
export async function linkTorrent(torrent: TorrentItem): Promise<void> {
  if (!torrent.animeTitle && !torrent.title) return;

  const rows = await db.select().from(anime);
  const names = await animeNameMap(rows);
  for (const row of rows) {
    const needles = names.get(row.id) ?? [];
    const seasonOk = torrent.season == null || row.season === torrent.season;
    if (
      seasonOk &&
      (matchesName(torrent.animeTitle, needles) || matchesName(torrent.title, needles))
    ) {
      await attachTorrent(torrent, row);
      return;
    }
  }
}

/**
 * Backfill: (re)link all unlinked torrents to `target`. Called when an
 * anime is created or any of its names change. Torrents previously
 * attached to `target` are detached first (deleting the anime's episode
 * rows) so they can settle on the new names.
 */
export async function backfillAnime(target: Anime): Promise<number> {
  const names = (await animeNameMap([target])).get(target.id) ?? [];
  if (names.length === 0) return 0;

  // Detach: dropping the episode rows nulls torrent_items.episode_id
  await db.delete(animeEpisodes).where(eq(animeEpisodes.animeId, target.id));
  const unlinked = await db
    .update(torrentItems)
    .set({ animeId: null, episodeId: null })
    .where(or(isNull(torrentItems.animeId), eq(torrentItems.animeId, target.id)))
    .returning({ torrent: torrentItems });

  let linked = 0;
  for (const { torrent } of unlinked) {
    const seasonOk = torrent.season == null || target.season === torrent.season;
    if (
      seasonOk &&
      (matchesName(torrent.animeTitle, names) || matchesName(torrent.title, names))
    ) {
      await attachTorrent(torrent, target);
      linked++;
    }
  }
  return linked;
}
