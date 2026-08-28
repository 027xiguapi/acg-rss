import type { Metadata } from "next";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, Search, Tv } from "lucide-react";
import { db } from "@/db";
import {
  bangumi,
  bangumiEpisodes,
  bangumiInfos,
  torrentItems,
} from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { PAGE_SIZE, parsePage, searchPattern } from "@/lib/pagination";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
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
import {
  EpisodeFormDialog,
  type BangumiOption,
} from "@/components/bangumi/episode-form-dialog";
import { DeleteEpisodeButton } from "@/components/bangumi/episode-row-actions";

export const metadata: Metadata = { title: "Episode Management" };

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

/**
 * Admin-only episode index: every episode across all series with its series
 * title, torrent count and modification time. Search matches the series
 * title or an exact episode number; results are paginated. Add / renumber /
 * delete operate on the episode row itself.
 */
export default async function AdminEpisodesPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tBangumi = await getTranslations("bangumi");
  const tCommon = await getTranslations("common");

  const { q, page } = await searchParams;
  const query = (q ?? "").trim();
  const pageNumber = parsePage(page);

  // Free-text matches the series name; a purely numeric query also matches
  // the episode number exactly.
  const numericQuery = /^\d+$/.test(query) ? Number(query) : null;
  const conditions: SQL[] = [];
  if (query) conditions.push(ilike(bangumiInfos.title, searchPattern(query)));
  if (numericQuery != null) {
    conditions.push(eq(bangumiEpisodes.number, numericQuery));
  }
  const where = conditions.length > 0 ? or(...conditions) : undefined;

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bangumiEpisodes)
    .innerJoin(bangumi, eq(bangumiEpisodes.bangumiId, bangumi.id))
    .innerJoin(
      bangumiInfos,
      and(eq(bangumiInfos.bangumiId, bangumi.id), eq(bangumiInfos.kind, "primary"))
    )
    .where(where);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows = await db
    .select({ episode: bangumiEpisodes, seriesTitle: bangumiInfos.title })
    .from(bangumiEpisodes)
    .innerJoin(bangumi, eq(bangumiEpisodes.bangumiId, bangumi.id))
    .innerJoin(
      bangumiInfos,
      and(eq(bangumiInfos.bangumiId, bangumi.id), eq(bangumiInfos.kind, "primary"))
    )
    .where(where)
    .orderBy(asc(bangumiInfos.title), asc(bangumiEpisodes.number))
    .limit(PAGE_SIZE)
    .offset((pageNumber - 1) * PAGE_SIZE);

  const ids = rows.map((r) => r.episode.id);
  const torrentStats = ids.length
    ? await db
        .select({
          episodeId: torrentItems.episodeId,
          count: sql<number>`count(*)::int`,
        })
        .from(torrentItems)
        .where(inArray(torrentItems.episodeId, ids))
        .groupBy(torrentItems.episodeId)
    : [];
  const torrentMap = new Map(
    torrentStats.map((s) => [s.episodeId, s.count] as const)
  );

  const bangumiOptions: BangumiOption[] = await db
    .select({ id: bangumi.id, title: bangumiInfos.title })
    .from(bangumi)
    .innerJoin(bangumiInfos, eq(bangumiInfos.bangumiId, bangumi.id))
    .where(eq(bangumiInfos.kind, "primary"))
    .orderBy(asc(bangumiInfos.title));

  const start = total === 0 ? 0 : (pageNumber - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, pageNumber * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("episodeTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("episodesSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch query={query} />
          <EpisodeFormDialog bangumiOptions={bangumiOptions} />
        </div>
      </div>

      {total === 0 ? (
        query ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title={tCommon("noResults")}
            action={
              <Link
                href="/admin/episode"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {tCommon("clearSearch")}
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Tv className="size-5" />}
            title={t("noEpisodes")}
            description={t("noEpisodesHint")}
            action={<EpisodeFormDialog bangumiOptions={bangumiOptions} />}
          />
        )
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("seriesColumn")}</TableHead>
                    <TableHead>{t("episodeColumn")}</TableHead>
                    <TableHead>{t("torrentsColumn")}</TableHead>
                    <TableHead>{t("updatedAt")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ episode, seriesTitle }) => (
                    <TableRow key={episode.id}>
                      <TableCell>
                        <Link
                          href={`/bangumi/${episode.bangumiId}`}
                          className="font-medium hover:underline"
                          title={seriesTitle}
                        >
                          {seriesTitle}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/episode/${episode.id}`}
                          className="font-medium hover:underline"
                          title={t("episodeTitle")}
                        >
                          {tBangumi("episodeTitle", { episode: episode.number })}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {torrentMap.get(episode.id) ?? 0}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(episode.updatedAt, locale)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/episode/${episode.id}`}
                            aria-label={t("viewPublic")}
                            title={t("viewPublic")}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "text-muted-foreground"
                            )}
                          >
                            <ExternalLink className="size-4" />
                          </Link>
                          <EpisodeFormDialog
                            episode={{ id: episode.id, number: episode.number }}
                            bangumiOptions={bangumiOptions}
                          />
                          <DeleteEpisodeButton episodeId={episode.id} />
                        </div>
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
              basePath="/admin/episode"
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
