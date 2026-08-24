"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import {
  createSubgroupAction,
  updateSubgroupAction,
  type SubgroupFormState,
} from "@/server/subgroups/actions";
import type { Subgroup } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/toast";

export function SubgroupFormDialog({ subgroup }: { subgroup?: Subgroup }) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);

  const action = subgroup ? updateSubgroupAction : createSubgroupAction;

  async function actionWithSideEffects(
    prev: SubgroupFormState,
    fd: FormData
  ): Promise<SubgroupFormState> {
    const result = await action(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast(tCommon("saved"), "success");
    } else if (result.error === "duplicate") {
      toast(t("subgroupDuplicate"), "error");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<
    SubgroupFormState,
    FormData
  >(actionWithSideEffects, {});

  return (
    <>
      {subgroup ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={tCommon("edit")}
          title={tCommon("edit")}
          onClick={() => setOpen(true)}
        >
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          {t("addSubgroup")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{subgroup ? t("editSubgroup") : t("newSubgroup")}</DialogTitle>
          <DialogDescription>{t("subgroupFormDescription")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={subgroup?.id ?? ""} />

            {state.error && state.error !== "duplicate" ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tCommon("error")}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="subgroup-name">{tCommon("name")}</Label>
              <Input
                id="subgroup-name"
                name="name"
                required
                maxLength={128}
                defaultValue={subgroup?.name}
                placeholder={t("subgroupNamePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="subgroup-category">{t("subgroupCategory")}</Label>
              <Input
                id="subgroup-category"
                name="category"
                maxLength={64}
                defaultValue={subgroup?.category ?? ""}
                placeholder={t("subgroupCategoryPlaceholder")}
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
