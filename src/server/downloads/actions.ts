"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  downloadTasks,
  qbittorrentAccounts,
  rssFeeds,
  torrentItems,
} from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { addToClient, pushTorrentToUser } from "@/server/matcher";

export interface DownloadActionResult {
  ok: boolean;
  error?: string;
  /** i18n key suffix used by the UI when ok (e.g. "alreadyQueued") */
  reason?: string;
}

/** Manual "Download now" from the torrents page. */
export async function downloadNowAction(
  formData: FormData
): Promise<DownloadActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  const torrentId = Number(formData.get("torrentId"));
  if (!Number.isInteger(torrentId) || torrentId <= 0) {
    return { ok: false, error: "notFound" };
  }

  // Ownership travels through the feed
  const rows = await db
    .select({ torrent: torrentItems })
    .from(torrentItems)
    .innerJoin(rssFeeds, eq(torrentItems.feedId, rssFeeds.id))
    .where(and(eq(torrentItems.id, torrentId), eq(rssFeeds.userId, user.id)))
    .limit(1);
  const torrent = rows[0]?.torrent;
  if (!torrent) return { ok: false, error: "notFound" };

  const accounts = await db
    .select({ id: qbittorrentAccounts.id })
    .from(qbittorrentAccounts)
    .where(
      and(
        eq(qbittorrentAccounts.userId, user.id),
        eq(qbittorrentAccounts.enabled, true)
      )
    );
  if (accounts.length === 0) return { ok: false, error: "noClient" };

  const created = await pushTorrentToUser(user.id, torrent, null);
  revalidatePath("/", "layout");

  if (created.length === 0) return { ok: true, reason: "alreadyQueued" };
  return { ok: true };
}

/** Retry an ERROR task by re-pushing the torrent to its client. */
export async function retryDownloadAction(
  formData: FormData
): Promise<DownloadActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  const taskId = Number(formData.get("id"));
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return { ok: false, error: "notFound" };
  }

  const rows = await db
    .select({ task: downloadTasks, torrent: torrentItems, account: qbittorrentAccounts })
    .from(downloadTasks)
    .innerJoin(
      qbittorrentAccounts,
      eq(downloadTasks.qbAccountId, qbittorrentAccounts.id)
    )
    .leftJoin(torrentItems, eq(downloadTasks.torrentId, torrentItems.id))
    .where(and(eq(downloadTasks.id, taskId), eq(downloadTasks.userId, user.id)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, error: "notFound" };
  const { task, torrent, account } = row;

  const urls: string[] = [];
  if (torrent?.magnet) urls.push(torrent.magnet);
  else if (torrent?.torrentUrl) urls.push(torrent.torrentUrl);
  else if (task.qbHash) urls.push(`magnet:?xt=urn:btih:${task.qbHash}`);
  if (urls.length === 0) return { ok: false, error: "noUrl" };

  try {
    await addToClient(account, urls, account.defaultCategory ?? undefined);
    await db
      .update(downloadTasks)
      .set({ status: "QUEUED", error: null, updatedAt: new Date() })
      .where(eq(downloadTasks.id, task.id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(downloadTasks)
      .set({ status: "ERROR", error: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(downloadTasks.id, task.id));
    return { ok: false, error: message };
  }
}
