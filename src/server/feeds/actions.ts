"use server";

import { revalidatePath } from "next/cache";
import { and, eq, not } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { rssFeeds } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { refreshFeed } from "@/server/rss/ingest";

export interface FeedFormState {
  ok?: boolean;
  error?: string;
}

const feedSchema = z.object({
  name: z.string().trim().min(1).max(255),
  url: z.url().max(2048),
  fetchIntervalMinutes: z.coerce.number().int().min(1).max(1440),
  enabled: z.boolean(),
});

function parseFeedForm(formData: FormData) {
  return feedSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
    fetchIntervalMinutes: formData.get("fetchIntervalMinutes") ?? "5",
    enabled: formData.get("enabled") != null,
  });
}

/** Create or update (when an id is present) one of the user's feeds. */
export async function saveFeedAction(
  _prev: FeedFormState,
  formData: FormData
): Promise<FeedFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "notAuthenticated" };

  const parsed = parseFeedForm(formData);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "url") return { error: "invalidUrl" };
    if (field === "name") return { error: "name" };
    return { error: "invalid" };
  }

  const { name, url, fetchIntervalMinutes, enabled } = parsed.data;
  const id = Number(formData.get("id"));

  if (Number.isInteger(id) && id > 0) {
    await db
      .update(rssFeeds)
      .set({ name, url, fetchIntervalMinutes, enabled })
      .where(and(eq(rssFeeds.id, id), eq(rssFeeds.userId, user.id)));
  } else {
    await db
      .insert(rssFeeds)
      .values({ userId: user.id, name, url, fetchIntervalMinutes, enabled });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteFeedAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db
    .delete(rssFeeds)
    .where(and(eq(rssFeeds.id, id), eq(rssFeeds.userId, user.id)));
  revalidatePath("/", "layout");
}

export async function toggleFeedAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db
    .update(rssFeeds)
    .set({ enabled: not(rssFeeds.enabled) })
    .where(and(eq(rssFeeds.id, id), eq(rssFeeds.userId, user.id)));
  revalidatePath("/", "layout");
}

export interface RefreshFeedResult {
  ok: boolean;
  inserted?: number;
  error?: string;
}

/** Manual "Fetch now" — same code path the scheduler uses. */
export async function refreshFeedAction(
  formData: FormData
): Promise<RefreshFeedResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "notFound" };

  const rows = await db
    .select()
    .from(rssFeeds)
    .where(and(eq(rssFeeds.id, id), eq(rssFeeds.userId, user.id)))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: "notFound" };

  const result = await refreshFeed(rows[0]);
  revalidatePath("/", "layout");
  return result.error
    ? { ok: false, error: result.error }
    : { ok: true, inserted: result.inserted };
}
