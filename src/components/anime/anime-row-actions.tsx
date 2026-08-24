"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteAnimeAction } from "@/server/anime/actions";
import { Button } from "@/components/ui/button";

export function DeleteAnimeButton({ animeId }: { animeId: number }) {
  const tCommon = useTranslations("common");
  const t = useTranslations("anime");

  return (
    <form
      action={deleteAnimeAction}
      onSubmit={(e) => {
        if (!confirm(t("deleteConfirm"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={animeId} />
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
