/**
 * Canonical site origin used for absolute SEO URLs (sitemap, robots,
 * canonical/OpenGraph metadata). Override per environment with
 * NEXT_PUBLIC_SITE_URL; the fallback is the production origin.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://acg.routerpark.com"
).replace(/\/+$/, "");

/** Join a pathname onto the canonical origin, e.g. "/zh-CN/torrents". */
export function absoluteUrl(pathname = ""): string {
  if (!pathname || pathname === "/") return SITE_URL;
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
