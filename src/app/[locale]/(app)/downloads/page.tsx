import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { db } from "@/db";
import { downloadTasks, qbittorrentAccounts } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { formatDateTime, formatPercent, formatSpeed } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { RetryButton } from "@/components/downloads/retry-button";

export const metadata: Metadata = { title: "Downloads" };

const PAGE_SIZE = 50;

export default async function DownloadsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = await getTranslations("downloads");
  const tCommon = await getTranslations("common");

  const tasks = await db
    .select({
      task: downloadTasks,
      accountName: qbittorrentAccounts.name,
    })
    .from(downloadTasks)
    .innerJoin(
      qbittorrentAccounts,
      eq(downloadTasks.qbAccountId, qbittorrentAccounts.id)
    )
    .where(eq(downloadTasks.userId, user.id))
    .orderBy(desc(downloadTasks.updatedAt))
    .limit(PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<Download className="size-5" />}
          title={t("empty")}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("torrent")}</TableHead>
                <TableHead className="w-28">{t("account")}</TableHead>
                <TableHead className="w-24">{tCommon("status")}</TableHead>
                <TableHead className="w-44">{t("progress")}</TableHead>
                <TableHead className="w-24">{t("downloadSpeed")}</TableHead>
                <TableHead className="w-40">{tCommon("updated")}</TableHead>
                <TableHead className="w-16 text-right">
                  {tCommon("actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(({ task, accountName }) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <p className="max-w-[24rem] truncate font-medium">
                      {task.title}
                    </p>
                    {task.error ? (
                      <p className="max-w-[24rem] truncate text-xs text-destructive">
                        {task.error}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {accountName}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={task.status}
                      label={t(`status.${task.status}`)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.round(
                              Math.min(Math.max(task.progress, 0), 1) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatPercent(task.progress)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {formatSpeed(task.downloadSpeed)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(task.updatedAt, locale)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {task.status === "ERROR" ? (
                        <RetryButton taskId={task.id} />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
