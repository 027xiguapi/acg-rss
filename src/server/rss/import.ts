import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bangumi,
  bangumiInfos,
  rssFeeds,
  users,
  type User,
} from "@/db/schema";
import { parseTorrentTitle } from "@/lib/parser";
import { ingestItems, parseFeedXml } from "./fetch";

/** Summary of one batch XML import, shown to the admin after the run. */
export interface RssImportResult {
  /** Resolved series title the torrents were linked under */
  series: string;
  bangumiId: number;
  /** Whether the channel <link> looked like a subscribable feed URL */
  feedSubscribed: boolean;
  itemCount: number;
  created: number;
  skipped: number;
}

/**
 * Strip leading decorative tags (【…】, […], （…）, (…)) and the Mikan
 * channel-title prefix ("Mikan Project - ", "蜜柑计划 - ") from a channel
 * title, leaving just the series name.
 */
export function cleanSeriesTitle(raw: string | null | undefined): string | null {
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

/** Pick the user to own imported bangumi rows (admin first). */
export async function findImportOwner(): Promise<User> {
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (admin) return admin;
  const [any] = await db.select().from(users).limit(1);
  if (any) return any;
  throw new Error("No users in the database — seed users first.");
}

/** Resolve a tracked bangumi by its primary name, if it already exists. */
export async function findBangumiIdByTitle(
  title: string
): Promise<number | null> {
  const [row] = await db
    .select({ id: bangumi.id })
    .from(bangumi)
    .innerJoin(bangumiInfos, eq(bangumiInfos.bangumiId, bangumi.id))
    .where(and(eq(bangumiInfos.kind, "primary"), eq(bangumiInfos.title, title)))
    .limit(1);
  return row?.id ?? null;
}

export async function createBangumi(
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
 * Batch-import a pasted Mikan-style RSS XML document: derive the series
 * title from the channel metadata, create or reuse the tracked bangumi,
 * optionally register a subscription when the channel <link> is a feed
 * URL (Mikan bangumi feeds link to their own RSS endpoint), then ingest
 * every torrent and link it to the bangumi/episode. Safe to re-run —
 * URLs, info-hashes and (bangumi, number) pairs are deduplicated.
 */
export async function importRssFromXml(
  xml: string,
  owner?: User
): Promise<RssImportResult> {
  const parsed = await parseFeedXml(xml);
  if (parsed.items.length === 0) {
    throw new Error("noItems");
  }

  const firstParsed = parseTorrentTitle(parsed.items[0].title);
  const seriesTitle =
    cleanSeriesTitle(parsed.title) ??
    cleanSeriesTitle(firstParsed.bangumiTitle);
  if (!seriesTitle) {
    throw new Error("noSeries");
  }

  const resolvedOwner = owner ?? (await findImportOwner());
  let bangumiId = await findBangumiIdByTitle(seriesTitle);
  if (bangumiId == null) {
    bangumiId = await createBangumi(
      resolvedOwner,
      seriesTitle,
      firstParsed.season ?? 1
    );
  }

  // Subscribe when the channel links back to its own RSS endpoint
  let feedSubscribed = false;
  const feedUrl = parsed.link;
  if (feedUrl && /^https?:\/\//i.test(feedUrl)) {
    const inserted = await db
      .insert(rssFeeds)
      .values({ name: seriesTitle, url: feedUrl, bangumiId })
      .onConflictDoNothing({ target: rssFeeds.url })
      .returning({ id: rssFeeds.id });
    feedSubscribed = inserted.length > 0;
  }

  const ingested = await ingestItems(bangumiId, parsed.items);

  return {
    series: seriesTitle,
    bangumiId,
    feedSubscribed,
    itemCount: parsed.items.length,
    ...ingested,
  };
}
