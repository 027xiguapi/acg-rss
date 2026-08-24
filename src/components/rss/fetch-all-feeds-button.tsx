"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";
import { fetchFeedsAction, type FetchState } from "@/server/rss/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

export function FetchAllFeedsButton() {
  const t = useTranslations("admin");
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

  const [, action, isPending] = useActionState<FetchState, FormData>(
    fetchWithToast,
    {}
  );

  return (
    <form action={action}>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {t("fetchAll")}
      </Button>
    </form>
  );
}
