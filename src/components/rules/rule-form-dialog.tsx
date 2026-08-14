"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import {
  saveRuleAction,
  type RuleFormState,
} from "@/server/rules/actions";
import type { DownloadRule } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/toast";

const RESOLUTIONS = ["2160p", "1440p", "1080p", "720p", "480p"] as const;

export interface FeedOption {
  id: number;
  name: string;
}

interface RuleFormDialogProps {
  rule?: DownloadRule;
  feeds: FeedOption[];
}

export function RuleFormDialog({ rule, feeds }: RuleFormDialogProps) {
  const t = useTranslations("rules");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [enabled, setEnabled] = React.useState(rule?.enabled ?? true);
  // Wrap the server action so success side-effects run inside the action
  // itself (no state-sync effect needed)
  async function actionWithSideEffects(
    prev: RuleFormState,
    fd: FormData
  ): Promise<RuleFormState> {
    const result = await saveRuleAction(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast(tCommon("saved"), "success");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<RuleFormState, FormData>(
    actionWithSideEffects,
    {}
  );

  const error =
    state.error === "invalidRegex"
      ? tCommon("error")
      : state.error
        ? tCommon("error")
        : null;

  return (
    <>
      {rule ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={tCommon("edit")}
          onClick={() => setOpen(true)}
        >
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          {t("add")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{rule ? t("editRule") : t("newRule")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={rule?.id ?? ""} />

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-name">{t("ruleName")}</Label>
              <Input
                id="rule-name"
                name="name"
                required
                maxLength={255}
                defaultValue={rule?.name}
                placeholder={t("ruleNamePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-keyword">{t("keywords")}</Label>
              <Input
                id="rule-keyword"
                name="keyword"
                required
                maxLength={255}
                defaultValue={rule?.keyword}
                placeholder={t("keywordsHint")}
              />
              <p className="text-xs text-muted-foreground">
                {t("keywordsHint")}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-exclude">{t("excludeKeywords")}</Label>
              <Input
                id="rule-exclude"
                name="excludeKeyword"
                maxLength={255}
                defaultValue={rule?.excludeKeyword ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                {t("excludeKeywordsHint")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-regex">{t("mustRegex")}</Label>
                <Input
                  id="rule-regex"
                  name="mustRegex"
                  defaultValue={rule?.mustRegex ?? ""}
                  placeholder="S\d+E\d+"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t("mustRegexHint")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-resolution">{t("resolution")}</Label>
                <Select
                  id="rule-resolution"
                  name="resolution"
                  defaultValue={rule?.resolution ?? ""}
                >
                  <option value="">{t("resolutionAny")}</option>
                  {RESOLUTIONS.map((res) => (
                    <option key={res} value={res}>
                      {res}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-min-size">{t("minSize")}</Label>
                <Input
                  id="rule-min-size"
                  name="minSizeMb"
                  type="number"
                  min={0}
                  defaultValue={rule?.minSizeMb ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-max-size">{t("maxSize")}</Label>
                <Input
                  id="rule-max-size"
                  name="maxSizeMb"
                  type="number"
                  min={0}
                  defaultValue={rule?.maxSizeMb ?? ""}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-feed">{t("feed")}</Label>
              <Select
                id="rule-feed"
                name="feedId"
                defaultValue={rule?.feedId ? String(rule.feedId) : ""}
              >
                <option value="">{t("feedAny")}</option>
                {feeds.map((feed) => (
                  <option key={feed.id} value={feed.id}>
                    {feed.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="rule-enabled">{t("enabled")}</Label>
              <Switch
                id="rule-enabled"
                name="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {tCommon("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
