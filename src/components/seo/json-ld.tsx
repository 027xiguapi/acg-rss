import { absoluteUrl } from "@/lib/site";

/**
 * Inline JSON-LD structured data (schema.org). Rendered in the page stream so
 * crawlers pick it up without a metadata API round-trip.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** BreadcrumbList schema for a page at `path` under the site root. */
export function breadcrumbJsonLd(
  crumbs: { name: string; path?: string }[]
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      // The final crumb has no path (it is the current page).
      ...(crumb.path ? { item: absoluteUrl(crumb.path) } : {}),
    })),
  };
}
