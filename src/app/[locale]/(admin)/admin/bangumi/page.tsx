import type { Metadata } from "next";
import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Languages, Tv } from "lucide-react";
import { db } from "@/db";
import { bangumi, bangumiEpisodes, bangumiInfos, torrentItems, users } from "@/db/schema";
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
import { BangumiFormDialog } from "@/components/bangumi/bangumi-form-dialog";
import { DeleteBangumiButton } from "@/components/bangumi/bangumi-row-actions";

export const metadata: Metadata = { title: "Bangumi Management" };

/**
 * Admin-only bangumi management: every tracked series in one table with
 * metadata, aggregate counts and the last-modified audit trail
 * (updated_by / updated_at), plus edit/delete actions.
 */
export default async function AdminBangumiPage() {
  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tBangumi = await getTranslations("bangumi");
  const tCommon = await getTranslations("common");

  const rows = await db
    .select({ bangumi: bangumi, updatedByName: users.username })
    .from(bangumi)
    .leftJoin(users, eq(bangumi.updatedBy, users.id))
    .orderBy(desc(bangumi.updatedAt));

  // Aggregates per bangumi: episodes and linked torrents, plus the synonym
  // names the edit dialog needs (separate queries avoid a cross join).
  const [episodeStats, torrentStats, titleRows] = await Promise.all([
    db
      .select({
        bangumiId: bangumiEpisodes.bangumiId,
        count: sql<number>`count(${bangumiEpisodes.id})::int`,
      })
      .from(bangumiEpisodes)
      .groupBy(bangumiEpisodes.bangumiId),
    db
      .select({
        bangumiId: torrentItems.bangumiId,
        count: sql<number>`count(${torrentItems.id})::int`,
      })
      .from(torrentItems)
      .where(isNotNull(torrentItems.bangumiId))
      .groupBy(torrentItems.bangumiId),
    rows.length
      ? db
          .select({
            bangumiId: bangumiInfos.bangumiId,
            kind: bangumiInfos.kind,
            lang: bangumiInfos.lang,
            title: bangumiInfos.title,
          })
          .from(bangumiInfos)
          .where(
            inArray(
              bangumiInfos.bangumiId,
              rows.map((r) => r.bangumi.id)
            )
          )
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("bangumiTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("bangumiSubtitle")}</p>
        </div>
        <BangumiFormDialog />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Tv className="size-5" />}
          title={t("noBangumi")}
          action={<BangumiFormDialog />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tBangumi("bangumiTitle")}</TableHead>
                  <TableHead>{tBangumi("watchStatus")}</TableHead>
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
                          {item.airDay ? (
                            <Badge variant="outline">{tBangumi(`weekdays.${item.airDay}`)}</Badge>
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
        </Card>
      )}
    </div>
  );
}
