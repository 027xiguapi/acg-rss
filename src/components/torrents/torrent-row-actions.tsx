"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Copy, Download, Loader2 } from "lucide-react";
import { downloadNowAction } from "@/server/downloads/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

export function TorrentRowActions({
  torrentId,
  magnet,
}: {
  torrentId: number;
  magnet: string | null;
}) {
  const t = useTranslations("torrents");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  function download() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("torrentId", String(torrentId));
      const result = await downloadNowAction(fd);
      if (result.ok) {
        toast(t("addedToQueue"), "success");
      } else if (result.error === "noClient") {
        toast(t("notBound"), "error");
      } else {
        toast(tCommon("error"), "error");
      }
    });
  }

  async function copyMagnet() {
    if (!magnet) return;
    try {
      await navigator.clipboard.writeText(magnet);
      toast(tCommon("copied"), "success");
    } catch {
      toast(tCommon("error"), "error");
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("copyMagnet")}
        title={t("copyMagnet")}
        disabled={!magnet}
        onClick={copyMagnet}
      >
        <Copy />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("downloadNow")}
        title={t("downloadNow")}
        disabled={pending}
        onClick={download}
        className="text-primary hover:text-primary"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Download />}
      </Button>
    </div>
  );
}
