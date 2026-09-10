import { SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * robots.txt. Served from a route handler rather than the typed
 * `MetadataRoute.Robots` API so it can carry the LLM-discovery comments
 * below, which that API has no field for.
 */
export function GET(): Response {
  const body = [
    "# robots.txt — wami-acg",
    "",
    "# LLM-friendly documentation (llmstxt.org convention), plain markdown:",
    `#   Index:        ${absoluteUrl("/llms.txt")}`,
    `#   Full content: ${absoluteUrl("/llms-full.txt")}`,
    "# Crawling both is welcome.",
    "",
    "User-Agent: *",
    "Allow: /",
    "# The admin area, account pages and JSON endpoints have no crawl value.",
    "Disallow: /api/",
    "Disallow: /admin/",
    "Disallow: /*/admin/",
    "Disallow: /login",
    "Disallow: /*/login",
    "Disallow: /register",
    "Disallow: /*/register",
    "",
    `Host: ${SITE_URL}`,
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
