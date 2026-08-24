import type { Metadata } from "next";
import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Languages, Tv } from "lucide-react";
import { db } from "@/db";
import { anime, animeEpisodes, animeInfos, torrentItems, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
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
import { AnimeFormDialog } from "@/components/anime/anime-form-dialog";
import { DeleteAnimeButton } from "@/components/anime/anime-row-actions";

export const metadata: Metadata = { title: "Anime Management" };

/**
 * Admin-only anime management: every tracked series in one table with
 * metadata, aggregate counts and the last-modified audit trail
 * (updated_by / updated_at), plus edit/delete actions.
 */
export default async function AdminAnimePage() {
  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tAnime = await getTranslations("anime");
  const tCommon = await getTranslations("common");

  const rows = await db
    .select({ anime: anime, updatedByName: users.username })
    .from(anime)
    .leftJoin(users, eq(anime.updatedBy, users.id))
    .orderBy(desc(anime.updatedAt));

  // Aggregates per anime: episodes and linked torrents, plus the synonym
  // names the edit dialog needs (separate queries avoid a cross join).
  const [episodeStats, torrentStats, titleRows] = await Promise.all([
    db
      .select({
        animeId: animeEpisodes.animeId,
        count: sql<number>`count(${animeEpisodes.id})::int`,
      })
      .from(animeEpisodes)
      .groupBy(animeEpisodes.animeId),
    db
      .select({
        animeId: torrentItems.animeId,
        count: sql<number>`count(${torrentItems.id})::int`,
      })
      .from(torrentItems)
      .where(isNotNull(torrentItems.animeId))
      .groupBy(torrentItems.animeId),
    rows.length
      ? db
          .select({
            animeId: animeInfos.animeId,
            kind: animeInfos.kind,
            lang: animeInfos.lang,
            title: animeInfos.title,
          })
          .from(animeInfos)
          .where(
            inArray(
              animeInfos.animeId,
              rows.map((r) => r.anime.id)
            )
          )
      : Promise.resolve([]),
  ]);

  const episodeMap = new Map(episodeStats.map((s) => [s.animeId, s.count]));
  const torrentMap = new Map(torrentStats.map((s) => [s.animeId, s.count]));
  const namesMap = new Map<number, string[]>();
  const primaryMap = new Map<number, string>();
  for (const row of titleRows) {
    if (row.kind === "primary") {
      primaryMap.set(row.animeId, row.title);
      continue;
    }
    const line = row.lang ? `${row.title} | ${row.lang}` : row.title;
    const list = namesMap.get(row.animeId);
    if (list) list.push(line);
    else namesMap.set(row.animeId, [line]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("animeTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("animeSubtitle")}</p>
        </div>
        <AnimeFormDialog />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Tv className="size-5" />}
          title={t("noAnime")}
          action={<AnimeFormDialog />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tAnime("animeTitle")}</TableHead>
                  <TableHead>{tAnime("watchStatus")}</TableHead>
                  <TableHead>{t("episodesColumn")}</TableHead>
                  <TableHead>{t("updatedBy")}</TableHead>
                  <TableHead>{t("updatedAt")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ anime: raw, updatedByName }) => {
                  const item = { ...raw, title: primaryMap.get(raw.id) ?? "" };
                  return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col gap-1">
                        <Link
                          href={`/anime/${item.id}`}
                          className="truncate font-medium hover:underline"
                          title={item.title}
                        >
                          {item.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <span>{tAnime("seasonLabel", { season: item.season })}</span>
                          {item.year ? <span>· {item.year}</span> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {item.type ? (
                            <Badge variant="outline">{tAnime(`types.${item.type}`)}</Badge>
                          ) : null}
                          {item.origin ? (
                            <Badge variant="outline">{tAnime(`origins.${item.origin}`)}</Badge>
                          ) : null}
                          {item.airDay ? (
                            <Badge variant="outline">{tAnime(`weekdays.${item.airDay}`)}</Badge>
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
                        {tAnime(`status.${item.watchStatus}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {tAnime("episodeCount", { count: episodeMap.get(item.id) ?? 0 })}
                      <span className="text-muted-foreground">
                        {" / "}
                        {tAnime("episodesCollected", { count: torrentMap.get(item.id) ?? 0 })}
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
                          href={`/admin/contents?anime=${item.id}`}
                          aria-label={t("contentsTitle")}
                          title={t("contentsTitle")}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                            "text-muted-foreground"
                          )}
                        >
                          <Languages className="size-4" />
                        </Link>
                        <AnimeFormDialog
                          anime={item}
                          initialNames={namesMap.get(item.id) ?? []}
                        />
                        <DeleteAnimeButton animeId={item.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
