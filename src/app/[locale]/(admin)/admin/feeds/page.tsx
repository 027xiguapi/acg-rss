import type { Metadata } from "next";
import { eq, ilike, or, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Rss, Search } from "lucide-react";
import { db } from "@/db";
import { bangumi, bangumiInfos, rssFeeds } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { PAGE_SIZE, parsePage, searchPattern } from "@/lib/pagination";
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
import { AdminSearch } from "@/components/admin/admin-search";
import { Pagination } from "@/components/admin/pagination";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  RssFeedFormDialog,
  type BangumiOption,
} from "@/components/rss/rss-feed-form-dialog";
import { RssFeedRowActions } from "@/components/rss/rss-feed-row-actions";
import { RssXmlImportDialog } from "@/components/rss/rss-xml-import-dialog";
import { FetchAllFeedsButton } from "@/components/rss/fetch-all-feeds-button";

export const metadata: Metadata = { title: "RSS Feeds" };

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

/**
 * Admin-only RSS subscription management: every feed (name, URL, target
 * bangumi, fetch state) with add/edit/delete and manual fetch actions.
 * Search matches the feed name or URL; results are paginated.
 */
export default async function AdminFeedsPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tCommon = await getTranslations("common");

  const { q, page } = await searchParams;
  const query = (q ?? "").trim();
  const pageNumber = parsePage(page);

  const where = query
    ? or(
        ilike(rssFeeds.name, searchPattern(query)),
        ilike(rssFeeds.url, searchPattern(query))
      )
    : undefined;

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rssFeeds)
    .where(where);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const feeds = await db
    .select()
    .from(rssFeeds)
    .where(where)
    .orderBy(rssFeeds.id)
    .limit(PAGE_SIZE)
    .offset((pageNumber - 1) * PAGE_SIZE);

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

  const start = total === 0 ? 0 : (pageNumber - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, pageNumber * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("feedsTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("feedsSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch query={query} />
          <FetchAllFeedsButton />
          <RssXmlImportDialog />
          <RssFeedFormDialog bangumiOptions={bangumiOptions} />
        </div>
      </div>

      {total === 0 ? (
        query ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title={tCommon("noResults")}
            action={
              <Link
                href="/admin/feeds"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {tCommon("clearSearch")}
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Rss className="size-5" />}
            title={t("noFeeds")}
            description={t("noFeedsHint")}
            action={<RssFeedFormDialog bangumiOptions={bangumiOptions} />}
          />
        )
      ) : (
        <>
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {tCommon("showing", { start, end, total })}
            </p>
            <Pagination
              basePath="/admin/feeds"
              page={pageNumber}
              totalPages={totalPages}
              params={query ? { q: query } : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}
