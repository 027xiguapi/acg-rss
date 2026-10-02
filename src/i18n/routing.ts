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
  // The middleware's automatic hreflang Link headers build URLs from the
  // proxied request and end up as "https://acg.routerpark.com:80/..." behind
  // Cloudflare, which breaks alternate-URL resolution. hreflang is instead
  // emitted correctly from the sitemap and per-page `alternates` metadata.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
