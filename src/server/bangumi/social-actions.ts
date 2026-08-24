"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import {
  bangumiComments,
  bangumiFavorites,
  bangumiLikes,
  episodeComments,
  episodeFavorites,
  episodeLikes,
} from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import type { SocialKind } from "@/server/bangumi/social";

export interface CommentFormState {
  ok?: boolean;
  error?: string;
}

const commentSchema = z.string().trim().min(1).max(2000);

interface ReactConfig {
  table: PgTable & { userId: AnyPgColumn };
  targetCol: AnyPgColumn;
  /** Insert row keyed by the target column (bangumiId vs episodeId) */
  makeRow: (targetId: number, userId: number) => Record<string, number>;
}

interface CommentConfig {
  table: PgTable & { id: AnyPgColumn; userId: AnyPgColumn };
  targetCol: AnyPgColumn;
  makeRow: (targetId: number, userId: number, content: string) => Record<string, number | string>;
}

const FAVORITES: Record<SocialKind, ReactConfig> = {
  bangumi: {
    table: bangumiFavorites,
    targetCol: bangumiFavorites.bangumiId,
    makeRow: (targetId, userId) => ({ bangumiId: targetId, userId }),
  },
  episode: {
    table: episodeFavorites,
    targetCol: episodeFavorites.episodeId,
    makeRow: (targetId, userId) => ({ episodeId: targetId, userId }),
  },
};

const LIKES: Record<SocialKind, ReactConfig> = {
  bangumi: {
    table: bangumiLikes,
    targetCol: bangumiLikes.bangumiId,
    makeRow: (targetId, userId) => ({ bangumiId: targetId, userId }),
  },
  episode: {
    table: episodeLikes,
    targetCol: episodeLikes.episodeId,
    makeRow: (targetId, userId) => ({ episodeId: targetId, userId }),
  },
};

const COMMENTS: Record<SocialKind, CommentConfig> = {
  bangumi: {
    table: bangumiComments,
    targetCol: bangumiComments.bangumiId,
    makeRow: (targetId, userId, content) => ({ bangumiId: targetId, userId, content }),
  },
  episode: {
    table: episodeComments,
    targetCol: episodeComments.episodeId,
    makeRow: (targetId, userId, content) => ({ episodeId: targetId, userId, content }),
  },
};

function validId(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/** Insert when absent, delete when present; returns the new state. */
async function toggle(
  { table, targetCol, makeRow }: ReactConfig,
  targetId: number,
  userId: number
): Promise<boolean> {
  const removed = await db
    .delete(table)
    .where(and(eq(targetCol, targetId), eq(table.userId, userId)))
    .returning();
  if (removed.length > 0) return false;
  await db
    .insert(table)
    .values(makeRow(targetId, userId))
    .onConflictDoNothing();
  return true;
}

/** Add or remove the current user's favorite on one bangumi or episode. */
export async function toggleFavoriteAction(
  kind: SocialKind,
  targetId: number
): Promise<void> {
  const user = await getSessionUser();
  if (!user || !validId(targetId)) return;
  await toggle(FAVORITES[kind], targetId, user.id);
  revalidatePath("/", "layout");
}

/** Add or remove the current user's like on one bangumi or episode. */
export async function toggleLikeAction(
  kind: SocialKind,
  targetId: number
): Promise<void> {
  const user = await getSessionUser();
  if (!user || !validId(targetId)) return;
  await toggle(LIKES[kind], targetId, user.id);
  revalidatePath("/", "layout");
}

/** Post a comment as the current user (form carries kind + targetId). */
export async function addCommentAction(
  _prev: CommentFormState,
  formData: FormData
): Promise<CommentFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "notAuthenticated" };

  const kind = String(formData.get("kind")) as SocialKind;
  const config = COMMENTS[kind];
  if (!config) return { error: "invalid" };

  const targetId = Number(formData.get("targetId"));
  if (!validId(targetId)) return { error: "invalid" };

  const content = commentSchema.safeParse(formData.get("content"));
  if (!content.success) return { error: "invalid" };

  await db
    .insert(config.table)
    .values(config.makeRow(targetId, user.id, content.data));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Delete a comment; only its author may do so (form carries kind + id). */
export async function deleteCommentAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const kind = String(formData.get("kind")) as SocialKind;
  const config = COMMENTS[kind];
  if (!config) return;

  const id = Number(formData.get("id"));
  if (!validId(id)) return;

  await db
    .delete(config.table)
    .where(and(eq(config.table.id, id), eq(config.table.userId, user.id)));
  revalidatePath("/", "layout");
}
