import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bangumi,
  bangumiInfos,
  rssFeeds,
  users,
  type RssFeed,
  type User,
} from "@/db/schema";
import { fetchFeedMeta, ingestFeed } from "@/server/rss/fetch";
import { parseTorrentTitle } from "@/lib/parser";

/** Default Mikan feed when none is passed on the command line. */
const DEFAULT_URL = "https://mikanani.me/RSS/Bangumi?bangumiId=3941";

/**
 * Strip leading decorative tags (【…】, […], （…）, (…)) and the Mikan
 * channel-title prefix ("Mikan Project - ", "蜜柑计划 - ") from a channel
 * title, leaving just the series name.
 */
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

/** Pick the admin user to own the imported bangumi (falls back gracefully). */
async function findAdminUser(): Promise<User> {
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (admin) return admin;
  const [demo] = await db
    .select()
    .from(users)
    .where(eq(users.username, "demo"))
    .limit(1);
  if (demo) return demo;
  const [any] = await db.select().from(users).limit(1);
  if (any) return any;
  throw new Error("No users in the database — run `pnpm db:seed` first.");
}

/** Resolve a tracked bangumi by its primary name, if it already exists. */
async function findBangumiIdByTitle(title: string): Promise<number | null> {
  const [row] = await db
    .select({ id: bangumi.id })
    .from(bangumi)
    .innerJoin(bangumiInfos, eq(bangumiInfos.bangumiId, bangumi.id))
    .where(and(eq(bangumiInfos.kind, "primary"), eq(bangumiInfos.title, title)))
    .limit(1);
  return row?.id ?? null;
}

/** Create a bangumi with its primary name. */
async function createBangumi(
  owner: User,
  title: string,
  season: number
): Promise<number> {
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

/**
 * Batch-import a Mikan bangumi RSS feed: create (or reuse) the tracked
 * bangumi, register the subscription, then ingest every torrent and link
 * it to the bangumi/episode. Safe to re-run — URLs, info-hashes and
 * (bangumi, number) pairs are all deduplicated by unique indexes.
 *
 * Usage: tsx src/db/import-feed.ts [url] [feedName]
 */
async function main(): Promise<void> {
  const url = process.argv[2] ?? DEFAULT_URL;
  const nameOverride = process.argv[3]?.trim() || undefined;

  console.log(`Fetching feed metadata: ${url}`);
  const meta = await fetchFeedMeta(url);

  const rawTitle = meta.title ?? null;
  const firstItemTitle = meta.firstItemTitle ?? null;
  const seriesTitle =
    cleanSeriesTitle(rawTitle) ??
    cleanSeriesTitle(parseTorrentTitle(firstItemTitle ?? "").bangumiTitle);

  if (!seriesTitle) {
    throw new Error(
      `Could not determine the series title from the feed ` +
        `(channel title: ${JSON.stringify(rawTitle)}). ` +
        `Pass one explicitly: tsx src/db/import-feed.ts "${url}" "<title>".`
    );
  }

  const owner = await findAdminUser();
  const season = parseTorrentTitle(firstItemTitle ?? "").season ?? 1;

  console.log(
    `Series: "${seriesTitle}" (season ${season}, ${meta.itemCount} item(s))`
  );

  // Reuse the existing subscription (and its bangumi) on a re-run.
  const [existingFeed] = await db
    .select()
    .from(rssFeeds)
    .where(eq(rssFeeds.url, url))
    .limit(1);

  let feed: RssFeed;
  if (existingFeed) {
    feed = existingFeed;
    console.log(
      `Feed already subscribed (id=${feed.id}, bangumi=${feed.bangumiId}) — re-fetching.`
    );
  } else {
    let bangumiId = await findBangumiIdByTitle(seriesTitle);
    if (bangumiId == null) {
      bangumiId = await createBangumi(owner, seriesTitle, season);
      console.log(`Created bangumi #${bangumiId} "${seriesTitle}"`);
    } else {
      console.log(`Reusing existing bangumi #${bangumiId} "${seriesTitle}"`);
    }

    feed = (
      await db
        .insert(rssFeeds)
        .values({ name: nameOverride ?? seriesTitle, url, bangumiId })
        .returning()
    )[0];
    console.log(`Created feed #${feed.id} "${feed.name}" → bangumi #${bangumiId}`);
  }

  const result = await ingestFeed(feed);
  console.log(
    `Import complete: ${result.created} torrent(s) created, ${result.skipped} skipped` +
      (result.error ? ` (error: ${result.error})` : "")
  );

  process.exit(result.error ? 1 : 0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
