"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import {
  saveBangumiAction,
  type BangumiFormState,
} from "@/server/bangumi/actions";
import type { BangumiWithTitle } from "@/db/schema";
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

const WATCH_STATUSES = [
  "WATCHING",
  "PLANNED",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
] as const;

const BANGUMI_ORIGINS = [
  "JP",
  "CN",
  "HK",
  "TW",
  "KR",
  "WEST",
  "OTHER",
] as const;

/** Weekly air day options, ISO weekday: 1=Mon … 7=Sun */
const AIR_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

const BANGUMI_TYPES = [
  "TV",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "OTHER",
] as const;

export function BangumiFormDialog({
  bangumi,
  initialNames = [],
}: {
  bangumi?: BangumiWithTitle;
  /** Existing synonym names, each formatted as `title` or `title | lang` */
  initialNames?: string[];
}) {
  const t = useTranslations("bangumi");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);

  async function actionWithSideEffects(
    prev: BangumiFormState,
    fd: FormData
  ): Promise<BangumiFormState> {
    const result = await saveBangumiAction(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast(tCommon("saved"), "success");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<BangumiFormState, FormData>(
    actionWithSideEffects,
    {}
  );

  return (
    <>
      {bangumi ? (
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
          <DialogTitle>{bangumi ? t("editBangumi") : t("newBangumi")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={bangumi?.id ?? ""} />

            {state.error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tCommon("error")}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="bangumi-title">{t("bangumiTitle")}</Label>
              <Input
                id="bangumi-title"
                name="title"
                required
                maxLength={255}
                defaultValue={bangumi?.title}
                placeholder={t("bangumiTitlePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bangumi-names">{t("names")}</Label>
              <textarea
                id="bangumi-names"
                name="names"
                rows={4}
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue={initialNames.join("\n")}
                placeholder={t("namesPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("namesHint")}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bangumi-cover">{t("coverUrl")}</Label>
              <Input
                id="bangumi-cover"
                name="coverUrl"
                type="url"
                maxLength={2048}
                defaultValue={bangumi?.coverUrl ?? ""}
                placeholder={t("coverUrlPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("coverUrlHint")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bangumi-season">{t("season")}</Label>
                <Input
                  id="bangumi-season"
                  name="season"
                  type="number"
                  min={1}
                  defaultValue={bangumi?.season ?? 1}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bangumi-year">{t("year")}</Label>
                <Input
                  id="bangumi-year"
                  name="year"
                  type="number"
                  min={1960}
                  max={2100}
                  defaultValue={bangumi?.year ?? ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bangumi-origin">{t("origin")}</Label>
                <Select
                  id="bangumi-origin"
                  name="origin"
                  defaultValue={bangumi?.origin ?? ""}
                >
                  <option value="">{t("unspecified")}</option>
                  {BANGUMI_ORIGINS.map((origin) => (
                    <option key={origin} value={origin}>
                      {t(`origins.${origin}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bangumi-air-day">{t("airDay")}</Label>
                <Select
                  id="bangumi-air-day"
                  name="airDay"
                  defaultValue={bangumi?.airDay ?? ""}
                >
                  <option value="">{t("unspecified")}</option>
                  {AIR_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {t(`weekdays.${day}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bangumi-type">{tCommon("type")}</Label>
                <Select
                  id="bangumi-type"
                  name="type"
                  defaultValue={bangumi?.type ?? ""}
                >
                  <option value="">{t("unspecified")}</option>
                  {BANGUMI_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bangumi-status">{t("watchStatus")}</Label>
                <Select
                  id="bangumi-status"
                  name="watchStatus"
                  defaultValue={bangumi?.watchStatus ?? "WATCHING"}
                >
                  {WATCH_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`status.${status}`)}
                    </option>
                  ))}
                </Select>
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
