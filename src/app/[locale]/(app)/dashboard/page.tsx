import type { Metadata } from "next";
import { and, desc, eq, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Download, Rss, SlidersHorizontal, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import {
  downloadRules,
  downloadTasks,
  qbittorrentAccounts,
  rssFeeds,
  torrentItems,
} from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { formatBytes, formatDateTime, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Dashboard" };

const count = sql<number>`count(*)::int`;

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const userId = user.id;

  const locale = await getLocale();
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  const tDownloads = await getTranslations("downloads");

  const [
    [feedCount],
    [torrentCount],
    [ruleCount],
    [downloadCount],
    downloadsByStatus,
    recentTorrents,
    recentDownloads,
  ] = await Promise.all([
    db.select({ count }).from(rssFeeds).where(eq(rssFeeds.userId, userId)),
    db
      .select({ count })
      .from(torrentItems)
      .innerJoin(rssFeeds, eq(torrentItems.feedId, rssFeeds.id))
      .where(eq(rssFeeds.userId, userId)),
    db
      .select({ count })
      .from(downloadRules)
      .where(
        and(
          eq(downloadRules.userId, userId),
          eq(downloadRules.enabled, true)
        )
      ),
    db
      .select({ count })
      .from(downloadTasks)
      .where(eq(downloadTasks.userId, userId)),
    db
      .select({ status: downloadTasks.status, count })
      .from(downloadTasks)
      .where(eq(downloadTasks.userId, userId))
      .groupBy(downloadTasks.status),
    db
      .select({
        id: torrentItems.id,
        title: torrentItems.title,
        size: torrentItems.size,
        resolution: torrentItems.resolution,
        createdAt: torrentItems.createdAt,
        feedName: rssFeeds.name,
      })
      .from(torrentItems)
      .innerJoin(rssFeeds, eq(torrentItems.feedId, rssFeeds.id))
      .where(eq(rssFeeds.userId, userId))
      .orderBy(desc(torrentItems.createdAt))
      .limit(6),
    db
      .select({
        id: downloadTasks.id,
        title: downloadTasks.title,
        status: downloadTasks.status,
        progress: downloadTasks.progress,
        updatedAt: downloadTasks.updatedAt,
        accountName: qbittorrentAccounts.name,
      })
      .from(downloadTasks)
      .innerJoin(
        qbittorrentAccounts,
        eq(downloadTasks.qbAccountId, qbittorrentAccounts.id)
      )
      .where(eq(downloadTasks.userId, userId))
      .orderBy(desc(downloadTasks.updatedAt))
      .limit(6),
  ]);

  const stats = [
    { label: t("feeds"), value: feedCount.count, icon: Rss, href: "/feeds" },
    {
      label: t("torrents"),
      value: torrentCount.count,
      icon: Sparkles,
      href: "/torrents",
    },
    {
      label: t("rules"),
      value: ruleCount.count,
      icon: SlidersHorizontal,
      href: "/rules",
    },
    {
      label: t("downloads"),
      value: downloadCount.count,
      icon: Download,
      href: "/downloads",
    },
  ];

  const statusMap = new Map(
    downloadsByStatus.map((row) => [row.status, row.count])
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("welcome", { name: user.username })}
        </h1>
        <div className="flex gap-2">
          <Link
            href="/feeds"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
          >
            {t("addFeed")}
          </Link>
          <Link
            href="/rules"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
          >
            {t("createRule")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {value}
                  </p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {downloadCount.count > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("byStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(["DOWNLOADING", "QUEUED", "PAUSED", "COMPLETED", "ERROR"] as const).map(
              (status) => (
                <StatusBadge
                  key={status}
                  status={status}
                  label={`${tDownloads(`status.${status}`)} · ${statusMap.get(status) ?? 0}`}
                />
              )
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t("recentTorrents")}</CardTitle>
            <Link
              href="/torrents"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col">
            {recentTorrents.length === 0 ? (
              <EmptyState
                icon={<Rss className="size-5" />}
                title={tCommon("noData")}
                className="border-0 py-8"
              />
            ) : (
              recentTorrents.map((torrent) => (
                <div
                  key={torrent.id}
                  className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0 last:pb-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {torrent.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {torrent.feedName}
                      {torrent.resolution ? ` · ${torrent.resolution}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>{formatBytes(torrent.size)}</p>
                    <p>{formatDateTime(torrent.createdAt, locale)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t("recentDownloads")}</CardTitle>
            <Link
              href="/downloads"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col">
            {recentDownloads.length === 0 ? (
              <EmptyState
                icon={<Download className="size-5" />}
                title={tCommon("noData")}
                className="border-0 py-8"
              />
            ) : (
              recentDownloads.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0 last:pb-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.accountName} · {formatPercent(task.progress)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(task.updatedAt, locale)}
                    </span>
                    <StatusBadge
                      status={task.status}
                      label={tDownloads(`status.${task.status}`)}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
