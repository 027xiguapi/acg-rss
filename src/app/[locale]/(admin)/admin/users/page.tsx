import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { UserCog, Users } from "lucide-react";
import { db } from "@/db";
import { accounts, bangumi, users } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { getLocale } from "next-intl/server";
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
import { UserFormDialog } from "@/components/admin/users/user-form-dialog";
import { DeleteUserButton } from "@/components/admin/users/delete-user-button";

export const metadata: Metadata = { title: "User Management" };

/**
 * Admin-only user management: every account in one table with identity,
 * role badge and OAuth provider links, plus create/edit/delete actions.
 * Deleting a user cascades their bangumi, accounts and sessions; guard
 * rails in src/server/users/actions.ts protect the caller and the last
 * remaining admin.
 */
export default async function AdminUsersPage() {
  const [rows, accountRows, bangumiCounts, viewer, locale] = await Promise.all([
    db.select().from(users).orderBy(asc(users.id)),
    db
      .select({
        userId: accounts.userId,
        providers: sql<string[]>`array_agg(${accounts.provider})`,
      })
      .from(accounts)
      .groupBy(accounts.userId),
    db
      .select({ userId: bangumi.userId, count: sql<number>`count(*)::int` })
      .from(bangumi)
      .groupBy(bangumi.userId),
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
  const singleAdmin = rows.filter((row) => row.role === "admin").length <= 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("users.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("users.subtitle")}</p>
        </div>
        <UserFormDialog />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title={t("users.empty")} />
      ) : (
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
                  <TableHead>{t("admin.updatedAt")}</TableHead>
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
      )}

      <p className="flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <UserCog className="mt-0.5 size-4 shrink-0" />
        {t("users.hints")}
      </p>
    </div>
  );
}
