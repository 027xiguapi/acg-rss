import type { Metadata } from "next";
import { and, desc, eq, inArray, max } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, Tv } from "lucide-react";
import { db } from "@/db";
import {
  bangumi,
  bangumiEpisodes,
  bangumiFavorites,
  bangumiInfos,
  users,
} from "@/db/schema";
import type { BangumiCardData } from "@/server/bangumi/queries";
import { formatDateTime } from "@/lib/format";
import { getSessionUser } from "@/server/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { BangumiCardGrid } from "@/components/home/bangumi-card-grid";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** Display name for a user row: OAuth name first, local username as fallback. */
function displayName(user: {
  name: string | null;
  username: string | null;
  email: string | null;
}): string {
  return user.name ?? user.username ?? user.email ?? "";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) return { title: "User" };
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return { title: user ? displayName(user) : "User" };
}

/**
 * Public user page, addressed by URL id: the user's account info and the
 * series they have subscribed to (favorited), newest subscription first.
 * The email is shown only to the account owner.
 */
export default async function UserPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) notFound();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) notFound();

  const viewer = await getSessionUser();
  const t = await getTranslations("profile");
  const isSelf = viewer?.id === userId;

  const favoriteRows = await db
    .select({ bangumiId: bangumiFavorites.bangumiId })
    .from(bangumiFavorites)
    .where(eq(bangumiFavorites.userId, userId))
    .orderBy(desc(bangumiFavorites.createdAt));

  const ids = favoriteRows.map((r) => r.bangumiId);
  const [rows, episodeStats, titleRows] = ids.length
    ? await Promise.all([
        db.select().from(bangumi).where(inArray(bangumi.id, ids)),
        db
          .select({
            bangumiId: bangumiEpisodes.bangumiId,
            latest: max(bangumiEpisodes.number),
          })
          .from(bangumiEpisodes)
          .where(inArray(bangumiEpisodes.bangumiId, ids))
          .groupBy(bangumiEpisodes.bangumiId),
        db
          .select({ bangumiId: bangumiInfos.bangumiId, title: bangumiInfos.title })
          .from(bangumiInfos)
          .where(
            and(
              inArray(bangumiInfos.bangumiId, ids),
              eq(bangumiInfos.kind, "primary")
            )
          ),
      ])
    : [[], [], []];

  const titleMap = new Map(titleRows.map((r) => [r.bangumiId, r.title]));
  const latestMap = new Map(episodeStats.map((s) => [s.bangumiId, s.latest]));
  const bangumiMap = new Map(rows.map((r) => [r.id, r]));

  const entries: BangumiCardData[] = favoriteRows
    .map((f) => {
      const item = bangumiMap.get(f.bangumiId);
      if (!item) return null;
      return {
        item: { ...item, title: titleMap.get(f.bangumiId) ?? "" },
        latest: latestMap.get(f.bangumiId) ?? null,
        coverName: titleMap.get(f.bangumiId) ?? null,
      };
    })
    .filter((e): e is BangumiCardData => e != null);

  const name = displayName(user);
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          {user.image ? (
            <Image
              src={user.image}
              alt={name}
              width={64}
              height={64}
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-full bg-secondary text-xl font-semibold uppercase text-secondary-foreground">
              {initial}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight">{name}</h1>
            {user.username ? (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            ) : null}
            {isSelf && user.email ? (
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-1">
            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
              {user.role === "admin" ? t("roleAdmin") : t("roleUser")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t("joined")} {formatDateTime(user.createdAt, locale)}
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Star className="size-4" />
          {t("favorites")}
          <span className="text-sm font-normal text-muted-foreground">
            {entries.length}
          </span>
        </h2>
        {entries.length > 0 ? (
          <BangumiCardGrid entries={entries} />
        ) : (
          <EmptyState
            icon={<Tv className="size-5" />}
            title={t("favoritesEmpty")}
            action={
              isSelf ? (
                <Link href="/" className={cn(buttonVariants({ size: "sm" }))}>
                  {t("browse")}
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}
