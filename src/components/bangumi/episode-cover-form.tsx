"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  saveEpisodeAction,
  type EpisodeFormState,
} from "@/server/bangumi/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast";

export function EpisodeCoverForm({
  episodeId,
  coverUrl,
}: {
  episodeId: number;
  coverUrl: string | null;
}) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const toast = useToast();

  async function actionWithSideEffects(
    prev: EpisodeFormState,
    fd: FormData
  ): Promise<EpisodeFormState> {
    const result = await saveEpisodeAction(prev, fd);
    if (result.ok) toast(tCommon("saved"), "success");
    return result;
  }

  const [state, formAction, isPending] = useActionState<EpisodeFormState, FormData>(
    actionWithSideEffects,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={episodeId} />

      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {tCommon("error")}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="episode-cover">{t("coverUrl")}</Label>
        <Input
          id="episode-cover"
          name="coverUrl"
          type="url"
          maxLength={2048}
          defaultValue={coverUrl ?? ""}
          placeholder={t("coverUrlPlaceholder")}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
