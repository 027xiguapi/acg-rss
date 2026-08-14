import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { downloadTasks, qbittorrentAccounts } from "@/db/schema";
import { decryptSecret } from "../crypto";
import {
  QBittorrentClient,
  mapStateToStatus,
} from "../qbittorrent/client";

/** Statuses that can still change; COMPLETED tasks are left untouched. */
const ACTIVE_STATUSES = ["QUEUED", "DOWNLOADING", "PAUSED"] as const;

/**
 * Pull fresh state from every referenced qBittorrent account and update
 * the matching download tasks. Grouped by account so each client is
 * logged into at most once per run.
 */
export async function syncDownloadTasks(): Promise<void> {
  const rows = await db
    .select({ task: downloadTasks, account: qbittorrentAccounts })
    .from(downloadTasks)
    .innerJoin(
      qbittorrentAccounts,
      eq(downloadTasks.qbAccountId, qbittorrentAccounts.id)
    )
    .where(
      and(
        isNotNull(downloadTasks.qbHash),
        inArray(downloadTasks.status, [...ACTIVE_STATUSES])
      )
    );

  if (rows.length === 0) return;

  const byAccount = new Map<
    number,
    { account: (typeof rows)[number]["account"]; tasks: (typeof rows)[number]["task"][] }
  >();
  for (const { task, account } of rows) {
    const group = byAccount.get(account.id) ?? { account, tasks: [] };
    group.tasks.push(task);
    byAccount.set(account.id, group);
  }

  await Promise.all(
    [...byAccount.values()].map(async ({ account, tasks }) => {
      try {
        const client = new QBittorrentClient(
          account.url,
          account.username,
          decryptSecret(account.passwordEncrypted)
        );
        await client.login();
        const infos = await client.getTorrentsInfo(
          tasks.map((t) => t.qbHash!)
        );
        const infoByHash = new Map(
          infos.map((info) => [info.hash.toLowerCase(), info])
        );

        for (const task of tasks) {
          const info = infoByHash.get((task.qbHash ?? "").toLowerCase());
          if (!info) continue; // unknown to the client; leave as-is
          const mapped = mapStateToStatus(info.state);
          await db
            .update(downloadTasks)
            .set({
              status: mapped.status,
              progress: mapped.progress ?? info.progress,
              downloadSpeed: info.dlspeed,
              uploadSpeed: info.upspeed,
              updatedAt: new Date(),
            })
            .where(eq(downloadTasks.id, task.id));
        }
      } catch (err) {
        console.error(
          `[jobs] qBittorrent sync failed for account #${account.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    })
  );
}
