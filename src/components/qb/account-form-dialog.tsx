"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, PlugZap, Plus } from "lucide-react";
import {
  saveAccountAction,
  testConnectionAction,
  type AccountFormState,
  type TestConnectionState,
} from "@/server/qbittorrent/actions";
import type { QbittorrentAccount } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/toast";

export function AccountFormDialog({ account }: { account?: QbittorrentAccount }) {
  const t = useTranslations("settings.accounts");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [enabled, setEnabled] = React.useState(account?.enabled ?? true);
  // Wrap the server action so success side-effects run inside the action
  // itself (no state-sync effect needed)
  async function actionWithSideEffects(
    prev: AccountFormState,
    fd: FormData
  ): Promise<AccountFormState> {
    const result = await saveAccountAction(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast(tCommon("saved"), "success");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<AccountFormState, FormData>(
    actionWithSideEffects,
    {}
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestConnectionState | null>(
    null
  );

  async function runTest() {
    const form = formRef.current;
    if (!form) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnectionAction({}, new FormData(form));
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      {account ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={tCommon("edit")}
          onClick={() => setOpen(true)}
        >
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          {t("add")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>
            {account ? t("edit") : t("new")}
          </DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form ref={formRef} action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={account?.id ?? ""} />

            {state.error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error === "invalidUrl"
                  ? tCommon("error")
                  : t("testFailed", { message: state.error })}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="qb-name">{t("name")}</Label>
              <Input
                id="qb-name"
                name="name"
                required
                maxLength={128}
                defaultValue={account?.name}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="qb-url">{t("url")}</Label>
              <Input
                id="qb-url"
                name="url"
                type="url"
                required
                defaultValue={account?.url}
                placeholder={t("urlPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="qb-username">{t("username")}</Label>
                <Input
                  id="qb-username"
                  name="username"
                  required
                  maxLength={128}
                  defaultValue={account?.username}
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="qb-password">{t("password")}</Label>
                <Input
                  id="qb-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={account ? "••••••" : undefined}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="qb-category">
                {t("defaultCategory")}{" "}
                <span className="font-normal text-muted-foreground">
                  ({tCommon("optional")})
                </span>
              </Label>
              <Input
                id="qb-category"
                name="defaultCategory"
                maxLength={128}
                defaultValue={account?.defaultCategory ?? ""}
                placeholder={t("defaultCategoryPlaceholder")}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="qb-enabled">{tCommon("enabled")}</Label>
              <Switch
                id="qb-enabled"
                name="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            {testResult ? (
              <p
                className={
                  testResult.ok
                    ? "rounded-md bg-success/10 px-3 py-2 text-sm text-success"
                    : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                }
              >
                {testResult.ok
                  ? t("testOk", { version: testResult.version ?? "?" })
                  : t("testFailed", { message: testResult.error ?? "" })}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={testing}
                onClick={runTest}
              >
                {testing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <PlugZap />
                )}
                {testing ? t("testing") : t("testConnection")}
              </Button>
              <div className="flex gap-2">
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
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
