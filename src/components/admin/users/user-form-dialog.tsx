"use client";

import * as React from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, UserPlus } from "lucide-react";
import type { User } from "@/db/schema";
import {
  createUserAction,
  updateUserAction,
  type UserFormState,
} from "@/server/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/toast";

/** Error code from the actions → message key suffix under users.error_ */
function errorCode(state: UserFormState): string | null {
  if (!state.error || state.ok) return null;
  return state.error;
}

/** Create/edit dialog for one account: profile fields, role and an optional
 *  password reset (blank = keep the current password on edit). */
export function UserFormDialog({ user }: { user?: User }) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [open, setOpen] = React.useState(false);

  async function actionWithSideEffects(
    prev: UserFormState,
    fd: FormData
  ): Promise<UserFormState> {
    const result = await (user ? updateUserAction : createUserAction)(prev, fd);
    if (result.ok) {
      setOpen(false);
      toast(tCommon("saved"), "success");
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState<
    UserFormState,
    FormData
  >(actionWithSideEffects, {});
  const errorKey = errorCode(state);

  return (
    <>
      {user ? (
        <Button variant="ghost" size="icon" aria-label={tCommon("edit")} title={tCommon("edit")} onClick={() => setOpen(true)}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus />
          {t("users.addUser")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{user ? t("users.editUser") : t("users.addUser")}</DialogTitle>
          <DialogDescription>{t("users.formDescription")}</DialogDescription>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={user?.id ?? ""} />

            {errorKey ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t(`users.error_${errorKey}`)}
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="user-username">{t("users.username")}</Label>
                <Input
                  id="user-username"
                  name="username"
                  required
                  minLength={3}
                  maxLength={64}
                  pattern="[a-zA-Z0-9_]+"
                  defaultValue={user?.username ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="user-name">{t("users.displayName")}</Label>
                <Input
                  id="user-name"
                  name="name"
                  maxLength={255}
                  defaultValue={user?.name ?? ""}
                  placeholder={user?.username ?? ""}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="user-email">{t("users.email")}</Label>
              <Input
                id="user-email"
                name="email"
                type="email"
                required
                maxLength={255}
                defaultValue={user?.email ?? ""}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="user-role">{t("users.role")}</Label>
              <Select
                id="user-role"
                name="role"
                defaultValue={user?.role ?? "user"}
              >
                <option value="user">{t("users.roleUser")}</option>
                <option value="admin">{t("users.roleAdmin")}</option>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="user-password">
                {user ? t("users.resetPassword") : t("users.password")}
              </Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                required={!user}
                placeholder={user ? t("users.passwordKeepHint") : undefined}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
