import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { absoluteUrl } from "@/lib/site";

/** Map a locale code to the OpenGraph locale string (e.g. zh-CN → zh_CN). */
export function ogLocale(locale: string): string {
  return locale.replace("-", "_");
}

/** Absolute URL of a locale-agnostic path in the given locale. */
export function localePathUrl(path: string, locale: string): string {
  return absoluteUrl(getPathname({ href: path || "/", locale }));
}

/**
 * `alternates.languages` map for a path: every locale plus x-default, for
 * the `<link rel="alternate" hreflang>` tags and self-referencing canonicals.
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = localePathUrl(path, locale);
  }
  languages["x-default"] = localePathUrl(path, routing.defaultLocale);
  return languages;
}

/**
 * Collapse arbitrary text into a meta-description-sized string: first
 * paragraph, whitespace normalized, hard-truncated at `max` characters.
 */
export function metaDescription(
  text: string | null | undefined,
  fallback: string,
  max = 160
): string {
  const cleaned = text
    ?.split(/\n{2,}/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1).trimEnd()}…`;
}
