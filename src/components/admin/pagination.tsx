import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PAGE_SIZES } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Number of page links rendered on each side of the current page. */
const SIBLINGS = 1;

function visiblePages(page: number, totalPages: number): number[] {
  const start = Math.max(1, page - SIBLINGS);
  const end = Math.min(totalPages, page + SIBLINGS);
  const pages: number[] = [];
  for (let n = start; n <= end; n++) pages.push(n);
  return pages;
}

/**
 * Prev / numbered / next pager for an admin list, with a rows-per-page
 * selector. Links preserve the given query params (e.g. the search term);
 * the page links only appear once the list spans more than one page.
 */
export async function Pagination({
  basePath,
  page,
  totalPages,
  params,
  pageSize,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  /** Extra query params carried over to every link. */
  params?: Record<string, string>;
  /** Current rows-per-page; renders the size selector when provided. */
  pageSize?: number;
}) {
  const tCommon = await getTranslations("common");
  if (totalPages <= 1 && pageSize == null) return null;

  const href = (overrides: Record<string, string>) => {
    const search = new URLSearchParams(params ?? {});
    if (pageSize != null) search.set("pageSize", String(pageSize));
    Object.assign(search, overrides);
    return `${basePath}?${search.toString()}`;
  };

  return (
    <nav
      className="flex flex-wrap items-center justify-end gap-1"
      aria-label={tCommon("pagination")}
    >
      {pageSize != null ? (
        <span className="mr-auto flex items-center gap-1 text-sm text-muted-foreground">
          {PAGE_SIZES.map((n) => (
            <Link
              key={n}
              href={href({ page: "1", pageSize: String(n) })}
              aria-current={n === pageSize ? "true" : undefined}
              className={cn(
                buttonVariants({
                  variant: n === pageSize ? "secondary" : "ghost",
                  size: "sm",
                }),
                "h-8 min-w-8 px-2"
              )}
            >
              {n}
            </Link>
          ))}
        </span>
      ) : null}

      {totalPages > 1 ? (
        <>
          <Link
            href={href({ page: String(Math.max(1, page - 1)) })}
            aria-disabled={page <= 1}
            title={tCommon("prevPage")}
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "h-8 w-8",
              page <= 1 && "pointer-events-none opacity-50"
            )}
          >
            <ChevronLeft />
          </Link>

          {visiblePages(page, totalPages).map((n) => (
            <Link
              key={n}
              href={href({ page: String(n) })}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                buttonVariants({
                  variant: n === page ? "default" : "outline",
                  size: "sm",
                }),
                "h-8 min-w-8 px-2"
              )}
            >
              {n}
            </Link>
          ))}

          <Link
            href={href({ page: String(Math.min(totalPages, page + 1)) })}
            aria-disabled={page >= totalPages}
            title={tCommon("nextPage")}
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "h-8 w-8",
              page >= totalPages && "pointer-events-none opacity-50"
            )}
          >
            <ChevronRight />
          </Link>
        </>
      ) : null}
    </nav>
  );
}
