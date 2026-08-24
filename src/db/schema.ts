import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** Local login name; null for accounts created via OAuth */
  username: varchar("username", { length: 64 }).unique(),
  email: varchar("email", { length: 255 }).unique(),
  /** bcrypt hash of the local password; null for OAuth-only accounts */
  passwordHash: text("password_hash"),
  /** Display name (Auth.js convention; set from the OAuth profile) */
  name: text("name"),
  /** Set for accounts whose email was verified by an OAuth provider */
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  /** Avatar URL from the OAuth provider */
  image: text("image"),
  /** "admin" manages everything; other roles are reserved for future use */
  role: varchar("role", { length: 16 }).notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Auth.js OAuth account links: one row per external identity. Property
 * names must match @auth/drizzle-adapter expectations exactly (the
 * adapter inserts its row objects as-is).
 */
export const accounts = pgTable(
  "accounts",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 })
      .$type<AdapterAccountType>()
      .notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: varchar("refresh_token", { length: 1024 }),
    access_token: varchar("access_token", { length: 1024 }),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 64 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

/** Auth.js database sessions (JWT strategy is active; table kept ready) */
export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

/** Auth.js email verification tokens */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

export const anime = pgTable(
  "anime",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    season: integer("season").notNull().default(1),
    year: integer("year"),
    /** Production region: JP | CN | HK | TW | KR | WEST | OTHER */
    origin: varchar("origin", { length: 16 }),
    /** Weekly air day, ISO weekday: 1=Mon … 7=Sun */
    airDay: integer("air_day"),
    /** Work type: TV | MOVIE | OVA | ONA | SPECIAL | OTHER */
    type: varchar("type", { length: 16 }),
    /** Cover image URL (poster); absolute http(s) link */
    coverUrl: text("cover_url"),
    /** PLANNED | WATCHING | PAUSED | COMPLETED | DROPPED */
    watchStatus: varchar("watch_status", { length: 16 })
      .notNull()
      .default("WATCHING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Last modifier; set explicitly by the save action on every write */
    updatedBy: integer("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("anime_user_idx").on(t.userId)]
);

/**
 * Structured anime names: one row per name. `primary` is the display name;
 * all names (primary + synonyms, any language) take part in torrent
 * matching. Lang is a free-form tag: "ja", "zh-Hans", "en", "romaji", …
 * Content is an optional free-form note attached to the name (e.g. a
 * synopsis or remark in that language).
 */
export const animeInfos = pgTable(
  "anime_infos",
  {
    id: serial("id").primaryKey(),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    /** "primary" | "synonym" */
    kind: varchar("kind", { length: 16 }).notNull().default("synonym"),
    lang: varchar("lang", { length: 16 }),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("anime_infos_anime_title_unique").on(t.animeId, t.title),
    index("anime_infos_anime_idx").on(t.animeId),
  ]
);

/**
 * One row per episode of a tracked anime. Episodes are created on demand
 * by the linker when a matching torrent has a parsed episode number;
 * torrents without one stay attached to the anime row only.
 */
export const animeEpisodes = pgTable(
  "anime_episodes",
  {
    id: serial("id").primaryKey(),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    /** Episode number parsed from the release titles */
    number: integer("number").notNull(),
    /** Episode still / thumbnail URL */
    coverUrl: text("cover_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("anime_episodes_anime_number_unique").on(t.animeId, t.number),
    index("anime_episodes_anime_idx").on(t.animeId),
  ]
);

/**
 * Multilingual episode info: one row per language holding the localized
 * title and synopsis. The public episode page shows the row matching the
 * visitor's locale and falls back to any row.
 */
export const episodeInfos = pgTable(
  "episode_infos",
  {
    id: serial("id").primaryKey(),
    episodeId: integer("episode_id")
      .notNull()
      .references(() => animeEpisodes.id, { onDelete: "cascade" }),
    /** Locale tag matching the UI locales: "en", "zh-CN", "ja", "ko" */
    lang: varchar("lang", { length: 16 }).notNull(),
    /** Localized episode title; null keeps the generic "Episode N" heading */
    title: text("title"),
    /** Localized synopsis; may be null when only a title is maintained */
    content: text("content"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("episode_infos_episode_lang_unique").on(t.episodeId, t.lang),
    index("episode_infos_episode_idx").on(t.episodeId),
  ]
);

export const torrentItems = pgTable(
  "torrent_items",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    magnet: text("magnet"),
    torrentUrl: text("torrent_url"),
    /** Dedup key: real btih when available, otherwise sha1(torrentUrl) */
    infoHash: varchar("info_hash", { length: 64 }).notNull(),
    size: bigint("size", { mode: "number" }),
    publishTime: timestamp("publish_time", { withTimezone: true }),
    category: varchar("category", { length: 128 }),
    // Parsed fields (intrinsic properties of the torrent title)
    animeTitle: text("anime_title"),
    season: integer("season"),
    episode: integer("episode"),
    resolution: varchar("resolution", { length: 16 }),
    /** Fansub/release group parsed from the leading bracket tag */
    subgroup: varchar("subgroup", { length: 128 }),
    /** Set by the anime linker when the title matches a tracked series */
    animeId: integer("anime_id").references(() => anime.id, {
      onDelete: "set null",
    }),
    /** Canonical link to the episode row (only when animeId is set) */
    episodeId: integer("episode_id").references(() => animeEpisodes.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("torrent_items_info_hash_unique").on(t.infoHash),
    index("torrent_items_created_idx").on(t.createdAt),
    index("torrent_items_episode_idx").on(t.episodeId),
  ]
);

/** Per-user anime favorite (bookmark); one row per user and anime. */
export const animeFavorites = pgTable(
  "anime_favorites",
  {
    id: serial("id").primaryKey(),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("anime_favorites_anime_user_unique").on(t.animeId, t.userId),
    index("anime_favorites_user_idx").on(t.userId),
  ]
);

/** Per-user anime like (thumbs-up); one row per user and anime. */
export const animeLikes = pgTable(
  "anime_likes",
  {
    id: serial("id").primaryKey(),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("anime_likes_anime_user_unique").on(t.animeId, t.userId),
    index("anime_likes_user_idx").on(t.userId),
  ]
);

/** Visitor comments on an anime; author info resolves through users. */
export const animeComments = pgTable(
  "anime_comments",
  {
    id: serial("id").primaryKey(),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("anime_comments_anime_idx").on(t.animeId)]
);

/** Per-user episode favorite; one row per user and episode. */
export const episodeFavorites = pgTable(
  "episode_favorites",
  {
    id: serial("id").primaryKey(),
    episodeId: integer("episode_id")
      .notNull()
      .references(() => animeEpisodes.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("episode_favorites_episode_user_unique").on(t.episodeId, t.userId),
    index("episode_favorites_user_idx").on(t.userId),
  ]
);

/** Per-user episode like; one row per user and episode. */
export const episodeLikes = pgTable(
  "episode_likes",
  {
    id: serial("id").primaryKey(),
    episodeId: integer("episode_id")
      .notNull()
      .references(() => animeEpisodes.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("episode_likes_episode_user_unique").on(t.episodeId, t.userId),
    index("episode_likes_user_idx").on(t.userId),
  ]
);

/** Visitor comments on an episode; author info resolves through users. */
export const episodeComments = pgTable(
  "episode_comments",
  {
    id: serial("id").primaryKey(),
    episodeId: integer("episode_id")
      .notNull()
      .references(() => animeEpisodes.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("episode_comments_episode_idx").on(t.episodeId)]
);

export type User = typeof users.$inferSelect;
export type TorrentItem = typeof torrentItems.$inferSelect;
export type Anime = typeof anime.$inferSelect;
export type AnimeInfo = typeof animeInfos.$inferSelect;
export type AnimeEpisode = typeof animeEpisodes.$inferSelect;
export type EpisodeInfo = typeof episodeInfos.$inferSelect;
export type AnimeFavorite = typeof animeFavorites.$inferSelect;
export type AnimeLike = typeof animeLikes.$inferSelect;
export type AnimeComment = typeof animeComments.$inferSelect;
export type EpisodeFavorite = typeof episodeFavorites.$inferSelect;
export type EpisodeLike = typeof episodeLikes.$inferSelect;
export type EpisodeComment = typeof episodeComments.$inferSelect;

/**
 * An anime row with its display name resolved from anime_infos
 * (kind=primary). Queries decorate raw rows with this before handing them
 * to UI, so components can keep using `item.title`.
 */
export type AnimeWithTitle = Anime & { title: string };
