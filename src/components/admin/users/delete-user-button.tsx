"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteUserAction } from "@/server/users/actions";
import { Button } from "@/components/ui/button";

/** Delete button with a confirm dialog; disabled rows are still rendered by
 *  the server page so this never fires for the current admin or the last
 *  admin (the action re-checks both). */
export function DeleteUserButton({
  userId,
  disabled,
}: {
  userId: number;
  disabled?: boolean;
}) {
  const tCommon = useTranslations("common");
  const t = useTranslations("admin");

  if (disabled) {
    return (
      <span className="inline-flex size-9 items-center justify-center opacity-30">
        <Trash2 className="size-4" />
      </span>
    );
  }

  return (
    <form
      action={deleteUserAction}
      onSubmit={(e) => {
        if (!confirm(t("users.deleteConfirm"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={userId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={tCommon("delete")}
        title={tCommon("delete")}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </form>
  );
}
