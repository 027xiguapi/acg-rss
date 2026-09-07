"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2, Rss } from "lucide-react";
import { getBangumiTorrentsAction } from "@/server/torrents/actions";
import type { TorrentItem } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TorrentReleaseRow } from "@/components/torrents/torrent-release-row";

/**
 * "Subscribe" pill overlaid on a poster card. Opening it lazily fetches the
 * bangumi's newest torrents and lists them with download / copy actions, plus
 * a link to the full detail page.
 */
export function BangumiSubscribeButton({
  bangumiId,
  title,
  className,
}: {
  bangumiId: number;
  title: string;
  className?: string;
}) {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [torrents, setTorrents] = React.useState<TorrentItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function openDialog() {
    setOpen(true);
    if (torrents !== null) return;
    setLoading(true);
    const rows = await getBangumiTorrentsAction(bangumiId);
    setTorrents(rows);
    setLoading(false);
    console.log(888)
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        title={t("subscribe")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75",
          className
        )}
      >
        <Rss className="size-3.5" />
        {t("subscribe")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>{t("recentTorrents")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent className="flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {tCommon("loading")}
            </div>
          ) : torrents && torrents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noRecentTorrents")}
            </p>
          ) : torrents ? (
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {torrents.map((torrent) => (
                <TorrentReleaseRow key={torrent.id} torrent={torrent} />
              ))}
            </div>
          ) : null}

          {!loading ? (
            <div className="flex justify-end border-t pt-3">
              <Link
                href={`/bangumi/${bangumiId}`}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {t("viewAll")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
