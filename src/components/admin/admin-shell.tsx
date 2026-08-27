"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Languages, Rss, Shield, Tv, UserCog, Users } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/server/auth/actions";

/** Admin section switcher: bangumi / contents / feeds / subgroups / users. */
const ADMIN_NAV = [
  { href: "/admin/bangumi", icon: Tv, key: "bangumi" },
  { href: "/admin/contents", icon: Languages, key: "contents" },
  { href: "/admin/feeds", icon: Rss, key: "feeds" },
  { href: "/admin/subgroups", icon: Users, key: "subgroups" },
  { href: "/admin/users", icon: UserCog, key: "users" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Chrome shared by every /admin page: sticky header with brand, an admin
 * badge and utilities (locale / theme / logout), a horizontal section-nav
 * for switching between management pages, and a centered 1200px content
 * column. Episode detail pages keep the nav of their parent highlighted.
 */
export function AdminShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("admin");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-[1200px] px-4">
          <div className="flex h-14 items-center gap-3">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 font-semibold transition-colors hover:text-primary"
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Shield className="size-4" />
              </span>
              <span className="hidden sm:inline">{tCommon("appName")}</span>
            </Link>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {t("panel")}
            </span>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 sm:flex">
                <LocaleSwitcher />
                <ThemeToggle />
              </div>
              <span
                className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground"
                title={username}
              >
                {username.slice(0, 1)}
              </span>
              <Link
                href="/"
                className="hidden items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
              >
                <ExternalLink className="size-4" />
                {tNav("backToSite")}
              </Link>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  {tNav("logout")}
                </Button>
              </form>
            </div>
          </div>

          <nav className="-mx-1 flex items-center gap-1 overflow-x-auto pb-2">
            {ADMIN_NAV.map(({ href, icon: Icon, key }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(pathname, href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {t(`nav.${key}`)}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
