"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FileUp, Loader2 } from "lucide-react";
import {
  importRssXmlAction,
  type RssImportState,
} from "@/server/rss/import-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/toast";

/** Error code from importRssXmlAction → message key suffix */
function errorCode(state: RssImportState): string | null {
  if (!state.error || state.error === "notAuthenticated") return null;
  if (state.error === "noItems" || state.error === "noSeries") return state.error;
  return "parse";
}

/** Admin dialog: paste a Mikan-style RSS/XML document and batch-import it
 *  into bangumi / episodes / torrents (deduplicated, safe to re-run). */
export function RssXmlImportDialog() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);

  async function actionWithSideEffects(
    prev: RssImportState,
    fd: FormData
  ): Promise<RssImportState> {
    const result = await importRssXmlAction(prev, fd);
    if (result.ok && result.summary) {
      setOpen(false);
      toast(
        t("importXmlSuccess", {
          series: result.summary.series,
          created: result.summary.created,
          skipped: result.summary.skipped,
        }),
        "success"
      );
      if (result.summary.feedSubscribed) toast(t("importXmlSubscribed"), "success");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<
    RssImportState,
    FormData
  >(actionWithSideEffects, {});
  const errorKey = errorCode(state);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileUp />
        {t("importXml")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{t("importXmlTitle")}</DialogTitle>
          <DialogDescription>{t("importXmlDescription")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            {errorKey ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t(`importXmlError_${errorKey}`)}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="rss-xml">{t("importXmlLabel")}</Label>
              <Textarea
                id="rss-xml"
                name="xml"
                required
                rows={14}
                spellCheck={false}
                placeholder={t("importXmlPlaceholder")}
                className="font-mono text-xs"
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
                {isPending ? <Loader2 className="animate-spin" /> : <FileUp />}
                {t("importXmlSubmit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
