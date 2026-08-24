import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh-CN", "ja", "ko"],
  // Visitors get their browser language (Accept-Language detection) when it
  // matches one of the locales above; anything else falls back to English.
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
