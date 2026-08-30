"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bangumi, bangumiEpisodes, bangumiInfos, episodeInfos } from "@/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { backfillBangumi } from "./linker";
import { parseNamesField } from "./names";

export interface BangumiFormState {
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

const BANGUMI_ORIGINS = [
  "JP",
  "CN",
  "HK",
  "TW",
  "KR",
  "WEST",
  "OTHER",
] as const;

const BANGUMI_TYPES = [
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
  z.enum(BANGUMI_ORIGINS).optional()
);

const optionalType = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.enum(BANGUMI_TYPES).optional()
);

/** Cover image URL; empty string → unset, must be an absolute http(s) link */
const optionalCoverUrl = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(2048).regex(/^https?:\/\//i).optional()
);

const bangumiSchema = z.object({
  title: z.string().trim().min(1).max(255),
  season: optionalNumber,
  year: optionalNumber,
  origin: optionalOrigin,
  airDay: optionalAirDay,
  type: optionalType,
  coverUrl: optionalCoverUrl,
  watchStatus: z.enum(WATCH_STATUSES),
});

/** Create or update (when an id is present) a tracked bangumi, then backfill links. */
export async function saveBangumiAction(
  _prev: BangumiFormState,
  formData: FormData
): Promise<BangumiFormState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const parsed = bangumiSchema.safeParse({
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
  // The form title becomes the primary name in bangumi_infos; the bangumi row
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
      .update(bangumi)
      .set({ ...data, updatedBy: user.id })
      .where(and(eq(bangumi.id, id), eq(bangumi.userId, user.id)))
      .returning();
    row = updated[0];
  } else {
    const inserted = await db
      .insert(bangumi)
      .values({ userId: user.id, updatedBy: user.id, ...data })
      .returning();
    row = inserted[0];
  }

  if (row) {
    // Replace the structured names: primary + synonyms
    await db.delete(bangumiInfos).where(eq(bangumiInfos.bangumiId, row.id));
    await db.insert(bangumiInfos).values([
      { bangumiId: row.id, kind: "primary", lang: null, title },
      ...synonyms.map((n) => ({
        bangumiId: row.id,
        kind: "synonym",
        lang: n.lang,
        title: n.title,
      })),
    ]);
    try {
      await backfillBangumi(row);
    } catch (err) {
      console.error("[bangumi] backfill failed:", err);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Inline-update only the weekly air day of one bangumi from the admin table. */
export async function updateBangumiAirDayAction(formData: FormData): Promise<void> {
  const user = await getAdminUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  const rawDay = formData.get("airDay");
  const day =
    rawDay === "" || rawDay == null ? null : Number(rawDay);
  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 7)) return;

  await db
    .update(bangumi)
    .set({ airDay: day, updatedBy: user.id })
    .where(and(eq(bangumi.id, id), eq(bangumi.userId, user.id)));
  revalidatePath("/", "layout");
}

export async function deleteBangumiAction(formData: FormData): Promise<void> {
  const user = await getAdminUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db.delete(bangumi).where(and(eq(bangumi.id, id), eq(bangumi.userId, user.id)));
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
    .update(bangumiEpisodes)
    .set({ coverUrl: coverUrl || null })
    .where(eq(bangumiEpisodes.id, id))
    .returning({ id: bangumiEpisodes.id });
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

export interface EpisodeMetaState {
  ok?: boolean;
  error?: string;
}

const episodeMetaSchema = z.object({
  id: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().positive().optional()
  ),
  bangumiId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().positive().optional()
  ),
  number: z.coerce.number().int().min(0).max(100_000),
});

/**
 * Create or renumber (when an id is present) an episode. Creation requires a
 * series; renumbering keeps the episode in its current series and rejects a
 * duplicate (series, number) pair.
 */
export async function saveEpisodeMetaAction(
  _prev: EpisodeMetaState,
  formData: FormData
): Promise<EpisodeMetaState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const parsed = episodeMetaSchema.safeParse({
    id: formData.get("id"),
    bangumiId: formData.get("bangumiId"),
    number: formData.get("number"),
  });
  if (!parsed.success) return { error: "invalid" };
  const { id, bangumiId, number } = parsed.data;

  if (id != null) {
    const [existing] = await db
      .select({ id: bangumiEpisodes.id, bangumiId: bangumiEpisodes.bangumiId })
      .from(bangumiEpisodes)
      .where(eq(bangumiEpisodes.id, id))
      .limit(1);
    if (!existing) return { error: "invalid" };

    const [clash] = await db
      .select({ id: bangumiEpisodes.id })
      .from(bangumiEpisodes)
      .where(
        and(
          eq(bangumiEpisodes.bangumiId, existing.bangumiId),
          eq(bangumiEpisodes.number, number),
          ne(bangumiEpisodes.id, id)
        )
      )
      .limit(1);
    if (clash) return { error: "duplicate" };

    await db
      .update(bangumiEpisodes)
      .set({ number })
      .where(eq(bangumiEpisodes.id, id));
  } else {
    if (bangumiId == null) return { error: "invalid" };
    const inserted = await db
      .insert(bangumiEpisodes)
      .values({ bangumiId, number })
      .onConflictDoNothing({
        target: [bangumiEpisodes.bangumiId, bangumiEpisodes.number],
      })
      .returning({ id: bangumiEpisodes.id });
    if (!inserted[0]) return { error: "duplicate" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteEpisodeAction(formData: FormData): Promise<void> {
  const user = await getAdminUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db.delete(bangumiEpisodes).where(eq(bangumiEpisodes.id, id));
  revalidatePath("/", "layout");
}
