import { and, desc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  bangumiComments,
  bangumiFavorites,
  bangumiLikes,
  episodeComments,
  episodeFavorites,
  episodeLikes,
  users,
} from "@/db/schema";

/** A comment as shown on the detail pages; dates are ISO strings for the client. */
export interface CommentView {
  id: number;
  /** Display name: OAuth name, falling back to the local login name */
  author: string;
  /** Author avatar URL, when the account has one */
  avatarUrl: string | null;
  content: string;
  createdAt: string;
  /** True when the comment belongs to the current viewer */
  mine: boolean;
}

/** Favorite/like state and comments for one bangumi or episode page. */
export interface SocialSummary {
  favoriteCount: number;
  likeCount: number;
  /** Whether the current viewer has favorited / liked the target */
  favorited: boolean;
  liked: boolean;
  comments: CommentView[];
}

/** Which page the social widgets act on. */
export type SocialKind = "bangumi" | "episode";

/** Columns every favorite/like table shares. */
interface ReactTable extends PgTable {
  id: AnyPgColumn;
  userId: AnyPgColumn;
}

/** Columns every comment table shares. */
interface CommentTable extends PgTable {
  id: AnyPgColumn;
  userId: AnyPgColumn;
  content: AnyPgColumn;
  createdAt: AnyPgColumn;
}

interface SocialTables {
  favorites: ReactTable;
  likes: ReactTable;
  comments: CommentTable;
  /** FK column of the target (bangumiId or episodeId) on each table */
  favoriteTarget: AnyPgColumn;
  likeTarget: AnyPgColumn;
  commentTarget: AnyPgColumn;
}

/** Display name for a user row: OAuth name first, local username as fallback. */
function displayName(user: { name: string | null; username: string | null }): string {
  return user.name ?? user.username ?? "?";
}

/** Load favorite/like counts (plus the viewer's own state) and all comments. */
async function loadSocial(
  { favorites, likes, comments, favoriteTarget, likeTarget, commentTarget }: SocialTables,
  targetId: number,
  viewerId: number | null
): Promise<SocialSummary> {
  const [favoriteRows, likeRows, commentRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(favorites)
      .where(eq(favoriteTarget, targetId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(likes)
      .where(eq(likeTarget, targetId)),
    db
      .select({
        id: comments.id,
        userId: comments.userId,
        name: users.name,
        username: users.username,
        image: users.image,
        content: comments.content,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .where(eq(commentTarget, targetId))
      .orderBy(desc(comments.createdAt))
      .limit(200),
  ]);

  let favorited = false;
  let liked = false;
  if (viewerId != null) {
    const [favRow, likeRow] = await Promise.all([
      db
        .select({ id: favorites.id })
        .from(favorites)
        .where(and(eq(favoriteTarget, targetId), eq(favorites.userId, viewerId)))
        .limit(1),
      db
        .select({ id: likes.id })
        .from(likes)
        .where(and(eq(likeTarget, targetId), eq(likes.userId, viewerId)))
        .limit(1),
    ]);
    favorited = favRow.length > 0;
    liked = likeRow.length > 0;
  }

  return {
    favoriteCount: favoriteRows[0]?.count ?? 0,
    likeCount: likeRows[0]?.count ?? 0,
    favorited,
    liked,
    comments: commentRows.map((row) => ({
      id: Number(row.id),
      author: displayName(row),
      avatarUrl: row.image,
      content: String(row.content),
      createdAt: new Date(row.createdAt as string | number | Date).toISOString(),
      mine: viewerId != null && Number(row.userId) === viewerId,
    })),
  };
}

/** Social state of one bangumi, for `/bangumi/[id]`. */
export function loadBangumiSocial(bangumiId: number, viewerId: number | null) {
  return loadSocial(
    {
      favorites: bangumiFavorites,
      likes: bangumiLikes,
      comments: bangumiComments,
      favoriteTarget: bangumiFavorites.bangumiId,
      likeTarget: bangumiLikes.bangumiId,
      commentTarget: bangumiComments.bangumiId,
    },
    bangumiId,
    viewerId
  );
}

/** Social state of one episode, for `/episode/[id]`. */
export function loadEpisodeSocial(episodeId: number, viewerId: number | null) {
  return loadSocial(
    {
      favorites: episodeFavorites,
      likes: episodeLikes,
      comments: episodeComments,
      favoriteTarget: episodeFavorites.episodeId,
      likeTarget: episodeLikes.episodeId,
      commentTarget: episodeComments.episodeId,
    },
    episodeId,
    viewerId
  );
}
