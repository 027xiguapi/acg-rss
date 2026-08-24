"use server";

import { revalidatePath } from "next/cache";
import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { anime, animeEpisodes, animeInfos, episodeInfos } from "@/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { backfillAnime } from "./linker";
import { parseNamesField } from "./names";

export interface AnimeFormState {
  ok?: boolean;
  error?: string;
}

const WATCH_STATUSES = [
  "PLANNED",
  "WATCHING",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
] as const;

const ANIME_ORIGINS = [
  "JP",
  "CN",
  "HK",
  "TW",
  "KR",
  "WEST",
  "OTHER",
] as const;

const ANIME_TYPES = [
  "TV",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "OTHER",
] as const;

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().int().min(0).max(10_000_000).optional()
);

/** Weekly air day, ISO weekday: 1=Mon … 7=Sun */
const optionalAirDay = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().int().min(1).max(7).optional()
);

const optionalOrigin = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.enum(ANIME_ORIGINS).optional()
);

const optionalType = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.enum(ANIME_TYPES).optional()
);

/** Cover image URL; empty string → unset, must be an absolute http(s) link */
const optionalCoverUrl = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(2048).regex(/^https?:\/\//i).optional()
);

const animeSchema = z.object({
  title: z.string().trim().min(1).max(255),
  season: optionalNumber,
  year: optionalNumber,
  origin: optionalOrigin,
  airDay: optionalAirDay,
  type: optionalType,
  coverUrl: optionalCoverUrl,
  watchStatus: z.enum(WATCH_STATUSES),
});

/** Create or update (when an id is present) a tracked anime, then backfill links. */
export async function saveAnimeAction(
  _prev: AnimeFormState,
  formData: FormData
): Promise<AnimeFormState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const parsed = animeSchema.safeParse({
    title: formData.get("title"),
    season: formData.get("season") || 1,
    year: formData.get("year"),
    origin: formData.get("origin"),
    airDay: formData.get("airDay"),
    type: formData.get("type"),
    coverUrl: formData.get("coverUrl"),
    watchStatus: formData.get("watchStatus") || "WATCHING",
  });
  if (!parsed.success) return { error: "invalid" };
  // The form title becomes the primary name in anime_infos; the anime row
  // itself carries no title. null (not undefined) so the update clears the
  // columns when unset.
  const { title, ...rest } = parsed.data;
  const data = {
    ...rest,
    season: parsed.data.season ?? 1,
    origin: parsed.data.origin ?? null,
    airDay: parsed.data.airDay ?? null,
    type: parsed.data.type ?? null,
    coverUrl: parsed.data.coverUrl ?? null,
  };

  // Synonym names come from the multi-line field, excluding the primary
  const namesField = formData.get("names");
  const synonyms = parseNamesField(
    typeof namesField === "string" ? namesField : null
  ).filter((n) => n.title.toLowerCase() !== title.toLowerCase());

  const id = Number(formData.get("id"));
  let row;

  if (Number.isInteger(id) && id > 0) {
    const updated = await db
      .update(anime)
      .set({ ...data, updatedBy: user.id })
      .where(and(eq(anime.id, id), eq(anime.userId, user.id)))
      .returning();
    row = updated[0];
  } else {
    const inserted = await db
      .insert(anime)
      .values({ userId: user.id, updatedBy: user.id, ...data })
      .returning();
    row = inserted[0];
  }

  if (row) {
    // Replace the structured names: primary + synonyms
    await db.delete(animeInfos).where(eq(animeInfos.animeId, row.id));
    await db.insert(animeInfos).values([
      { animeId: row.id, kind: "primary", lang: null, title },
      ...synonyms.map((n) => ({
        animeId: row.id,
        kind: "synonym",
        lang: n.lang,
        title: n.title,
      })),
    ]);
    try {
      await backfillAnime(row);
    } catch (err) {
      console.error("[anime] backfill failed:", err);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAnimeAction(formData: FormData): Promise<void> {
  const user = await getAdminUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db.delete(anime).where(and(eq(anime.id, id), eq(anime.userId, user.id)));
  revalidatePath("/", "layout");
}

export interface EpisodeFormState {
  ok?: boolean;
  error?: string;
}

/** Update an episode's cover image (multilingual synopses have their own
 *  action). Admin only. */
export async function saveEpisodeAction(
  _prev: EpisodeFormState,
  formData: FormData
): Promise<EpisodeFormState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "invalid" };

  const rawCover = formData.get("coverUrl");
  const coverUrl = typeof rawCover === "string" ? rawCover.trim() : "";
  if (coverUrl.length > 2048 || (coverUrl && !/^https?:\/\//i.test(coverUrl))) {
    return { error: "invalid" };
  }

  const updated = await db
    .update(animeEpisodes)
    .set({ coverUrl: coverUrl || null })
    .where(eq(animeEpisodes.id, id))
    .returning({ id: animeEpisodes.id });
  if (!updated[0]) return { error: "invalid" };

  revalidatePath("/", "layout");
  return { ok: true };
}

export interface EpisodeInfosState {
  ok?: boolean;
  error?: string;
}

const contentLangSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(/^[a-z][a-z0-9-]*$/i);

/**
 * Replace the multilingual info (title + synopsis) of one episode. `lang`,
 * `title` and `content` arrive as parallel field arrays; languages missing
 * from the submission (or sent with both fields empty) are removed.
 */
export async function saveEpisodeInfosAction(
  _prev: EpisodeInfosState,
  formData: FormData
): Promise<EpisodeInfosState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const episodeId = Number(formData.get("episodeId"));
  if (!Number.isInteger(episodeId) || episodeId <= 0) return { error: "invalid" };

  const langs = formData.getAll("lang").map(String);
  const titles = formData.getAll("title").map(String);
  const contents = formData.getAll("content").map(String);
  if (langs.length !== titles.length || langs.length !== contents.length) {
    return { error: "invalid" };
  }

  const rows: { lang: string; title: string | null; content: string | null }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < langs.length; i++) {
    const lang = contentLangSchema.safeParse(langs[i]);
    if (!lang.success) return { error: "invalid" };
    const title = titles[i].trim();
    const content = contents[i].trim();
    if (title.length > 255) return { error: "invalid" };
    if (content.length > 10_000) return { error: "invalid" };
    if (seen.has(lang.data)) return { error: "invalid" };
    seen.add(lang.data);
    // Both fields empty means "drop this language" on save
    if (title || content) {
      rows.push({ lang: lang.data, title: title || null, content: content || null });
    }
  }

  // Sync: delete languages absent from the payload, upsert the rest
  if (rows.length === 0) {
    await db.delete(episodeInfos).where(eq(episodeInfos.episodeId, episodeId));
  } else {
    await db
      .delete(episodeInfos)
      .where(
        and(
          eq(episodeInfos.episodeId, episodeId),
          notInArray(
            episodeInfos.lang,
            rows.map((row) => row.lang)
          )
        )
      );
    for (const row of rows) {
      await db
        .insert(episodeInfos)
        .values({ episodeId, ...row })
        .onConflictDoUpdate({
          target: [episodeInfos.episodeId, episodeInfos.lang],
          set: { title: row.title, content: row.content },
        });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
