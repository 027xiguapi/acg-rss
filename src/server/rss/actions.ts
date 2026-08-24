"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { rssFeeds } from "@/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { ingestFeed } from "@/server/rss/fetch";

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

const rssFeedSchema = z.object({
  name: z.string().trim().min(1).max(255),
  url: z.string().trim().url().max(2048),
  bangumiId: z.coerce.number().int().positive(),
});

export async function createRssFeedAction(
  _prev: RssFeedFormState,
  formData: FormData
): Promise<RssFeedFormState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

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
  if (existing) return { error: "duplicate" };

  await db.insert(rssFeeds).values({
    name: data.name,
    url: data.url,
    bangumiId: data.bangumiId,
  });

  revalidatePath("/", "layout");
  return { ok: true };
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
