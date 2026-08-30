import type { Metadata } from "next";
import { and, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Search, Users } from "lucide-react";
import { db } from "@/db";
import { subgroups, torrentItems } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { parsePage, parsePageSize, searchPattern } from "@/lib/pagination";
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
import { SubgroupFormDialog } from "@/components/subgroups/subgroup-form-dialog";
import { SubgroupRowActions } from "@/components/subgroups/subgroup-row-actions";
import {
  BatchDeleteBar,
  BatchRowCheckbox,
  BatchSelectAllCheckbox,
  BatchSelectionProvider,
} from "@/components/admin/batch-delete";
import { batchDeleteSubgroupsAction } from "@/server/subgroups/actions";

export const metadata: Metadata = { title: "Subgroups" };

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}

/**
 * Admin-only fansub/release group management. Torrents parsed with a
 * matching subgroup name bind to these rows via torrent_items.subgroup_id.
 * Search matches the name or category; results are paginated.
 */
export default async function AdminSubgroupsPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tCommon = await getTranslations("common");

  const { q, page, pageSize: pageSizeParam } = await searchParams;
  const query = (q ?? "").trim();
  const pageNumber = parsePage(page);
  const pageSize = parsePageSize(pageSizeParam);

  const where = query
    ? or(
        ilike(subgroups.name, searchPattern(query)),
        ilike(subgroups.category, searchPattern(query))
      )
    : undefined;

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subgroups)
    .where(where);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rows = await db
    .select()
    .from(subgroups)
    .where(where)
    .orderBy(subgroups.name)
    .limit(pageSize)
    .offset((pageNumber - 1) * pageSize);

  const ids = rows.map((r) => r.id);
  const torrentStats = ids.length
    ? await db
        .select({
          subgroupId: torrentItems.subgroupId,
          count: sql<number>`count(${torrentItems.id})::int`,
        })
        .from(torrentItems)
        .where(
          and(
            isNotNull(torrentItems.subgroupId),
            inArray(torrentItems.subgroupId, ids)
          )
        )
        .groupBy(torrentItems.subgroupId)
    : [];

  const countMap = new Map(
    torrentStats.map((s) => [s.subgroupId, s.count] as const)
  );

  const start = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const end = Math.min(total, pageNumber * pageSize);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("subgroupsTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subgroupsSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch query={query} />
          <SubgroupFormDialog />
        </div>
      </div>

      {total === 0 ? (
        query ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title={tCommon("noResults")}
            action={
              <Link
                href="/admin/subgroups"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {tCommon("clearSearch")}
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Users className="size-5" />}
            title={t("noSubgroups")}
            description={t("noSubgroupsHint")}
            action={<SubgroupFormDialog />}
          />
        )
      ) : (
        <>
          <Card>
            <BatchSelectionProvider>
              <BatchDeleteBar action={batchDeleteSubgroupsAction} />
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <BatchSelectAllCheckbox ids={rows.map((r) => r.id)} />
                      </TableHead>
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
                        <TableCell>
                          <BatchRowCheckbox id={subgroup.id} />
                        </TableCell>
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
            </BatchSelectionProvider>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {tCommon("showing", { start, end, total })}
            </p>
            <Pagination
              basePath="/admin/subgroups"
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
