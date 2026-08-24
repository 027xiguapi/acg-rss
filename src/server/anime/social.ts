import { and, desc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  animeComments,
  animeFavorites,
  animeLikes,
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

/** Favorite/like state and comments for one anime or episode page. */
export interface SocialSummary {
  favoriteCount: number;
  likeCount: number;
  /** Whether the current viewer has favorited / liked the target */
  favorited: boolean;
  liked: boolean;
  comments: CommentView[];
}

/** Which page the social widgets act on. */
export type SocialKind = "anime" | "episode";

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
  /** FK column of the target (animeId or episodeId) on all three tables */
  targetCol: AnyPgColumn;
}

/** Display name for a user row: OAuth name first, local username as fallback. */
function displayName(user: { name: string | null; username: string | null }): string {
  return user.name ?? user.username ?? "?";
}

/** Load favorite/like counts (plus the viewer's own state) and all comments. */
async function loadSocial(
  { favorites, likes, comments, targetCol }: SocialTables,
  targetId: number,
  viewerId: number | null
): Promise<SocialSummary> {
  const [favoriteRows, likeRows, commentRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(favorites)
      .where(eq(targetCol, targetId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(likes)
      .where(eq(targetCol, targetId)),
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
      .where(eq(targetCol, targetId))
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
        .where(and(eq(targetCol, targetId), eq(favorites.userId, viewerId)))
        .limit(1),
      db
        .select({ id: likes.id })
        .from(likes)
        .where(and(eq(targetCol, targetId), eq(likes.userId, viewerId)))
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

/** Social state of one anime, for `/anime/[id]`. */
export function loadAnimeSocial(animeId: number, viewerId: number | null) {
  return loadSocial(
    {
      favorites: animeFavorites,
      likes: animeLikes,
      comments: animeComments,
      targetCol: animeFavorites.animeId,
    },
    animeId,
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
      targetCol: episodeFavorites.episodeId,
    },
    episodeId,
    viewerId
  );
}
