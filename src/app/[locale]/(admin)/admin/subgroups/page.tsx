import type { Metadata } from "next";
import { isNotNull, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { db } from "@/db";
import { subgroups, torrentItems } from "@/db/schema";
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
import { SubgroupFormDialog } from "@/components/subgroups/subgroup-form-dialog";
import { SubgroupRowActions } from "@/components/subgroups/subgroup-row-actions";

export const metadata: Metadata = { title: "Subgroups" };

/**
 * Admin-only fansub/release group management. Torrents parsed with a
 * matching subgroup name bind to these rows via torrent_items.subgroup_id.
 */
export default async function AdminSubgroupsPage() {
  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tCommon = await getTranslations("common");

  const rows = await db.select().from(subgroups).orderBy(subgroups.name);

  const torrentStats = await db
    .select({
      subgroupId: torrentItems.subgroupId,
      count: sql<number>`count(${torrentItems.id})::int`,
    })
    .from(torrentItems)
    .where(isNotNull(torrentItems.subgroupId))
    .groupBy(torrentItems.subgroupId);

  const countMap = new Map(
    torrentStats.map((s) => [s.subgroupId, s.count] as const)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("subgroupsTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subgroupsSubtitle")}</p>
        </div>
        <SubgroupFormDialog />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title={t("noSubgroups")}
          description={t("noSubgroupsHint")}
          action={<SubgroupFormDialog />}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("name")}</TableHead>
                  <TableHead>{tCommon("category")}</TableHead>
                  <TableHead>{t("subgroupTorrents")}</TableHead>
                  <TableHead>{tCommon("createdAt")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((subgroup) => (
                  <TableRow key={subgroup.id}>
                    <TableCell className="font-medium">{subgroup.name}</TableCell>
                    <TableCell>
                      {subgroup.category ? (
                        <Badge variant="outline">{subgroup.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {countMap.get(subgroup.id) ?? 0}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(subgroup.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <SubgroupRowActions subgroup={subgroup} />
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
