"use client";

import * as React from "react";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Plus, X } from "lucide-react";
import {
  saveEpisodeInfosAction,
  type EpisodeInfosState,
} from "@/server/anime/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast";
import { routing } from "@/i18n/routing";

/** Languages offered for new rows = the UI locales, so public rendering can
 *  match the visitor's locale exactly. Existing rows keep whatever tag is
 *  stored. */
const LANG_OPTIONS = routing.locales as readonly string[];

/**
 * Edit the per-language info (title + synopsis) of one episode: a title
 * input and synopsis textarea per language, quick-add buttons for the
 * remaining UI locales, and a remove button per row. Saving syncs the whole
 * set (rows with both fields empty are dropped).
 */
export function EpisodeInfosEditor({
  episodeId,
  initialRows,
}: {
  episodeId: number;
  initialRows: { lang: string; title: string | null; content: string | null }[];
}) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();

  const [rows, setRows] = React.useState(initialRows);

  const remaining = LANG_OPTIONS.filter(
    (lang) => !rows.some((row) => row.lang === lang)
  );

  /** Human label for a language tag in the current UI language. */
  const label = (tag: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "language" }).of(tag) ?? tag;
    } catch {
      return tag;
    }
  };

  async function actionWithSideEffects(
    prev: EpisodeInfosState,
    fd: FormData
  ): Promise<EpisodeInfosState> {
    const result = await saveEpisodeInfosAction(prev, fd);
    if (result.ok) toast(tCommon("saved"), "success");
    return result;
  }

  const [state, formAction, isPending] = useActionState<EpisodeInfosState, FormData>(
    actionWithSideEffects,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="episodeId" value={episodeId} />

      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {tCommon("error")}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noLanguages")}</p>
      ) : null}

      {rows.map((row) => (
        <div key={row.lang} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`title-${episodeId}-${row.lang}`}>
              {label(row.lang)}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {row.lang}
              </span>
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeLanguage")}
              title={t("removeLanguage")}
              onClick={() => setRows((prev) => prev.filter((r) => r.lang !== row.lang))}
            >
              <X className="size-4" />
            </Button>
          </div>
          <input type="hidden" name="lang" value={row.lang} />
          <Input
            id={`title-${episodeId}-${row.lang}`}
            name="title"
            maxLength={255}
            defaultValue={row.title ?? ""}
            placeholder={t("titlePlaceholder")}
          />
          <Textarea
            id={`content-${episodeId}-${row.lang}`}
            name="content"
            rows={4}
            maxLength={10_000}
            defaultValue={row.content ?? ""}
            placeholder={t("contentPlaceholder")}
          />
        </div>
      ))}

      {remaining.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {remaining.map((lang) => (
            <Button
              key={lang}
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRows((prev) => [...prev, { lang, title: null, content: null }])
              }
            >
              <Plus className="size-3.5" />
              {label(lang)}
            </Button>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">{t("contentEmptyHint")}</p>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
