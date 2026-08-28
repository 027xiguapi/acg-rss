"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteEpisodeAction } from "@/server/bangumi/actions";
import { Button } from "@/components/ui/button";

export function DeleteEpisodeButton({ episodeId }: { episodeId: number }) {
  const tCommon = useTranslations("common");
  const t = useTranslations("admin");

  return (
    <form
      action={deleteEpisodeAction}
      onSubmit={(e) => {
        if (!confirm(t("episodeDeleteConfirm"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={episodeId} />
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
  );
}
