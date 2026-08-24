"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import {
  createTorrentAction,
  updateTorrentAction,
  type TorrentFormState,
} from "@/server/torrents/actions";
import type { TorrentItem } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/toast";

/** MB ↔ bytes for the edit prefill. */
function toMb(size: number | null): string {
  if (size == null || size <= 0) return "";
  const mb = size / (1024 * 1024);
  return String(Number.isInteger(mb) ? mb : Number(mb.toFixed(2)));
}

export function TorrentFormDialog({ torrent }: { torrent?: TorrentItem }) {
  const t = useTranslations("torrents");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);

  async function actionWithSideEffects(
    prev: TorrentFormState,
    fd: FormData
  ): Promise<TorrentFormState> {
    const result = torrent
      ? await updateTorrentAction(prev, fd)
      : await createTorrentAction(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast(torrent ? t("updated") : t("created"), "success");
    } else if (result.error === "duplicate") {
      toast(t("duplicate"), "error");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<TorrentFormState, FormData>(
    actionWithSideEffects,
    {}
  );

  const sizeMb = toMb(torrent?.size ?? null);

  return (
    <>
      {torrent ? (
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
          <DialogTitle>{torrent ? t("editTorrent") : t("newTorrent")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={torrent?.id ?? ""} />

            {state.error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error === "needLink"
                  ? t("needLinkError")
                  : state.error === "duplicate"
                    ? t("duplicate")
                    : tCommon("error")}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="torrent-title">{t("torrentTitle")}</Label>
              <Input
                id="torrent-title"
                name="title"
                required
                maxLength={2000}
                defaultValue={torrent?.title}
                placeholder={t("torrentTitlePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="torrent-magnet">{t("magnet")}</Label>
              <Input
                id="torrent-magnet"
                name="magnet"
                maxLength={2000}
                defaultValue={torrent?.magnet ?? ""}
                placeholder="magnet:?xt=urn:btih:…"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="torrent-url">{t("torrentUrl")}</Label>
              <Input
                id="torrent-url"
                name="torrentUrl"
                type="url"
                maxLength={2000}
                defaultValue={torrent?.torrentUrl ?? ""}
                placeholder="https://example.com/download.torrent"
              />
              <p className="text-xs text-muted-foreground">{t("needLinkHint")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="torrent-size">{t("sizeMb")}</Label>
                <Input
                  id="torrent-size"
                  name="sizeMb"
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={sizeMb}
                  placeholder="1420"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="torrent-category">{t("category")}</Label>
                <Input
                  id="torrent-category"
                  name="category"
                  maxLength={128}
                  defaultValue={torrent?.category ?? ""}
                />
              </div>
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
