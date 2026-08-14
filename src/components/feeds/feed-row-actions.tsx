"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, PowerOff, RefreshCw, Trash2, Zap } from "lucide-react";
import {
  deleteFeedAction,
  refreshFeedAction,
  toggleFeedAction,
} from "@/server/feeds/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

function formDataFor(id: number, extra?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("id", String(id));
  for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
  return fd;
}

export function FeedRowActions({
  feedId,
  enabled,
}: {
  feedId: number;
  enabled: boolean;
}) {
  const t = useTranslations("feeds");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  function fetchNow() {
    startTransition(async () => {
      const result = await refreshFeedAction(formDataFor(feedId));
      if (result.ok) {
        toast(
          result.inserted
            ? `${t("fetched")} (+${result.inserted})`
            : t("fetched"),
          "success"
        );
      } else {
        toast(t("errors.fetchFailed", { message: result.error ?? "" }), "error");
      }
    });
  }

  function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      await deleteFeedAction(formDataFor(feedId));
      toast(tCommon("deleted"), "success");
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("fetchNow")}
        title={t("fetchNow")}
        disabled={pending}
        onClick={fetchNow}
      >
        {pending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <RefreshCw />
        )}
      </Button>
      <form action={toggleFeedAction}>
        <input type="hidden" name="id" value={feedId} />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label={enabled ? tCommon("disable") : tCommon("enable")}
          title={enabled ? tCommon("disable") : tCommon("enable")}
        >
          {enabled ? <Zap /> : <PowerOff />}
        </Button>
      </form>
      <Button
        variant="ghost"
        size="icon"
        aria-label={tCommon("delete")}
        title={tCommon("delete")}
        disabled={pending}
        onClick={remove}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
