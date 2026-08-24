"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Copy, Download, Trash2 } from "lucide-react";
import { deleteTorrentAction } from "@/server/torrents/actions";
import type { TorrentItem } from "@/db/schema";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import { TorrentFormDialog } from "@/components/torrents/torrent-form-dialog";

export function TorrentRowActions({
  torrent,
  magnet,
  torrentUrl,
}: {
  /** Present in the management page — renders edit / delete. */
  torrent?: TorrentItem;
  magnet: string | null;
  torrentUrl?: string | null;
}) {
  const t = useTranslations("torrents");
  const tCommon = useTranslations("common");
  const toast = useToast();

  // Prefer the magnet (hands off to the torrent client directly);
  // fall back to the .torrent file link.
  const href = magnet ?? torrentUrl ?? null;

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
    <div className="flex items-center gap-1">
      {href ? (
        <a
          href={href}
          aria-label={tCommon("download")}
          title={tCommon("download")}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-primary")}
        >
          <Download />
        </a>
      ) : null}
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
      {torrent ? (
        <>
          <TorrentFormDialog torrent={torrent} />
          <form
            action={deleteTorrentAction}
            onSubmit={(e) => {
              if (!confirm(t("deleteConfirm"))) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={torrent.id} />
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
        </>
      ) : null}
    </div>
  );
}
