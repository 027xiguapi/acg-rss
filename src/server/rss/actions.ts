"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { rssFeeds } from "@/db/schema";
import { getAdminUser } from "@/server/auth/session";
import {
  cleanSeriesTitle,
  createBangumi,
  findBangumiIdByTitle,
} from "@/server/rss/import";
import { ingestFeed, ingestItems, parseFeed } from "@/server/rss/fetch";
import { parseTorrentTitle } from "@/lib/parser";

export interface RssFeedFormState {
  ok?: boolean;
  error?: string;
}

export interface FetchState {
  ok?: boolean;
  created?: number;
  skipped?: number;
  error?: string;
}

/** Result of subscribing by URL, echoed back for the success toast. */
export interface SubscribeFeedState {
  ok?: boolean;
  series?: string;
  created?: number;
  skipped?: number;
  /** Stable error code: invalid | duplicate | fetch | noItems | noSeries | ingest */
  error?: string;
}

const rssFeedSchema = z.object({
  name: z.string().trim().min(1).max(255),
  url: z.string().trim().url().max(2048),
  bangumiId: z.coerce.number().int().positive(),
});

const subscribeUrlSchema = z.string().trim().url().max(2048);

/**
 * Subscribe with just a feed URL, mirroring the batch XML importer:
 * fetch the feed, derive the series title from the channel metadata
 * (falling back to the first item's title), create or reuse the tracked
 * bangumi, register the subscription and ingest its current items.
 */
export async function subscribeRssByUrlAction(
  _prev: SubscribeFeedState,
  formData: FormData
): Promise<SubscribeFeedState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const urlResult = subscribeUrlSchema.safeParse(formData.get("url"));
  if (!urlResult.success) return { error: "invalid" };
  const url = urlResult.data;

  const [existing] = await db
    .select({ id: rssFeeds.id })
    .from(rssFeeds)
    .where(eq(rssFeeds.url, url))
    .limit(1);
  if (existing) return { error: "duplicate" };

  let parsedFeed;
  try {
    parsedFeed = await parseFeed(url);
  } catch {
    return { error: "fetch" };
  }
  if (parsedFeed.items.length === 0) return { error: "noItems" };

  const firstParsed = parseTorrentTitle(parsedFeed.items[0].title);
  const seriesTitle =
    cleanSeriesTitle(parsedFeed.title) ??
    cleanSeriesTitle(firstParsed.bangumiTitle);
  if (!seriesTitle) return { error: "noSeries" };

  let bangumiId = await findBangumiIdByTitle(seriesTitle);
  if (bangumiId == null) {
    bangumiId = await createBangumi(user, seriesTitle, firstParsed.season ?? 1);
  }

  // The unique index on url also guards against a concurrent duplicate.
  const inserted = await db
    .insert(rssFeeds)
    .values({ name: seriesTitle, url, bangumiId })
    .onConflictDoNothing({ target: rssFeeds.url })
    .returning({ id: rssFeeds.id });
  if (inserted.length === 0) return { error: "duplicate" };

  try {
    const ingested = await ingestItems(bangumiId, parsedFeed.items);
    revalidatePath("/", "layout");
    return {
      ok: true,
      series: seriesTitle,
      created: ingested.created,
      skipped: ingested.skipped,
    };
  } catch {
    // The subscription itself is in place; a later manual/cron fetch can retry.
    return { error: "ingest" };
  }
}

export async function updateRssFeedAction(
  _prev: RssFeedFormState,
  formData: FormData
): Promise<RssFeedFormState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "invalid" };

  const parsed = rssFeedSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
    bangumiId: formData.get("bangumiId"),
  });
  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  const [existing] = await db
    .select({ id: rssFeeds.id })
    .from(rssFeeds)
    .where(eq(rssFeeds.url, data.url))
    .limit(1);
  if (existing && existing.id !== id) return { error: "duplicate" };

  await db
    .update(rssFeeds)
    .set({ name: data.name, url: data.url, bangumiId: data.bangumiId })
    .where(eq(rssFeeds.id, id));

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteRssFeedAction(formData: FormData): Promise<void> {
  const user = await getAdminUser();
  if (!user) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db.delete(rssFeeds).where(eq(rssFeeds.id, id));
  revalidatePath("/", "layout");
}

/** Fetch one feed (formData.id) or every feed (no id). */
export async function fetchFeedsAction(
  _prev: FetchState,
  formData: FormData
): Promise<FetchState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const rawId = formData.get("id");
  const id = rawId ? Number(rawId) : null;

  const feeds = id
    ? await db.select().from(rssFeeds).where(eq(rssFeeds.id, id)).limit(1)
    : await db.select().from(rssFeeds).where(eq(rssFeeds.enabled, true));

  let created = 0;
  let skipped = 0;
  let firstError: string | undefined;

  for (const feed of feeds) {
    const result = await ingestFeed(feed);
    created += result.created;
    skipped += result.skipped;
    if (result.error && !firstError) firstError = result.error;
  }

  revalidatePath("/", "layout");
  return { ok: true, created, skipped, error: firstError };
}
