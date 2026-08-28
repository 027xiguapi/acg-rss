import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
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
 * Prev / numbered / next pager for an admin list. Links preserve the given
 * query params (e.g. the search term) and only appear once the list spans
 * more than one page.
 */
export async function Pagination({
  basePath,
  page,
  totalPages,
  params,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  /** Extra query params carried over to every page link. */
  params?: Record<string, string>;
}) {
  const tCommon = await getTranslations("common");
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const search = new URLSearchParams(params ?? {});
    search.set("page", String(p));
    return `${basePath}?${search.toString()}`;
  };

  return (
    <nav
      className="flex items-center justify-end gap-1"
      aria-label={tCommon("pagination")}
    >
      <Link
        href={href(Math.max(1, page - 1))}
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
          href={href(n)}
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
        href={href(Math.min(totalPages, page + 1))}
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
    </nav>
  );
}
