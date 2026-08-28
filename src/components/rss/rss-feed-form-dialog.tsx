"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Pencil, Plus, Rss, XCircle } from "lucide-react";
import {
  subscribeRssByUrlAction,
  updateRssFeedAction,
  type RssFeedFormState,
  type SubscribeFeedState,
} from "@/server/rss/actions";
import type { RssFeed } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/toast";

export interface BangumiOption {
  id: number;
  title: string;
}

/**
 * Add = subscribe with just a URL (name / bangumi are derived from the
 * feed itself); edit keeps the full manual form.
 */
export function RssFeedFormDialog({
  feed,
  bangumiOptions,
}: {
  feed?: RssFeed;
  bangumiOptions: BangumiOption[];
}) {
  return feed ? (
    <EditRssFeedDialog feed={feed} bangumiOptions={bangumiOptions} />
  ) : (
    <SubscribeRssFeedDialog />
  );
}

/** Stable error code → message key suffix */
function resultErrorKey(error: string | undefined): string | null {
  if (!error || error === "notAuthenticated") return null;
  if (error === "duplicate") return "duplicate";
  return ["invalid", "noItems", "noSeries", "ingest"].includes(error)
    ? error
    : "fetch";
}

function SubscribeRssFeedDialog() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);

  async function actionWithSideEffects(
    prev: SubscribeFeedState,
    fd: FormData
  ): Promise<SubscribeFeedState> {
    const result = await subscribeRssByUrlAction(prev, fd);
    if (result.ok && result.results) {
      const succeeded = result.results.filter((r) => r.ok).length;
      const failed = result.results.length - succeeded;
      toast(
        t("feedSubscribeBatchSummary", {
          total: result.results.length,
          succeeded,
          failed,
        }),
        failed > 0 ? "error" : "success"
      );
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<
    SubscribeFeedState,
    FormData
  >(actionWithSideEffects, {});
  const results = state.results ?? [];

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {t("addFeed")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{t("newFeed")}</DialogTitle>
          <DialogDescription>{t("feedSubscribeDescription")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            {state.error === "invalid" ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t("feedSubscribeError_invalid")}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-urls">{t("feedSubscribeLabel")}</Label>
              <Textarea
                id="feed-urls"
                name="urls"
                required
                rows={10}
                spellCheck={false}
                placeholder={t("feedSubscribePlaceholder")}
                className="font-mono text-xs"
              />
            </div>

            {results.length > 0 ? (
              <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
                {results.map((r) => {
                  const key = resultErrorKey(r.error);
                  return (
                    <li
                      key={r.url}
                      className="flex items-start gap-2 text-muted-foreground"
                    >
                      {r.ok ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0">
                        <span
                          className="block truncate font-mono text-xs"
                          title={r.url}
                        >
                          {r.url}
                        </span>
                        {r.ok ? (
                          <span className="text-xs">
                            {t("feedSubscribeSuccess", {
                              series: r.series ?? "",
                              created: r.created ?? 0,
                              skipped: r.skipped ?? 0,
                            })}
                          </span>
                        ) : key ? (
                          <span className="text-xs text-destructive">
                            {t(`feedSubscribeError_${key}`)}
                          </span>
                        ) : (
                          <span className="text-xs text-destructive">
                            {tCommon("error")}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Rss />
                )}
                {t("feedSubscribeSubmit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditRssFeedDialog({
  feed,
  bangumiOptions,
}: {
  feed: RssFeed;
  bangumiOptions: BangumiOption[];
}) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);

  async function actionWithSideEffects(
    prev: RssFeedFormState,
    fd: FormData
  ): Promise<RssFeedFormState> {
    const result = await updateRssFeedAction(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast(tCommon("saved"), "success");
    } else if (result.error === "duplicate") {
      toast(t("feedDuplicate"), "error");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<
    RssFeedFormState,
    FormData
  >(actionWithSideEffects, {});

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={tCommon("edit")}
        title={tCommon("edit")}
        onClick={() => setOpen(true)}
      >
        <Pencil />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{t("editFeed")}</DialogTitle>
          <DialogDescription>{t("feedFormDescription")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={feed.id} />

            {state.error && state.error !== "duplicate" ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tCommon("error")}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-name">{tCommon("name")}</Label>
              <Input
                id="feed-name"
                name="name"
                required
                maxLength={255}
                defaultValue={feed.name}
                placeholder={t("feedNamePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-url">{tCommon("url")}</Label>
              <Input
                id="feed-url"
                name="url"
                type="url"
                required
                maxLength={2048}
                defaultValue={feed.url}
                placeholder="https://mikanani.me/RSS/Bangumi?bangumiId=227"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-bangumi">{t("feedBangumi")}</Label>
              <Select
                id="feed-bangumi"
                name="bangumiId"
                required
                defaultValue={feed.bangumiId ?? ""}
              >
                <option value="" disabled>
                  {t("feedBangumiPlaceholder")}
                </option>
                {bangumiOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </Select>
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
