import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { CircleAlert, Rss } from "lucide-react";
import { db } from "@/db";
import { rssFeeds, torrentItems } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { FeedFormDialog } from "@/components/feeds/feed-form-dialog";
import { FeedRowActions } from "@/components/feeds/feed-row-actions";

export const metadata: Metadata = { title: "Feeds" };

export default async function FeedsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = await getTranslations("feeds");
  const tCommon = await getTranslations("common");

  const feeds = await db
    .select({
      feed: rssFeeds,
      itemCount:
        sql<number>`(select count(*)::int from ${torrentItems} where ${torrentItems.feedId} = ${rssFeeds.id})`,
    })
    .from(rssFeeds)
    .where(eq(rssFeeds.userId, user.id))
    .orderBy(desc(rssFeeds.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <FeedFormDialog />
      </div>

      {feeds.length === 0 ? (
        <EmptyState
          icon={<Rss className="size-5" />}
          title={t("empty")}
          action={<FeedFormDialog />}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon("name")}</TableHead>
                <TableHead className="w-24 text-right">
                  {t("items", { count: "" }).trim()}
                </TableHead>
                <TableHead className="w-28">{t("interval")}</TableHead>
                <TableHead className="w-44">{tCommon("lastFetched")}</TableHead>
                <TableHead className="w-24">{tCommon("status")}</TableHead>
                <TableHead className="w-40 text-right">{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeds.map(({ feed, itemCount }) => (
                <TableRow key={feed.id}>
                  <TableCell>
                    <p className="font-medium">{feed.name}</p>
                    <p className="max-w-[24rem] truncate text-xs text-muted-foreground">
                      {feed.url}
                    </p>
                    {feed.lastError ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <CircleAlert className="size-3 shrink-0" />
                        <span className="max-w-[24rem] truncate">
                          {feed.lastError}
                        </span>
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {itemCount}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {feed.fetchIntervalMinutes} min
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(feed.lastFetchedAt, locale)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={feed.enabled ? "success" : "secondary"}>
                      {feed.enabled
                        ? tCommon("enabled")
                        : tCommon("disabled")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <FeedRowActions
                      feedId={feed.id}
                      enabled={feed.enabled}
                    />
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
