"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, RotateCcw } from "lucide-react";
import { retryDownloadAction } from "@/server/downloads/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

export function RetryButton({ taskId }: { taskId: number }) {
  const t = useTranslations("downloads");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  function retry() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", String(taskId));
      const result = await retryDownloadAction(fd);
      if (result.ok) {
        toast(t("retry"), "success");
      } else {
        toast(result.error ?? tCommon("error"), "error");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("retry")}
      title={t("retry")}
      disabled={pending}
      onClick={retry}
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
    </Button>
  );
}
