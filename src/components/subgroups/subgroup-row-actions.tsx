"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteSubgroupAction } from "@/server/subgroups/actions";
import type { Subgroup } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { SubgroupFormDialog } from "@/components/subgroups/subgroup-form-dialog";

export function SubgroupRowActions({ subgroup }: { subgroup: Subgroup }) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  return (
    <div className="flex items-center justify-end gap-1">
      <SubgroupFormDialog subgroup={subgroup} />

      <form
        action={deleteSubgroupAction}
        onSubmit={(e) => {
          if (!confirm(t("subgroupDeleteConfirm"))) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={subgroup.id} />
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
    </div>
  );
}
