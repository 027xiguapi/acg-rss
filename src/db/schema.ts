import {
  bigint,
  boolean,
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

export const bangumi = pgTable(
  "bangumi",
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
  (t) => [index("bangumi_user_idx").on(t.userId)]
);

/**
 * Structured bangumi names: one row per name. `primary` is the display name;
 * all names (primary + synonyms, any language) take part in torrent
 * matching. Lang is a free-form tag: "ja", "zh-Hans", "en", "romaji", …
 * Content is an optional free-form note attached to the name (e.g. a
 * synopsis or remark in that language).
 */
export const bangumiInfos = pgTable(
  "bangumi_infos",
  {
    id: serial("id").primaryKey(),
    bangumiId: integer("bangumi_id")
      .notNull()
      .references(() => bangumi.id, { onDelete: "cascade" }),
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
    uniqueIndex("bangumi_infos_bangumi_title_unique").on(t.bangumiId, t.title),
    index("bangumi_infos_bangumi_idx").on(t.bangumiId),
  ]
);

/**
 * One row per episode of a tracked bangumi. Episodes are created on demand
 * by the linker when a matching torrent has a parsed episode number;
 * torrents without one stay attached to the bangumi row only.
 */
export const bangumiEpisodes = pgTable(
  "bangumi_episodes",
  {
    id: serial("id").primaryKey(),
    bangumiId: integer("bangumi_id")
      .notNull()
      .references(() => bangumi.id, { onDelete: "cascade" }),
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
    uniqueIndex("bangumi_episodes_bangumi_number_unique").on(t.bangumiId, t.number),
    index("bangumi_episodes_bangumi_idx").on(t.bangumiId),
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
      .references(() => bangumiEpisodes.id, { onDelete: "cascade" }),
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

/**
 * Managed fansub/release groups. Each row carries a display name (matched
 * against the subgroup parsed from torrent titles) and an optional category
 * (e.g. language: "简中" / "繁中" / "双语" / "日文").
 */
export const subgroups = pgTable("subgroups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  category: varchar("category", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
    bangumiTitle: text("bangumi_title"),
    season: integer("season"),
    episode: integer("episode"),
    resolution: varchar("resolution", { length: 16 }),
    /** Fansub/release group parsed from the leading bracket tag */
    subgroup: varchar("subgroup", { length: 128 }),
    /** Optional link to a managed subgroup row (name + category) */
    subgroupId: integer("subgroup_id").references(() => subgroups.id, {
      onDelete: "set null",
    }),
    /** Set by the bangumi linker when the title matches a tracked series */
    bangumiId: integer("bangumi_id").references(() => bangumi.id, {
      onDelete: "set null",
    }),
    /** Canonical link to the episode row (only when bangumiId is set) */
    episodeId: integer("episode_id").references(() => bangumiEpisodes.id, {
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

/**
 * RSS subscription source (e.g. a Mikan bangumi feed). One bangumi may have
 * several feeds; each feed belongs to exactly one bangumi. Torrents fetched
 * from a feed are linked directly to that bangumi.
 */
export const rssFeeds = pgTable(
  "rss_feeds",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    url: text("url").notNull(),
    bangumiId: integer("bangumi_id")
      .notNull()
      .references(() => bangumi.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("rss_feeds_url_unique").on(t.url),
    index("rss_feeds_bangumi_idx").on(t.bangumiId),
  ]
);

/** Per-user bangumi favorite (bookmark); one row per user and bangumi. */
export const bangumiFavorites = pgTable(
  "bangumi_favorites",
  {
    id: serial("id").primaryKey(),
    bangumiId: integer("bangumi_id")
      .notNull()
      .references(() => bangumi.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("bangumi_favorites_bangumi_user_unique").on(t.bangumiId, t.userId),
    index("bangumi_favorites_user_idx").on(t.userId),
  ]
);

/** Per-user bangumi like (thumbs-up); one row per user and bangumi. */
export const bangumiLikes = pgTable(
  "bangumi_likes",
  {
    id: serial("id").primaryKey(),
    bangumiId: integer("bangumi_id")
      .notNull()
      .references(() => bangumi.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("bangumi_likes_bangumi_user_unique").on(t.bangumiId, t.userId),
    index("bangumi_likes_user_idx").on(t.userId),
  ]
);

/** Visitor comments on an bangumi; author info resolves through users. */
export const bangumiComments = pgTable(
  "bangumi_comments",
  {
    id: serial("id").primaryKey(),
    bangumiId: integer("bangumi_id")
      .notNull()
      .references(() => bangumi.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bangumi_comments_bangumi_idx").on(t.bangumiId)]
);

/** Per-user episode favorite; one row per user and episode. */
export const episodeFavorites = pgTable(
  "episode_favorites",
  {
    id: serial("id").primaryKey(),
    episodeId: integer("episode_id")
      .notNull()
      .references(() => bangumiEpisodes.id, { onDelete: "cascade" }),
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
      .references(() => bangumiEpisodes.id, { onDelete: "cascade" }),
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
      .references(() => bangumiEpisodes.id, { onDelete: "cascade" }),
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
export type Subgroup = typeof subgroups.$inferSelect;
export type RssFeed = typeof rssFeeds.$inferSelect;
export type Bangumi = typeof bangumi.$inferSelect;
export type BangumiInfo = typeof bangumiInfos.$inferSelect;
export type BangumiEpisode = typeof bangumiEpisodes.$inferSelect;
export type EpisodeInfo = typeof episodeInfos.$inferSelect;
export type BangumiFavorite = typeof bangumiFavorites.$inferSelect;
export type BangumiLike = typeof bangumiLikes.$inferSelect;
export type BangumiComment = typeof bangumiComments.$inferSelect;
export type EpisodeFavorite = typeof episodeFavorites.$inferSelect;
export type EpisodeLike = typeof episodeLikes.$inferSelect;
export type EpisodeComment = typeof episodeComments.$inferSelect;

/**
 * An bangumi row with its display name resolved from bangumi_infos
 * (kind=primary). Queries decorate raw rows with this before handing them
 * to UI, so components can keep using `item.title`.
 */
export type BangumiWithTitle = Bangumi & { title: string };
