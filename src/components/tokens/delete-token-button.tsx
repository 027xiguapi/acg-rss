"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteTokenAction } from "@/server/tokens/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

export function DeleteTokenButton({ tokenId }: { tokenId: number }) {
  const t = useTranslations("settings.tokens");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", String(tokenId));
      await deleteTokenAction(fd);
      toast(tCommon("deleted"), "success");
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={tCommon("delete")}
      title={tCommon("delete")}
      disabled={pending}
      onClick={remove}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 />
    </Button>
  );
}
