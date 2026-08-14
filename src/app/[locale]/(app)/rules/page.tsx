import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Regex, Rss, SlidersHorizontal } from "lucide-react";
import { db } from "@/db";
import { downloadRules, rssFeeds } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RuleFormDialog } from "@/components/rules/rule-form-dialog";
import { RuleRowActions } from "@/components/rules/rule-row-actions";

export const metadata: Metadata = { title: "Rules" };

export default async function RulesPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const t = await getTranslations("rules");
  const tCommon = await getTranslations("common");

  const [rules, feeds] = await Promise.all([
    db
      .select()
      .from(downloadRules)
      .where(eq(downloadRules.userId, user.id))
      .orderBy(asc(downloadRules.id)),
    db
      .select({ id: rssFeeds.id, name: rssFeeds.name })
      .from(rssFeeds)
      .where(eq(rssFeeds.userId, user.id))
      .orderBy(asc(rssFeeds.name)),
  ]);

  const feedNameById = new Map(feeds.map((f) => [f.id, f.name]));
  const feedOptions = feeds;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <RuleFormDialog feeds={feedOptions} />
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal className="size-5" />}
          title={t("empty")}
          action={<RuleFormDialog feeds={feedOptions} />}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{rule.name}</p>
                    <Badge variant={rule.enabled ? "success" : "secondary"}>
                      {rule.enabled
                        ? tCommon("enabled")
                        : tCommon("disabled")}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {rule.keyword
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean)
                      .map((keyword) => (
                        <Badge key={keyword}>{keyword}</Badge>
                      ))}
                    {rule.excludeKeyword
                      ? rule.excludeKeyword
                          .split(",")
                          .map((k) => k.trim())
                          .filter(Boolean)
                          .map((keyword) => (
                            <Badge key={`ex-${keyword}`} variant="destructive">
                              ¬{keyword}
                            </Badge>
                          ))
                      : null}
                    {rule.resolution ? (
                      <Badge variant="outline">{rule.resolution}</Badge>
                    ) : null}
                    {rule.minSizeMb != null || rule.maxSizeMb != null ? (
                      <Badge variant="outline">
                        {rule.minSizeMb != null ? `${rule.minSizeMb}` : "0"}–
                        {rule.maxSizeMb != null ? `${rule.maxSizeMb}` : "∞"} MB
                      </Badge>
                    ) : null}
                    {rule.mustRegex ? (
                      <Badge variant="outline" className="gap-1 font-mono">
                        <Regex className="size-3" />
                        {rule.mustRegex}
                      </Badge>
                    ) : null}
                    {rule.feedId ? (
                      <Badge variant="outline" className="gap-1">
                        <Rss className="size-3" />
                        {feedNameById.get(rule.feedId) ?? "?"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <RuleFormDialog rule={rule} feeds={feedOptions} />
                  <RuleRowActions
                    ruleId={rule.id}
                    enabled={rule.enabled}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
