"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import {
  saveFeedAction,
  type FeedFormState,
} from "@/server/feeds/actions";
import type { RssFeed } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface FeedFormDialogProps {
  feed?: Pick<
    RssFeed,
    "id" | "name" | "url" | "fetchIntervalMinutes" | "enabled"
  >;
}

export function FeedFormDialog({ feed }: FeedFormDialogProps) {
  const t = useTranslations("feeds");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [enabled, setEnabled] = React.useState(feed?.enabled ?? true);
  // Wrap the server action so success side-effects run inside the action
  // itself (no state-sync effect needed)
  async function actionWithSideEffects(
    prev: FeedFormState,
    fd: FormData
  ): Promise<FeedFormState> {
    const result = await saveFeedAction(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast(tCommon("saved"), "success");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<FeedFormState, FormData>(
    actionWithSideEffects,
    {}
  );

  function errorMessage(): string | null {
    if (!state.error) return null;
    if (state.error === "url") return t("errors.url");
    if (state.error === "name") return t("errors.name");
    return tCommon("error");
  }

  const error = errorMessage();

  return (
    <>
      {feed ? (
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
          <DialogTitle>{feed ? t("editFeed") : t("newFeed")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={feed?.id ?? ""} />

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-name">{t("name")}</Label>
              <Input
                id="feed-name"
                name="name"
                required
                maxLength={255}
                defaultValue={feed?.name}
                placeholder={t("namePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-url">{t("url")}</Label>
              <Input
                id="feed-url"
                name="url"
                type="url"
                required
                defaultValue={feed?.url}
                placeholder={t("urlPlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-interval">{t("interval")}</Label>
              <Input
                id="feed-interval"
                name="fetchIntervalMinutes"
                type="number"
                min={1}
                max={1440}
                defaultValue={feed?.fetchIntervalMinutes ?? 5}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="feed-enabled">{t("enabled")}</Label>
              <Switch
                id="feed-enabled"
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
