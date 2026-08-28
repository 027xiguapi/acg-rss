import type { Metadata } from "next";
import { asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Search, UserCog, Users } from "lucide-react";
import { db } from "@/db";
import { accounts, bangumi, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { PAGE_SIZE, parsePage, searchPattern } from "@/lib/pagination";
import { getSessionUser } from "@/server/auth/session";
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
import { UserFormDialog } from "@/components/admin/users/user-form-dialog";
import { DeleteUserButton } from "@/components/admin/users/delete-user-button";

export const metadata: Metadata = { title: "User Management" };

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

/**
 * Admin-only user management: every account in one table with identity,
 * role badge and OAuth provider links, plus create/edit/delete actions.
 * Deleting a user cascades their bangumi, accounts and sessions; guard
 * rails in src/server/users/actions.ts protect the caller and the last
 * remaining admin. Search matches username, email or display name.
 */
export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { q, page } = await searchParams;
  const query = (q ?? "").trim();
  const pageNumber = parsePage(page);

  const where = query
    ? or(
        ilike(users.username, searchPattern(query)),
        ilike(users.email, searchPattern(query)),
        ilike(users.name, searchPattern(query))
      )
    : undefined;

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(where);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(asc(users.id))
    .limit(PAGE_SIZE)
    .offset((pageNumber - 1) * PAGE_SIZE);

  const ids = rows.map((r) => r.id);
  const [accountRows, bangumiCounts, adminCountRows, viewer, locale] =
    await Promise.all([
      ids.length
        ? db
            .select({
              userId: accounts.userId,
              providers: sql<string[]>`array_agg(${accounts.provider})`,
            })
            .from(accounts)
            .where(inArray(accounts.userId, ids))
            .groupBy(accounts.userId)
        : Promise.resolve([]),
      ids.length
        ? db
            .select({ userId: bangumi.userId, count: sql<number>`count(*)::int` })
            .from(bangumi)
            .where(inArray(bangumi.userId, ids))
            .groupBy(bangumi.userId)
        : Promise.resolve([]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.role, "admin")),
      getSessionUser(),
      getLocale(),
    ]);
  const t = await getTranslations("admin");
  const tCommon = await getTranslations("common");

  const providerMap = new Map(
    accountRows.map((row) => [row.userId, row.providers])
  );
  const bangumiMap = new Map(
    bangumiCounts.map((row) => [row.userId, row.count])
  );
  const singleAdmin = (adminCountRows[0]?.count ?? 0) <= 1;

  const start = total === 0 ? 0 : (pageNumber - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, pageNumber * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("users.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("users.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch query={query} />
          <UserFormDialog />
        </div>
      </div>

      {total === 0 ? (
        query ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title={tCommon("noResults")}
            action={
              <Link
                href="/admin/users"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {tCommon("clearSearch")}
              </Link>
            }
          />
        ) : (
          <EmptyState icon={<Users className="size-5" />} title={t("users.empty")} />
        )
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("users.username")}</TableHead>
                    <TableHead>{t("users.displayName")}</TableHead>
                    <TableHead>{t("users.email")}</TableHead>
                    <TableHead>{t("users.role")}</TableHead>
                    <TableHead>{t("users.oauthProviders")}</TableHead>
                    <TableHead>{t("users.bangumiCount")}</TableHead>
                    <TableHead>{t("updatedAt")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isSelf = viewer?.id === row.id;
                    const protectedRow =
                      isSelf || (singleAdmin && row.role === "admin");
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {row.username}
                          {isSelf ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({t("users.you")})
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-40 truncate">
                          {row.name ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-52 truncate text-sm text-muted-foreground">
                          {row.email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.role === "admin" ? "default" : "secondary"}>
                            {row.role === "admin"
                              ? t("users.roleAdmin")
                              : t("users.roleUser")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {(providerMap.get(row.id) ?? []).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {bangumiMap.get(row.id) ?? 0}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateTime(row.updatedAt, locale)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <UserFormDialog user={row} />
                            <DeleteUserButton userId={row.id} disabled={protectedRow} />
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
              basePath="/admin/users"
              page={pageNumber}
              totalPages={totalPages}
              params={query ? { q: query } : undefined}
            />
          </div>
        </>
      )}

      <p className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <UserCog className="mt-0.5 size-4 shrink-0" />
        {t("users.hints")}
      </p>
    </div>
  );
}
