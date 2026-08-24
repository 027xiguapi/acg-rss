import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="breadcrumb" className={cn("text-sm text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-50" /> : null}
            {item.href ? (
              <Link
                href={item.href}
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground" title={item.label}>
                {item.label.length > 40 ? `${item.label.slice(0, 40)}…` : item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
