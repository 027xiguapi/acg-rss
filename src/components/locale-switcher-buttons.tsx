"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Short button labels per locale, used in the footer switcher. */
const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  "zh-CN": "中文",
  ja: "日本語",
  ko: "한국어",
};

/**
 * Button-style locale switcher: one button per locale, the active locale
 * highlighted. Used in the footer (the header keeps the dropdown variant).
 */
export function LocaleSwitcherButtons() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();

  function onClick(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label={t("language")}
    >
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            disabled={isPending}
            onClick={() => onClick(l)}
            aria-current={active ? "true" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-7 px-2 text-xs",
              active && "bg-secondary font-semibold text-secondary-foreground"
            )}
          >
            {LOCALE_SHORT_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
