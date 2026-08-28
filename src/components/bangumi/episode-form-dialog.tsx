"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import {
  saveEpisodeMetaAction,
  type EpisodeMetaState,
} from "@/server/bangumi/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
 * Add = pick a series and episode number; edit = renumber an existing
 * episode (the series is fixed). Duplicates surface as an inline error.
 */
export function EpisodeFormDialog({
  episode,
  bangumiOptions,
}: {
  episode?: { id: number; number: number };
  bangumiOptions: BangumiOption[];
}) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);

  async function actionWithSideEffects(
    prev: EpisodeMetaState,
    fd: FormData
  ): Promise<EpisodeMetaState> {
    const result = await saveEpisodeMetaAction(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast(tCommon("saved"), "success");
    } else if (result.error === "duplicate") {
      toast(t("episodeDuplicate"), "error");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<
    EpisodeMetaState,
    FormData
  >(actionWithSideEffects, {});

  return (
    <>
      {episode ? (
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
          {t("addEpisode")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{episode ? t("editEpisode") : t("newEpisode")}</DialogTitle>
          <DialogDescription>{t("episodeFormDescription")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={episode?.id ?? ""} />

            {state.error === "invalid" ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tCommon("error")}
              </p>
            ) : null}

            {!episode ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="episode-bangumi">{t("episodeBangumi")}</Label>
                <Select id="episode-bangumi" name="bangumiId" required>
                  <option value="" disabled>
                    {t("episodeBangumiPlaceholder")}
                  </option>
                  {bangumiOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="episode-number">{t("episodeNumber")}</Label>
              <Input
                id="episode-number"
                name="number"
                type="number"
                min={0}
                required
                defaultValue={episode?.number ?? ""}
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
