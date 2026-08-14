import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  downloadRules,
  downloadTasks,
  qbittorrentAccounts,
  rssFeeds,
  torrentItems,
  type DownloadRule,
  type DownloadTask,
  type QbittorrentAccount,
  type TorrentItem,
} from "@/db/schema";
import { decryptSecret } from "./crypto";
import { QBittorrentClient, QBittorrentError } from "./qbittorrent/client";

/**
 * Phase 1/2 matching: keywords (comma separated, all must match),
 * exclude keywords (any rejects), optional regex, resolution and size range.
 */
export function evaluateRule(rule: DownloadRule, torrent: TorrentItem): boolean {
  const title = torrent.title.toLowerCase();

  const keywords = splitList(rule.keyword);
  if (keywords.length === 0) return false;
  for (const kw of keywords) {
    if (!title.includes(kw.toLowerCase())) return false;
  }

  if (rule.excludeKeyword) {
    for (const kw of splitList(rule.excludeKeyword)) {
      if (title.includes(kw.toLowerCase())) return false;
    }
  }

  if (rule.mustRegex) {
    try {
      if (!new RegExp(rule.mustRegex, "i").test(torrent.title)) return false;
    } catch {
      return false; // Invalid regex never matches
    }
  }

  if (rule.resolution) {
    const want = rule.resolution.toLowerCase();
    const has =
      torrent.resolution?.toLowerCase() === want ||
      torrent.title.toLowerCase().includes(want);
    if (!has) return false;
  }

  if (rule.minSizeMb != null && torrent.size != null) {
    if (torrent.size < rule.minSizeMb * 1024 * 1024) return false;
  }
  if (rule.maxSizeMb != null && torrent.size != null) {
    if (torrent.size > rule.maxSizeMb * 1024 * 1024) return false;
  }

  return true;
}

function splitList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Push one torrent to all enabled qBittorrent accounts of the user and
 * record download tasks. Skips accounts that already have a task for this
 * torrent (idempotent). Returns the created tasks.
 */
export async function pushTorrentToUser(
  userId: number,
  torrent: TorrentItem,
  ruleId: number | null
): Promise<DownloadTask[]> {
  const accounts = await db
    .select()
    .from(qbittorrentAccounts)
    .where(
      and(eq(qbittorrentAccounts.userId, userId), eq(qbittorrentAccounts.enabled, true))
    );
  if (accounts.length === 0) return [];

  const urls: string[] = [];
  if (torrent.magnet) urls.push(torrent.magnet);
  else if (torrent.torrentUrl) urls.push(torrent.torrentUrl);
  if (urls.length === 0) return [];

  const existing = await db
    .select({ qbAccountId: downloadTasks.qbAccountId })
    .from(downloadTasks)
    .where(
      and(
        eq(downloadTasks.userId, userId),
        eq(downloadTasks.torrentId, torrent.id)
      )
    );
  const covered = new Set(existing.map((t) => t.qbAccountId));

  const created: DownloadTask[] = [];

  for (const account of accounts) {
    if (covered.has(account.id)) continue;

    const inserted = await db
      .insert(downloadTasks)
      .values({
        userId,
        torrentId: torrent.id,
        ruleId,
        qbAccountId: account.id,
        qbHash: torrent.infoHash,
        title: torrent.title,
        status: "QUEUED",
      })
      .returning();
    const task = inserted[0];

    try {
      await addToClient(account, urls, account.defaultCategory ?? undefined);
      created.push(task);
    } catch (err) {
      await db
        .update(downloadTasks)
        .set({
          status: "ERROR",
          error:
            err instanceof QBittorrentError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err),
          updatedAt: new Date(),
        })
        .where(eq(downloadTasks.id, task.id));
    }
  }

  return created;
}

export async function addToClient(
  account: QbittorrentAccount,
  urls: string[],
  category?: string
): Promise<void> {
  const password = decryptSecret(account.passwordEncrypted);
  const client = new QBittorrentClient(account.url, account.username, password);
  await client.login();
  await client.addTorrents({ urls, category });
}

/**
 * Run all enabled rules of the torrent owner against one torrent
 * (called right after RSS ingest).
 */
export async function matchTorrentAgainstRules(
  torrent: TorrentItem
): Promise<void> {
  const feedRows = await db
    .select({ userId: rssFeeds.userId })
    .from(rssFeeds)
    .where(eq(rssFeeds.id, torrent.feedId))
    .limit(1);
  const userId = feedRows[0]?.userId;
  if (!userId) return;

  const rules = await db
    .select()
    .from(downloadRules)
    .where(
      and(
        eq(downloadRules.userId, userId),
        eq(downloadRules.enabled, true),
        or(isNull(downloadRules.feedId), eq(downloadRules.feedId, torrent.feedId))
      )
    );

  for (const rule of rules) {
    if (!evaluateRule(rule, torrent)) continue;
    await pushTorrentToUser(userId, torrent, rule.id);
    break; // One task per torrent is enough; first matching rule wins
  }
}

/**
 * Periodic catch-up: re-run the matcher for torrents ingested in the last
 * `windowMinutes`. Idempotent via existing-task checks.
 */
export async function matchRecentTorrents(windowMinutes = 60): Promise<void> {
  const since = new Date(Date.now() - windowMinutes * 60_000);

  const recent = await db.query.torrentItems.findMany({
    where: (t, { gte }) => gte(t.createdAt, since),
    columns: { id: true },
    orderBy: (t, { desc }) => [desc(t.id)],
    limit: 500,
  });

  for (const { id } of recent) {
    const rows = await db
      .select()
      .from(torrentItems)
      .where(eq(torrentItems.id, id))
      .limit(1);
    const torrent = rows[0];
    if (!torrent) continue;
    try {
      await matchTorrentAgainstRules(torrent);
    } catch (err) {
      console.error(`[matcher] failed for torrent #${id}:`, err);
    }
  }
}
