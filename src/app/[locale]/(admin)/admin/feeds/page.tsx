import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Rss } from "lucide-react";
import { db } from "@/db";
import { bangumi, bangumiInfos, rssFeeds } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import {
  RssFeedFormDialog,
  type BangumiOption,
} from "@/components/rss/rss-feed-form-dialog";
import { RssFeedRowActions } from "@/components/rss/rss-feed-row-actions";
import { FetchAllFeedsButton } from "@/components/rss/fetch-all-feeds-button";

export const metadata: Metadata = { title: "RSS Feeds" };

/**
 * Admin-only RSS subscription management: every feed (name, URL, target
 * bangumi, fetch state) with add/edit/delete and manual fetch actions.
 */
export default async function AdminFeedsPage() {
  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tCommon = await getTranslations("common");

  const feeds = await db.select().from(rssFeeds).orderBy(rssFeeds.id);

  const bangumiRows = await db
    .select({ id: bangumi.id, title: bangumiInfos.title })
    .from(bangumi)
    .innerJoin(bangumiInfos, eq(bangumiInfos.bangumiId, bangumi.id))
    .where(eq(bangumiInfos.kind, "primary"));

  const bangumiOptions: BangumiOption[] = bangumiRows.map((r) => ({
    id: r.id,
    title: r.title,
  }));
  const titleMap = new Map(bangumiRows.map((r) => [r.id, r.title]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("feedsTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("feedsSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <FetchAllFeedsButton />
          <RssFeedFormDialog bangumiOptions={bangumiOptions} />
        </div>
      </div>

      {feeds.length === 0 ? (
        <EmptyState
          icon={<Rss className="size-5" />}
          title={t("noFeeds")}
          description={t("noFeedsHint")}
          action={<RssFeedFormDialog bangumiOptions={bangumiOptions} />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("name")}</TableHead>
                  <TableHead>{tCommon("url")}</TableHead>
                  <TableHead>{t("feedBangumi")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
                  <TableHead>{tCommon("lastFetched")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeds.map((feed) => (
                  <TableRow key={feed.id}>
                    <TableCell className="font-medium">{feed.name}</TableCell>
                    <TableCell
                      className="max-w-60 truncate text-sm text-muted-foreground"
                      title={feed.url}
                    >
                      {feed.url}
                    </TableCell>
                    <TableCell className="text-sm">
                      {titleMap.get(feed.bangumiId) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={feed.enabled ? "success" : "secondary"}>
                        {feed.enabled ? tCommon("enabled") : tCommon("disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {feed.lastFetchedAt
                        ? formatDateTime(feed.lastFetchedAt, locale)
                        : tCommon("never")}
                      {feed.lastError ? (
                        <span
                          className="block max-w-52 truncate text-xs text-destructive"
                          title={feed.lastError}
                        >
                          {feed.lastError}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <RssFeedRowActions feed={feed} bangumiOptions={bangumiOptions} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
