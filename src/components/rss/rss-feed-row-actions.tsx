"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import {
  deleteRssFeedAction,
  fetchFeedsAction,
  type FetchState,
} from "@/server/rss/actions";
import type { RssFeed } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  RssFeedFormDialog,
  type BangumiOption,
} from "@/components/rss/rss-feed-form-dialog";
import { useToast } from "@/components/toast";

export function RssFeedRowActions({
  feed,
  bangumiOptions,
}: {
  feed: RssFeed;
  bangumiOptions: BangumiOption[];
}) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const toast = useToast();

  async function fetchWithToast(
    prev: FetchState,
    fd: FormData
  ): Promise<FetchState> {
    const result = await fetchFeedsAction(prev, fd);
    if (result.ok) {
      toast(
        t("fetchResult", {
          created: result.created ?? 0,
          skipped: result.skipped ?? 0,
        }),
        result.error ? "error" : "success"
      );
    }
    return result;
  }

  const [, fetchAction, isFetching] = useActionState<FetchState, FormData>(
    fetchWithToast,
    {}
  );

  return (
    <div className="flex items-center justify-end gap-1">
      <form action={fetchAction}>
        <input type="hidden" name="id" value={feed.id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label={t("fetch")}
          title={t("fetch")}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </form>

      <RssFeedFormDialog feed={feed} bangumiOptions={bangumiOptions} />

      <form
        action={deleteRssFeedAction}
        onSubmit={(e) => {
          if (!confirm(t("feedDeleteConfirm"))) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={feed.id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label={tCommon("delete")}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </form>
    </div>
  );
}
