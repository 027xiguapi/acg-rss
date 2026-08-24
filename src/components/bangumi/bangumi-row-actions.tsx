"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteBangumiAction } from "@/server/bangumi/actions";
import { Button } from "@/components/ui/button";

export function DeleteBangumiButton({ bangumiId }: { bangumiId: number }) {
  const tCommon = useTranslations("common");
  const t = useTranslations("bangumi");

  return (
    <form
      action={deleteBangumiAction}
      onSubmit={(e) => {
        if (!confirm(t("deleteConfirm"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={bangumiId} />
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
