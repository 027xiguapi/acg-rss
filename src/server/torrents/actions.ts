"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { bangumiEpisodes, torrentItems } from "@/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { linkTorrent } from "@/server/bangumi/linker";
import { computeInfoHash, extractSubgroup, parseTorrentTitle } from "@/lib/parser";
import { resolveSubgroupId } from "@/server/subgroups/resolve";

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
  const subgroupId = await resolveSubgroupId(subgroup);
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
  const subgroupId = await resolveSubgroupId(subgroup);
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
