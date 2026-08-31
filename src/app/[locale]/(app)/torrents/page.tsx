import type { Metadata } from "next";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Download, Search } from "lucide-react";
import { db } from "@/db";
import { bangumiInfos, torrentItems } from "@/db/schema";
import { formatBytes, formatDateTime } from "@/lib/format";
import { parsePage, parsePageSize, searchPattern } from "@/lib/pagination";
import { extractSubgroup } from "@/lib/parser";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
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
import { buttonVariants } from "@/components/ui/button";
import { TorrentRowActions } from "@/components/torrents/torrent-row-actions";

export const metadata: Metadata = { title: "Torrents" };

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}

/**
 * Read-only torrent browser for the public side: every indexed release in a
 * searchable, paginated table. Each row hands off to the torrent client
 * (magnet / .torrent) or copies the link — no management actions here.
 */
export default async function TorrentsPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const t = await getTranslations("torrents");
  const tCommon = await getTranslations("common");

  const { q, page, pageSize: pageSizeParam } = await searchParams;
  const query = (q ?? "").trim();
  const pageNumber = parsePage(page);
  const pageSize = parsePageSize(pageSizeParam);

  const where = query
    ? or(
        ilike(torrentItems.title, searchPattern(query)),
        ilike(torrentItems.category, searchPattern(query)),
        ilike(torrentItems.infoHash, searchPattern(query)),
        ilike(torrentItems.subgroup, searchPattern(query))
      )
    : undefined;

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(torrentItems)
    .where(where);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rows = await db
    .select()
    .from(torrentItems)
    .where(where)
    .orderBy(desc(torrentItems.publishTime), desc(torrentItems.createdAt))
    .limit(pageSize)
    .offset((pageNumber - 1) * pageSize);

  // Primary display name of each linked bangumi (targeted, avoids a cross join).
  const linkedIds = rows
    .map((r) => r.bangumiId)
    .filter((id): id is number => id != null);
  const titleRows = linkedIds.length
    ? await db
        .select({ bangumiId: bangumiInfos.bangumiId, title: bangumiInfos.title })
        .from(bangumiInfos)
        .where(
          and(
            eq(bangumiInfos.kind, "primary"),
            inArray(bangumiInfos.bangumiId, linkedIds)
          )
        )
    : [];
  const titleMap = new Map(titleRows.map((r) => [r.bangumiId, r.title]));

  const start = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const end = Math.min(total, pageNumber * pageSize);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("appSubtitle")}</p>
        </div>
        <AdminSearch query={query} />
      </div>

      {total === 0 ? (
        <EmptyState
          icon={query ? <Search className="size-5" /> : <Download className="size-5" />}
          title={query ? tCommon("noResults") : t("empty")}
          action={
            query ? (
              <Link
                href="/torrents"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {tCommon("clearSearch")}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("torrentTitle")}</TableHead>
                    <TableHead>{t("bangumi")}</TableHead>
                    <TableHead>{t("episode")}</TableHead>
                    <TableHead>{tCommon("size")}</TableHead>
                    <TableHead>{tCommon("published")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((torrent) => {
                    const subgroup = torrent.subgroup ?? extractSubgroup(torrent.title);
                    const bangumiTitle =
                      torrent.bangumiId != null
                        ? titleMap.get(torrent.bangumiId)
                        : undefined;
                    return (
                      <TableRow key={torrent.id}>
                        <TableCell>
                          <div className="flex min-w-0 flex-col gap-1">
                            <span
                              className="block max-w-[36rem] truncate font-medium"
                              title={torrent.title}
                            >
                              {torrent.title}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {subgroup ? (
                                <Badge variant="outline">{subgroup}</Badge>
                              ) : null}
                              {torrent.resolution ? (
                                <Badge variant="outline">{torrent.resolution}</Badge>
                              ) : null}
                              {torrent.category ? (
                                <Badge variant="outline">{torrent.category}</Badge>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {torrent.bangumiId != null && bangumiTitle ? (
                            <Link
                              href={`/bangumi/${torrent.bangumiId}`}
                              className="font-medium hover:underline"
                            >
                              {bangumiTitle}
                            </Link>
                          ) : (
                            <Badge variant="secondary">{t("unmatched")}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {torrent.episode != null ? `#${torrent.episode}` : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {torrent.size != null ? formatBytes(torrent.size) : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateTime(torrent.publishTime ?? torrent.createdAt, locale)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <TorrentRowActions
                              magnet={torrent.magnet}
                              torrentUrl={torrent.torrentUrl}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {tCommon("showing", { start, end, total })}
            </p>
            <Pagination
              basePath="/torrents"
              page={pageNumber}
              totalPages={totalPages}
              params={query ? { q: query } : undefined}
              pageSize={pageSize}
            />
          </div>
        </>
      )}
    </div>
  );
}
