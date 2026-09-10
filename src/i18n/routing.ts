import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh-CN", "ja", "ko"],
  // Visitors get their browser language (Accept-Language detection) when it
  // matches one of the locales above; anything else falls back to English.
  defaultLocale: "en",
  // The default locale is served unprefixed ("/" rather than "/en"); other
  // locales keep their prefix ("/zh-CN", "/ja", "/ko"). Prefixed default-locale
  // URLs like "/en" are redirected to the unprefixed form.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
