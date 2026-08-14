"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, LogIn } from "lucide-react";
import { loginAction, type AuthState } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthState = {};

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = useActionState(
    loginAction,
    INITIAL
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="identity">{t("identity")}</Label>
        <Input
          id="identity"
          name="identity"
          required
          autoComplete="username"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? <Loader2 className="animate-spin" /> : <LogIn />}
        {t("loginButton")}
      </Button>
    </form>
  );
}
