"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Star, ThumbsUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { SocialKind } from "@/server/anime/social";
import {
  toggleFavoriteAction,
  toggleLikeAction,
} from "@/server/anime/social-actions";

/** Favorite / like toggle buttons with live counts, shown on the detail pages.
 *  Anonymous visitors get login links instead of toggles. */
export function SocialBar({
  kind,
  targetId,
  favoriteCount,
  likeCount,
  favorited,
  liked,
  authenticated,
}: {
  kind: SocialKind;
  targetId: number;
  favoriteCount: number;
  likeCount: number;
  favorited: boolean;
  liked: boolean;
  authenticated: boolean;
}) {
  const t = useTranslations("anime");
  const [pending, startTransition] = useTransition();

  const trigger = (action: (kind: SocialKind, id: number) => Promise<void>) =>
    startTransition(() => {
      void action(kind, targetId);
    });

  const buttonBase =
    "gap-1.5 disabled:pointer-events-none disabled:opacity-60";

  if (!authenticated) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }), buttonBase)}
        >
          <Star />
          {t("favorite")} · {favoriteCount}
        </Link>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }), buttonBase)}
        >
          <ThumbsUp />
          {t("like")} · {likeCount}
        </Link>
        <p className="text-xs text-muted-foreground">{t("loginToInteract")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => trigger(toggleFavoriteAction)}
        className={cn(buttonVariants({ variant: "outline" }), buttonBase)}
        aria-pressed={favorited}
      >
        <Star className={cn(favorited && "fill-current text-primary")} />
        {favorited ? t("favorited") : t("favorite")} · {favoriteCount}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => trigger(toggleLikeAction)}
        className={cn(buttonVariants({ variant: "outline" }), buttonBase)}
        aria-pressed={liked}
      >
        <ThumbsUp className={cn(liked && "fill-current text-primary")} />
        {liked ? t("liked") : t("like")} · {likeCount}
      </button>
    </div>
  );
}
