import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bangumi,
  bangumiEpisodes,
  bangumiInfos,
  torrentItems,
  type Bangumi,
  type TorrentItem,
} from "@/db/schema";

/**
 * Bangumi tracker linking: attaches torrents to tracked series by comparing
 * the parsed series title against every structured name of the bangumi
 * (primary + synonyms, any language; case-insensitive containment in
 * either direction). When the episode number is parsed too, the torrent
 * is also attached to the bangumi's episode row.
 *
 * Torrents carry no owner column, so matching runs over all tracked bangumi
 * (single-admin deployment).
 */

/** All matching names (lowercased) of the given bangumi rows, keyed by id. */
export async function bangumiNameMap(rows: Bangumi[]): Promise<Map<number, string[]>> {
  if (rows.length === 0) return new Map();
  const titles = await db
    .select({ bangumiId: bangumiInfos.bangumiId, title: bangumiInfos.title })
    .from(bangumiInfos)
    .where(
      inArray(
        bangumiInfos.bangumiId,
        rows.map((r) => r.id)
      )
    );
  const map = new Map<number, string[]>();
  for (const { bangumiId, title } of titles) {
    const list = map.get(bangumiId);
    const value = title.trim().toLowerCase();
    if (!value) continue;
    if (list) list.push(value);
    else map.set(bangumiId, [value]);
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

/** Find the episode row of an bangumi, creating it on first sight. */
export async function findOrCreateEpisode(
  bangumiId: number,
  number: number
): Promise<number> {
  const existing = await db
    .select({ id: bangumiEpisodes.id })
    .from(bangumiEpisodes)
    .where(and(eq(bangumiEpisodes.bangumiId, bangumiId), eq(bangumiEpisodes.number, number)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(bangumiEpisodes)
    .values({ bangumiId, number })
    .onConflictDoNothing({
      target: [bangumiEpisodes.bangumiId, bangumiEpisodes.number],
    })
    .returning({ id: bangumiEpisodes.id });
  if (inserted[0]) return inserted[0].id;

  // Lost a concurrent insert race — take the winner's row
  const winner = await db
    .select({ id: bangumiEpisodes.id })
    .from(bangumiEpisodes)
    .where(and(eq(bangumiEpisodes.bangumiId, bangumiId), eq(bangumiEpisodes.number, number)))
    .limit(1);
  if (!winner[0]) throw new Error(`episode row vanished: bangumi=${bangumiId} ep=${number}`);
  return winner[0].id;
}

/**
 * Attach a torrent to an bangumi (and its episode row when the episode
 * number is known). Returns the bangumi id when a match was found.
 */
async function attachTorrent(
  torrent: TorrentItem,
  target: Bangumi
): Promise<number | null> {
  const episodeId =
    torrent.episode != null
      ? await findOrCreateEpisode(target.id, torrent.episode)
      : null;
  await db
    .update(torrentItems)
    .set({ bangumiId: target.id, episodeId })
    .where(eq(torrentItems.id, torrent.id));
  return target.id;
}

/** Try to link one (freshly ingested) torrent to a tracked bangumi. */
export async function linkTorrent(torrent: TorrentItem): Promise<void> {
  if (!torrent.bangumiTitle && !torrent.title) return;

  const rows = await db.select().from(bangumi);
  const names = await bangumiNameMap(rows);
  for (const row of rows) {
    const needles = names.get(row.id) ?? [];
    const seasonOk = torrent.season == null || row.season === torrent.season;
    if (
      seasonOk &&
      (matchesName(torrent.bangumiTitle, needles) || matchesName(torrent.title, needles))
    ) {
      await attachTorrent(torrent, row);
      return;
    }
  }
}

/**
 * Backfill: (re)link all unlinked torrents to `target`. Called when an
 * bangumi is created or any of its names change. Torrents previously
 * attached to `target` are detached first (deleting the bangumi's episode
 * rows) so they can settle on the new names.
 */
export async function backfillBangumi(target: Bangumi): Promise<number> {
  const names = (await bangumiNameMap([target])).get(target.id) ?? [];
  if (names.length === 0) return 0;

  // Detach: dropping the episode rows nulls torrent_items.episode_id
  await db.delete(bangumiEpisodes).where(eq(bangumiEpisodes.bangumiId, target.id));
  const unlinked = await db
    .update(torrentItems)
    .set({ bangumiId: null, episodeId: null })
    .where(or(isNull(torrentItems.bangumiId), eq(torrentItems.bangumiId, target.id)))
    .returning({ torrent: torrentItems });

  let linked = 0;
  for (const { torrent } of unlinked) {
    const seasonOk = torrent.season == null || target.season === torrent.season;
    if (
      seasonOk &&
      (matchesName(torrent.bangumiTitle, names) || matchesName(torrent.title, names))
    ) {
      await attachTorrent(torrent, target);
      linked++;
    }
  }
  return linked;
}
