"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Trash2, Zap, PowerOff } from "lucide-react";
import { deleteRuleAction, toggleRuleAction } from "@/server/rules/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

export function RuleRowActions({
  ruleId,
  enabled,
}: {
  ruleId: number;
  enabled: boolean;
}) {
  const t = useTranslations("rules");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", String(ruleId));
      await deleteRuleAction(fd);
      toast(tCommon("deleted"), "success");
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <form action={toggleRuleAction}>
        <input type="hidden" name="id" value={ruleId} />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label={enabled ? tCommon("disable") : tCommon("enable")}
          title={enabled ? tCommon("disable") : tCommon("enable")}
        >
          {enabled ? <Zap /> : <PowerOff />}
        </Button>
      </form>
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
    </div>
  );
}
