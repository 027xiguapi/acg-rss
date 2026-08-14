"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Loader2, Plus } from "lucide-react";
import {
  createTokenAction,
  type CreateTokenState,
} from "@/server/tokens/actions";
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

export function TokenCreator() {
  const t = useTranslations("settings.tokens");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = useActionState<CreateTokenState, FormData>(
    createTokenAction,
    {}
  );

  const token = state.ok ? state.token : null;

  async function copyToken() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast(tCommon("copied"), "success");
    } catch {
      toast(tCommon("error"), "error");
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {t("create")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{token ? tCommon("copyOnce") : t("create")}</DialogTitle>
          <DialogDescription>
            {token ? t("copyOnce") : t("subtitle")}
          </DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          {token ? (
            <div className="flex flex-col gap-3">
              <code className="block break-all rounded-md bg-muted px-3 py-2.5 font-mono text-sm">
                {token}
              </code>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={copyToken}>
                  <Copy />
                  {tCommon("copy")}
                </Button>
                <Button onClick={() => setOpen(false)}>
                  {tCommon("close")}
                </Button>
              </div>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              {state.error ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {tCommon("error")}
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label htmlFor="token-name">{t("name")}</Label>
                <Input
                  id="token-name"
                  name="name"
                  required
                  maxLength={128}
                  placeholder={t("namePlaceholder")}
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
                  {tCommon("create")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
