import "dotenv/config";
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  bangumi,
  bangumiInfos,
  rssFeeds,
  users,
  type User,
} from "./schema";
import { parseFeedXml, ingestItems } from "../server/rss/fetch";
import { parseTorrentTitle } from "../lib/parser";

/**
 * Batch-import a saved Mikan RSS XML file: create (or reuse) the tracked
 * bangumi + subscription, then ingest every item. Torrents carry their
 * episode_infos multilingual titles automatically.
 *
 *   tsx src/db/import-feed-file.ts <xml-file> [rss-url]
 */
async function main(): Promise<void> {
  const [xmlPath, urlArg] = process.argv.slice(2);
  if (!xmlPath) {
    console.error("Usage: tsx src/db/import-feed-file.ts <xml-file> [rss-url]");
    process.exit(1);
  }

  const xml = readFileSync(xmlPath, "utf8");
  const feed = await parseFeedXml(xml);

  // A document with only a <channel> (no <item>) has nothing to archive;
  // refuse it rather than creating an empty bangumi + subscription.
  if (feed.items.length === 0) {
    console.error("The XML contains no items — nothing to import.");
    process.exit(1);
  }

  const url =
    urlArg ??
    feed.link ??
    `local:${xmlPath}`;

  const rawTitle = feed.title ?? "";
  const seriesTitle =
    cleanSeriesTitle(rawTitle) ??
    parseTorrentTitle(feed.items[0]?.title ?? "").bangumiTitle;
  if (!seriesTitle) {
    throw new Error(
      `Could not determine the series title from the feed (channel title: ${JSON.stringify(rawTitle)}).`
    );
  }
  const first = feed.items[0]?.title
    ? parseTorrentTitle(feed.items[0].title)
    : {};

  const owner = await findAdminUser();
  console.log(`Series: "${seriesTitle}" (${feed.items.length} item(s))`);

  // Reuse the existing subscription (and its bangumi) on a re-run.
  const [existingFeed] = await db
    .select()
    .from(rssFeeds)
    .where(eq(rssFeeds.url, url))
    .limit(1);

  let bangumiId: number;
  let feedId: number;
  if (existingFeed) {
    feedId = existingFeed.id;
    bangumiId = existingFeed.bangumiId;
    console.log(
      `Feed already subscribed (id=${feedId}, bangumi=${bangumiId}) — re-importing.`
    );
  } else {
    bangumiId = await findOrCreateBangumi(owner, seriesTitle, first.season ?? 1);
    const created = (
      await db
        .insert(rssFeeds)
        .values({ name: seriesTitle, url, bangumiId })
        .returning()
    )[0];
    feedId = created.id;
    console.log(`Created bangumi #${bangumiId} and feed #${feedId}.`);
  }

  const result = await ingestItems(bangumiId, feed.items);
  console.log(
    `Import complete: ${result.created} torrent(s) created, ${result.skipped} skipped.`
  );
  process.exit(0);
}

/** Strip Mikan channel-title decorations, leaving the series name. */
function cleanSeriesTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  for (;;) {
    const next = text
      .replace(/^【[^】]*】\s*/, "")
      .replace(/^\[[^\]]*\]\s*/, "")
      .replace(/^（[^）]*）\s*/, "")
      .replace(/^\([^)]*\)\s*/, "")
      .replace(/^(?:Mikan Project|Mikan|蜜柑计划|蜜柑)\s*[-–—:：|]\s*/i, "");
    if (next === text) break;
    text = next.trim();
  }
  return text.trim() || null;
}

async function findAdminUser(): Promise<User> {
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (admin) return admin;
  const [any] = await db.select().from(users).limit(1);
  if (any) return any;
  throw new Error("No users in the database — run `pnpm db:seed` first.");
}

async function findOrCreateBangumi(
  owner: User,
  title: string,
  season: number
): Promise<number> {
  const [existing] = await db
    .select({ id: bangumi.id })
    .from(bangumi)
    .innerJoin(bangumiInfos, eq(bangumiInfos.bangumiId, bangumi.id))
    .where(and(eq(bangumiInfos.kind, "primary"), eq(bangumiInfos.title, title)))
    .limit(1);
  if (existing) return existing.id;

  const [row] = await db
    .insert(bangumi)
    .values({
      userId: owner.id,
      season,
      origin: "JP",
      watchStatus: "WATCHING",
      updatedBy: owner.id,
    })
    .returning();
  await db.insert(bangumiInfos).values({
    bangumiId: row.id,
    kind: "primary",
    lang: null,
    title,
  });
  return row.id;
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
