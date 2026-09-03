"use server";

import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { bangumi, bangumiInfos, bangumiEpisodes, torrentItems } from "@/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { findOrCreateEpisode, linkTorrent } from "@/server/bangumi/linker";
import {
  computeInfoHash,
  extractSubgroup,
  extractSubtitleInfo,
  parseTorrentTitle,
} from "@/lib/parser";
import { resolveOrCreateSubgroupId } from "@/server/subgroups/resolve";
import { parseIdList } from "@/lib/form-data";
import { searchPattern } from "@/lib/pagination";

export interface TorrentFormState {
  ok?: boolean;
  error?: string;
}

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional()
  );

const torrentSchema = z
  .object({
    title: z.string().trim().min(1).max(2000),
    magnet: optionalText(2000),
    torrentUrl: optionalText(2000),
    sizeMb: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.number().min(0).max(10_000_000).optional()
    ),
    category: optionalText(128),
  })
  .refine((d) => d.magnet || d.torrentUrl, {
    message: "needLink",
  });

/** Remove the episode row when its last torrent is gone. */
async function cleanupEmptyEpisode(episodeId: number | null): Promise<void> {
  if (episodeId == null) return;
  const [row] = await db
    .select({ id: torrentItems.id })
    .from(torrentItems)
    .where(eq(torrentItems.episodeId, episodeId))
    .limit(1);
  if (!row) {
    await db.delete(bangumiEpisodes).where(eq(bangumiEpisodes.id, episodeId));
  }
}

/** Insert a manually added torrent, auto-parse its title and link it. */
export async function createTorrentAction(
  _prev: TorrentFormState,
  formData: FormData
): Promise<TorrentFormState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const parsed = torrentSchema.safeParse({
    title: formData.get("title"),
    magnet: formData.get("magnet"),
    torrentUrl: formData.get("torrentUrl"),
    sizeMb: formData.get("sizeMb"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  const parsedTitle = parseTorrentTitle(data.title);
  const subgroup = extractSubgroup(data.title);
  const subgroupId = await resolveOrCreateSubgroupId(subgroup);
  const subtitleInfo = extractSubtitleInfo(data.title);
  const inserted = await db
    .insert(torrentItems)
    .values({
      title: data.title,
      magnet: data.magnet,
      torrentUrl: data.torrentUrl,
      infoHash: computeInfoHash(data.magnet, data.torrentUrl),
      size: data.sizeMb != null ? Math.round(data.sizeMb * 1024 * 1024) : null,
      category: data.category,
      bangumiTitle: parsedTitle.bangumiTitle,
      season: parsedTitle.season,
      episode: parsedTitle.episode,
      resolution: parsedTitle.resolution,
      subgroup,
      subgroupId,
      subtitleLanguages: subtitleInfo.languages.length ? subtitleInfo.languages : null,
      subtitleFormat: subtitleInfo.format,
    })
    .onConflictDoNothing({ target: torrentItems.infoHash })
    .returning();

  const row = inserted[0];
  if (!row) return { error: "duplicate" };

  try {
    await linkTorrent(row);
  } catch (err) {
    console.error(`[torrents] linker failed for #${row.id}:`, err);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Update a torrent: fields are re-parsed and links re-resolved. */
export async function updateTorrentAction(
  _prev: TorrentFormState,
  formData: FormData
): Promise<TorrentFormState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "invalid" };

  const parsed = torrentSchema.safeParse({
    title: formData.get("title"),
    magnet: formData.get("magnet"),
    torrentUrl: formData.get("torrentUrl"),
    sizeMb: formData.get("sizeMb"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  const [existing] = await db
    .select()
    .from(torrentItems)
    .where(eq(torrentItems.id, id))
    .limit(1);
  if (!existing) return { error: "invalid" };

  const infoHash = computeInfoHash(data.magnet, data.torrentUrl);
  if (infoHash !== existing.infoHash) {
    const [clash] = await db
      .select({ id: torrentItems.id })
      .from(torrentItems)
      .where(eq(torrentItems.infoHash, infoHash))
      .limit(1);
    if (clash) return { error: "duplicate" };
  }

  const parsedTitle = parseTorrentTitle(data.title);
  const subgroup = extractSubgroup(data.title);
  const subgroupId = await resolveOrCreateSubgroupId(subgroup);
  const subtitleInfo = extractSubtitleInfo(data.title);
  const updated = await db
    .update(torrentItems)
    .set({
      title: data.title,
      magnet: data.magnet,
      torrentUrl: data.torrentUrl,
      infoHash,
      size: data.sizeMb != null ? Math.round(data.sizeMb * 1024 * 1024) : null,
      category: data.category,
      bangumiTitle: parsedTitle.bangumiTitle,
      season: parsedTitle.season,
      episode: parsedTitle.episode,
      resolution: parsedTitle.resolution,
      subgroup,
      subgroupId,
      subtitleLanguages: subtitleInfo.languages.length ? subtitleInfo.languages : null,
      subtitleFormat: subtitleInfo.format,
      // Links are re-resolved from the new title below
      bangumiId: null,
      episodeId: null,
    })
    .where(eq(torrentItems.id, id))
    .returning();

  const row = updated[0];
  if (row) {
    try {
      await linkTorrent(row);
    } catch (err) {
      console.error(`[torrents] linker failed for #${row.id}:`, err);
    }
    await cleanupEmptyEpisode(existing.episodeId);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTorrentAction(formData: FormData): Promise<void> {
  const user = await getAdminUser();
  if (!user) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const [existing] = await db
    .select({ episodeId: torrentItems.episodeId })
    .from(torrentItems)
    .where(eq(torrentItems.id, id))
    .limit(1);

  await db.delete(torrentItems).where(eq(torrentItems.id, id));
  if (existing) await cleanupEmptyEpisode(existing.episodeId);

  revalidatePath("/", "layout");
}

/** Delete every torrent checked in the admin table (formData ids). */
export async function batchDeleteTorrentsAction(
  formData: FormData
): Promise<void> {
  const user = await getAdminUser();
  if (!user) return;

  const ids = parseIdList(formData);
  if (ids.length === 0) return;

  const affected = await db
    .select({ episodeId: torrentItems.episodeId })
    .from(torrentItems)
    .where(inArray(torrentItems.id, ids));

  await db.delete(torrentItems).where(inArray(torrentItems.id, ids));
  for (const episodeId of new Set(
    affected.map((row) => row.episodeId).filter((id): id is number => id != null)
  )) {
    await cleanupEmptyEpisode(episodeId);
  }

  revalidatePath("/", "layout");
}

/** One selectable bangumi for the manual link dropdown. */
export interface BangumiSearchResult {
  id: number;
  title: string;
}

/**
 * Search tracked bangumi by primary title for the manual link dropdown. An
 * empty query returns the first results alphabetically so the dropdown isn't
 * blank when opened.
 */
export async function searchBangumiAction(
  query: string
): Promise<BangumiSearchResult[]> {
  const user = await getAdminUser();
  if (!user) return [];

  const rows = await db
    .select({ id: bangumi.id, title: bangumiInfos.title })
    .from(bangumi)
    .innerJoin(bangumiInfos, eq(bangumiInfos.bangumiId, bangumi.id))
    .where(
      and(
        eq(bangumiInfos.kind, "primary"),
        ilike(bangumiInfos.title, searchPattern(query.trim()))
      )
    )
    .orderBy(asc(bangumiInfos.title))
    .limit(20);

  return rows;
}

/**
 * Manually link an unlinked torrent to a tracked bangumi. When the torrent
 * carries a parsed episode number, its episode row is attached too.
 */
export async function linkTorrentToBangumiAction(
  torrentId: number,
  bangumiId: number
): Promise<{ ok: boolean; error?: string }> {
  const user = await getAdminUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  if (!Number.isInteger(torrentId) || !Number.isInteger(bangumiId)) {
    return { ok: false, error: "invalid" };
  }

  const [torrent] = await db
    .select({ id: torrentItems.id, episode: torrentItems.episode })
    .from(torrentItems)
    .where(eq(torrentItems.id, torrentId))
    .limit(1);
  if (!torrent) return { ok: false, error: "invalid" };

  const episodeId =
    torrent.episode != null
      ? await findOrCreateEpisode(bangumiId, torrent.episode)
      : null;

  await db
    .update(torrentItems)
    .set({ bangumiId, episodeId })
    .where(eq(torrentItems.id, torrentId));

  revalidatePath("/", "layout");
  return { ok: true };
}
