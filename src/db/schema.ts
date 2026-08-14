import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  tokenHash: text("token_hash").notNull(),
  prefix: varchar("prefix", { length: 12 }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rssFeeds = pgTable(
  "rss_feeds",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    url: text("url").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    fetchIntervalMinutes: integer("fetch_interval_minutes")
      .notNull()
      .default(5),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rss_feeds_user_idx").on(t.userId)]
);

export const torrentItems = pgTable(
  "torrent_items",
  {
    id: serial("id").primaryKey(),
    feedId: integer("feed_id")
      .notNull()
      .references(() => rssFeeds.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    magnet: text("magnet"),
    torrentUrl: text("torrent_url"),
    /** Dedup key: real btih when available, otherwise sha1(torrentUrl) */
    infoHash: varchar("info_hash", { length: 64 }).notNull(),
    size: bigint("size", { mode: "number" }),
    publishTime: timestamp("publish_time", { withTimezone: true }),
    category: varchar("category", { length: 128 }),
    // Parsed fields (also used by the future anime tracker module)
    animeTitle: text("anime_title"),
    season: integer("season"),
    episode: integer("episode"),
    resolution: varchar("resolution", { length: 16 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("torrent_items_info_hash_unique").on(t.infoHash),
    index("torrent_items_feed_idx").on(t.feedId),
    index("torrent_items_created_idx").on(t.createdAt),
  ]
);

export const downloadRules = pgTable(
  "download_rules",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    /** Comma separated keywords, all must appear in the title */
    keyword: varchar("keyword", { length: 255 }).notNull(),
    /** Comma separated keywords, any match rejects the torrent */
    excludeKeyword: varchar("exclude_keyword", { length: 255 }),
    mustRegex: text("must_regex"),
    resolution: varchar("resolution", { length: 16 }),
    minSizeMb: integer("min_size_mb"),
    maxSizeMb: integer("max_size_mb"),
    /** Optional: restrict rule to a single feed */
    feedId: integer("feed_id").references(() => rssFeeds.id, {
      onDelete: "set null",
    }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("download_rules_user_idx").on(t.userId)]
);

export const qbittorrentAccounts = pgTable(
  "qbittorrent_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    url: text("url").notNull(),
    username: varchar("username", { length: 128 }).notNull(),
    /** AES-256-GCM encrypted with ENCRYPTION_KEY */
    passwordEncrypted: text("password_encrypted").notNull(),
    defaultCategory: varchar("default_category", { length: 128 }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("qbittorrent_accounts_user_idx").on(t.userId)]
);

export const downloadTasks = pgTable(
  "download_tasks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    torrentId: integer("torrent_id").references(() => torrentItems.id, {
      onDelete: "set null",
    }),
    ruleId: integer("rule_id").references(() => downloadRules.id, {
      onDelete: "set null",
    }),
    qbAccountId: integer("qb_account_id")
      .notNull()
      .references(() => qbittorrentAccounts.id, { onDelete: "cascade" }),
    /** Hash inside qBittorrent (falls back to the torrent info_hash) */
    qbHash: varchar("qb_hash", { length: 64 }),
    title: text("title").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("QUEUED"),
    /** 0..1 */
    progress: doublePrecision("progress").notNull().default(0),
    downloadSpeed: bigint("download_speed", { mode: "number" }),
    uploadSpeed: bigint("upload_speed", { mode: "number" }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("download_tasks_user_idx").on(t.userId),
    index("download_tasks_torrent_account_idx").on(t.torrentId, t.qbAccountId),
  ]
);

export type User = typeof users.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type RssFeed = typeof rssFeeds.$inferSelect;
export type TorrentItem = typeof torrentItems.$inferSelect;
export type DownloadRule = typeof downloadRules.$inferSelect;
export type QbittorrentAccount = typeof qbittorrentAccounts.$inferSelect;
export type DownloadTask = typeof downloadTasks.$inferSelect;
