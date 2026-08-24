import Image from "next/image";
import { Tv } from "lucide-react";
import { posterTint } from "@/lib/poster";
import { cn } from "@/lib/utils";

/**
 * Poster with the title overlaid at the bottom. Renders the cover image
 * when one is set, otherwise a deterministic gradient placeholder.
 * `compact` renders the small variant used in the related grid.
 */
export function BangumiPoster({
  title,
  coverUrl,
  compact = false,
  className,
}: {
  title: string;
  coverUrl?: string | null;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[2/3] overflow-hidden shadow-sm",
        compact ? "rounded-md" : "rounded-lg",
        coverUrl ? "bg-muted" : cn("bg-gradient-to-br", posterTint(title)),
        className
      )}
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={title}
          fill
          sizes={
            compact
              ? "(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 80px"
              : "(max-width: 1024px) 100vw, 280px"
          }
          className="object-cover"
        />
      ) : (
        <Tv
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20",
            compact ? "size-8" : "size-20"
          )}
        />
      )}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent",
          compact ? "p-1.5 pt-8" : "p-3 pt-12"
        )}
      >
        <p
          className={cn(
            "text-white",
            compact
              ? "line-clamp-2 text-[11px] font-medium leading-snug"
              : "line-clamp-3 text-sm font-semibold leading-snug"
          )}
        >
          {title}
        </p>
      </div>
    </div>
  );
}
