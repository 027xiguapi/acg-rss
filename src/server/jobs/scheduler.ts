import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rssFeeds } from "@/db/schema";
import { refreshFeed } from "../rss/ingest";
import { matchRecentTorrents } from "../matcher";
import { syncDownloadTasks } from "./sync";

/**
 * In-process background scheduler (no Redis / worker required).
 * Started once per Node process from instrumentation.ts; disabled by
 * setting JOBS_ENABLED=false.
 */

const RSS_SWEEP_MS = 60_000; // how often we look for due feeds
const MATCHER_MS = 5 * 60_000; // periodic matcher catch-up
const QB_SYNC_MS = 60_000; // qBittorrent status poll
const DEFAULT_INTERVAL_MINUTES = Number(
  process.env.RSS_DEFAULT_INTERVAL_MINUTES ?? 5
);

let started = false;

/** Run an async job, skipping the tick when the previous one is still busy. */
function periodic(name: string, fn: () => Promise<void>): () => void {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[jobs] ${name} failed:`, err);
    } finally {
      running = false;
    }
  };
}

const sweepDueFeeds = periodic("rss-sweep", async () => {
  const feeds = await db
    .select()
    .from(rssFeeds)
    .where(eq(rssFeeds.enabled, true));

  const now = Date.now();
  const due = feeds.filter((feed) => {
    if (!feed.lastFetchedAt) return true;
    const intervalMin = feed.fetchIntervalMinutes || DEFAULT_INTERVAL_MINUTES;
    return now - feed.lastFetchedAt.getTime() >= intervalMin * 60_000;
  });

  for (const feed of due) {
    await refreshFeed(feed); // never throws
  }
});

const runMatcherCatchUp = periodic("matcher", () =>
  matchRecentTorrents(10)
);

const runQbSync = periodic("qb-sync", () => syncDownloadTasks());

export function ensureSchedulerStarted(): void {
  if (started) return;
  started = true;

  if (process.env.JOBS_ENABLED === "false") {
    console.log("[jobs] background scheduler disabled (JOBS_ENABLED=false)");
    return;
  }

  console.log("[jobs] background scheduler started");
  for (const [fn, ms] of [
    [sweepDueFeeds, RSS_SWEEP_MS],
    [runMatcherCatchUp, MATCHER_MS],
    [runQbSync, QB_SYNC_MS],
  ] as const) {
    const timer = setInterval(() => void fn(), ms);
    // Never keep the process alive just for the scheduler (builds, scripts…)
    timer.unref?.();
  }
}
