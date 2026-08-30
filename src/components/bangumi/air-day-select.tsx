"use client";

import * as React from "react";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateBangumiAirDayAction } from "@/server/bangumi/actions";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/toast";

/** Weekly air day options, ISO weekday: 1=Mon … 7=Sun */
const AIR_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Inline dropdown on the admin table that saves a bangumi's air day on change. */
export function AirDaySelect({
  bangumiId,
  airDay,
}: {
  bangumiId: number;
  airDay: number | null;
}) {
  const t = useTranslations("bangumi");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const fd = new FormData();
    fd.set("id", String(bangumiId));
    fd.set("airDay", event.target.value);
    startTransition(async () => {
      try {
        await updateBangumiAirDayAction(fd);
        toast(tCommon("saved"), "success");
      } catch {
        toast(tCommon("error"), "error");
      }
    });
  }

  return (
    <Select
      aria-label={t("airDay")}
      value={airDay ?? ""}
      onChange={handleChange}
      disabled={pending}
      className="h-8 w-28 text-xs"
    >
      <option value="">{t("unspecified")}</option>
      {AIR_DAYS.map((day) => (
        <option key={day} value={day}>
          {t(`weekdays.${day}`)}
        </option>
      ))}
    </Select>
  );
}
