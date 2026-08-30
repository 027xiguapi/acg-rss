import type { Metadata } from "next";
import { and, desc, eq, ilike, inArray, isNotNull, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Languages, Search, Tv } from "lucide-react";
import { db } from "@/db";
import { bangumi, bangumiEpisodes, bangumiInfos, torrentItems, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { parsePage, parsePageSize, searchPattern } from "@/lib/pagination";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { BangumiFormDialog } from "@/components/bangumi/bangumi-form-dialog";
import { AirDaySelect } from "@/components/bangumi/air-day-select";
import { DeleteBangumiButton } from "@/components/bangumi/bangumi-row-actions";
import {
  BatchDeleteBar,
  BatchRowCheckbox,
  BatchSelectAllCheckbox,
  BatchSelectionProvider,
} from "@/components/admin/batch-delete";
import { batchDeleteBangumiAction } from "@/server/bangumi/actions";

export const metadata: Metadata = { title: "Bangumi Management" };

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}

/**
 * Admin-only bangumi management: every tracked series in one table with
 * metadata, aggregate counts and the last-modified audit trail
 * (updated_by / updated_at), plus edit/delete actions. Search matches any
 * bangumi name (primary or synonym); results are paginated.
 */
export default async function AdminBangumiPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tBangumi = await getTranslations("bangumi");
  const tCommon = await getTranslations("common");

  const { q, page, pageSize: pageSizeParam } = await searchParams;
  const query = (q ?? "").trim();
  const pageNumber = parsePage(page);
  const pageSize = parsePageSize(pageSizeParam);

  // A search term filters to bangumi whose primary or synonym name matches.
  const nameMatch = query
    ? db
        .select({ bangumiId: bangumiInfos.bangumiId })
        .from(bangumiInfos)
        .where(ilike(bangumiInfos.title, searchPattern(query)))
    : null;
  const where = nameMatch ? inArray(bangumi.id, nameMatch) : undefined;

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bangumi)
    .where(where);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rows = await db
    .select({ bangumi: bangumi, updatedByName: users.username })
    .from(bangumi)
    .leftJoin(users, eq(bangumi.updatedBy, users.id))
    .where(where)
    .orderBy(desc(bangumi.updatedAt))
    .limit(pageSize)
    .offset((pageNumber - 1) * pageSize);

  // Aggregates per bangumi: episodes and linked torrents, plus the synonym
  // names the edit dialog needs (separate queries avoid a cross join).
  const ids = rows.map((r) => r.bangumi.id);
  const [episodeStats, torrentStats, titleRows] = await Promise.all([
    ids.length
      ? db
          .select({
            bangumiId: bangumiEpisodes.bangumiId,
            count: sql<number>`count(${bangumiEpisodes.id})::int`,
          })
          .from(bangumiEpisodes)
          .where(inArray(bangumiEpisodes.bangumiId, ids))
          .groupBy(bangumiEpisodes.bangumiId)
      : Promise.resolve([]),
    ids.length
      ? db
          .select({
            bangumiId: torrentItems.bangumiId,
            count: sql<number>`count(${torrentItems.id})::int`,
          })
          .from(torrentItems)
          .where(
            and(
              isNotNull(torrentItems.bangumiId),
              inArray(torrentItems.bangumiId, ids)
            )
          )
          .groupBy(torrentItems.bangumiId)
      : Promise.resolve([]),
    ids.length
      ? db
          .select({
            bangumiId: bangumiInfos.bangumiId,
            kind: bangumiInfos.kind,
            lang: bangumiInfos.lang,
            title: bangumiInfos.title,
          })
          .from(bangumiInfos)
          .where(inArray(bangumiInfos.bangumiId, ids))
      : Promise.resolve([]),
  ]);

  const episodeMap = new Map(episodeStats.map((s) => [s.bangumiId, s.count]));
  const torrentMap = new Map(torrentStats.map((s) => [s.bangumiId, s.count]));
  const namesMap = new Map<number, string[]>();
  const primaryMap = new Map<number, string>();
  for (const row of titleRows) {
    if (row.kind === "primary") {
      primaryMap.set(row.bangumiId, row.title);
      continue;
    }
    const line = row.lang ? `${row.title} | ${row.lang}` : row.title;
    const list = namesMap.get(row.bangumiId);
    if (list) list.push(line);
    else namesMap.set(row.bangumiId, [line]);
  }

  const start = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const end = Math.min(total, pageNumber * pageSize);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("bangumiTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("bangumiSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch query={query} />
          <BangumiFormDialog />
        </div>
      </div>

      {total === 0 ? (
        query ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title={tCommon("noResults")}
            action={
              <Link
                href="/admin/bangumi"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {tCommon("clearSearch")}
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Tv className="size-5" />}
            title={t("noBangumi")}
            action={<BangumiFormDialog />}
          />
        )
      ) : (
        <>
          <Card>
            <BatchSelectionProvider>
              <BatchDeleteBar action={batchDeleteBangumiAction} />
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <BatchSelectAllCheckbox ids={rows.map((r) => r.bangumi.id)} />
                      </TableHead>
                      <TableHead>{tBangumi("bangumiTitle")}</TableHead>
                    <TableHead>{tBangumi("watchStatus")}</TableHead>
                    <TableHead>{tBangumi("airDay")}</TableHead>
                    <TableHead>{t("episodesColumn")}</TableHead>
                    <TableHead>{t("updatedBy")}</TableHead>
                    <TableHead>{t("updatedAt")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ bangumi: raw, updatedByName }) => {
                    const item = { ...raw, title: primaryMap.get(raw.id) ?? "" };
                    return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <BatchRowCheckbox id={item.id} />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-col gap-1">
                          <Link
                            href={`/bangumi/${item.id}`}
                            className="truncate font-medium hover:underline"
                            title={item.title}
                          >
                            {item.title}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            <span>{tBangumi("seasonLabel", { season: item.season })}</span>
                            {item.year ? <span>· {item.year}</span> : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {item.type ? (
                              <Badge variant="outline">{tBangumi(`types.${item.type}`)}</Badge>
                            ) : null}
                            {item.origin ? (
                              <Badge variant="outline">{tBangumi(`origins.${item.origin}`)}</Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.watchStatus === "WATCHING"
                              ? "success"
                              : item.watchStatus === "COMPLETED"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {tBangumi(`status.${item.watchStatus}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <AirDaySelect bangumiId={item.id} airDay={item.airDay} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {tBangumi("episodeCount", { count: episodeMap.get(item.id) ?? 0 })}
                        <span className="text-muted-foreground">
                          {" / "}
                          {tBangumi("episodesCollected", { count: torrentMap.get(item.id) ?? 0 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {updatedByName ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(item.updatedAt, locale)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/contents?bangumi=${item.id}`}
                            aria-label={t("contentsTitle")}
                            title={t("contentsTitle")}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "text-muted-foreground"
                            )}
                          >
                            <Languages className="size-4" />
                          </Link>
                          <BangumiFormDialog
                            bangumi={item}
                            initialNames={namesMap.get(item.id) ?? []}
                          />
                          <DeleteBangumiButton bangumiId={item.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
            </BatchSelectionProvider>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {tCommon("showing", { start, end, total })}
            </p>
            <Pagination
              basePath="/admin/bangumi"
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
