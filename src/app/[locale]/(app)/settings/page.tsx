import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { KeyRound, MonitorSmartphone, User } from "lucide-react";
import { db } from "@/db";
import { apiTokens, qbittorrentAccounts } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { AccountFormDialog } from "@/components/qb/account-form-dialog";
import { DeleteAccountButton } from "@/components/qb/delete-account-button";
import { TokenCreator } from "@/components/tokens/token-creator";
import { DeleteTokenButton } from "@/components/tokens/delete-token-button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const locale = await getLocale();
  const t = await getTranslations("settings");
  const tCommon = await getTranslations("common");

  const [accounts, tokens] = await Promise.all([
    db
      .select()
      .from(qbittorrentAccounts)
      .where(eq(qbittorrentAccounts.userId, user.id))
      .orderBy(asc(qbittorrentAccounts.id)),
    db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, user.id))
      .orderBy(desc(apiTokens.createdAt)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4 text-muted-foreground" />
            {t("profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("profile.username")}
            </p>
            <p className="mt-0.5 font-medium">{user.username}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("profile.email")}
            </p>
            <p className="mt-0.5 font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("profile.memberSince")}
            </p>
            <p className="mt-0.5 font-medium">
              {formatDateTime(user.createdAt, locale)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* qBittorrent clients */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <MonitorSmartphone className="size-4 text-muted-foreground" />
              {t("qbittorrent")}
            </CardTitle>
            <CardDescription>{t("accounts.subtitle")}</CardDescription>
          </div>
          <AccountFormDialog />
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <EmptyState
              icon={<MonitorSmartphone className="size-5" />}
              title={t("accounts.empty")}
              action={<AccountFormDialog />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("name")}</TableHead>
                  <TableHead>{tCommon("url")}</TableHead>
                  <TableHead className="w-32">{t("accounts.username")}</TableHead>
                  <TableHead className="w-24">{tCommon("status")}</TableHead>
                  <TableHead className="w-24 text-right">
                    {tCommon("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <p className="font-medium">{account.name}</p>
                      {account.defaultCategory ? (
                        <p className="text-xs text-muted-foreground">
                          {account.defaultCategory}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate text-sm text-muted-foreground">
                      {account.url}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {account.username}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={account.enabled ? "success" : "secondary"}
                      >
                        {account.enabled
                          ? tCommon("enabled")
                          : tCommon("disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <AccountFormDialog account={account} />
                        <DeleteAccountButton accountId={account.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* API tokens */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-muted-foreground" />
              {t("apiTokens")}
            </CardTitle>
            <CardDescription>{t("tokens.subtitle")}</CardDescription>
          </div>
          <TokenCreator />
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="size-5" />}
              title={t("tokens.empty")}
              action={<TokenCreator />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("name")}</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="w-40">{t("tokens.lastUsed")}</TableHead>
                  <TableHead className="w-40">
                    {tCommon("createdAt")}
                  </TableHead>
                  <TableHead className="w-16 text-right">
                    {tCommon("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {token.prefix}…
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(token.lastUsedAt, locale)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(token.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <DeleteTokenButton tokenId={token.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
