import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcherButtons } from "@/components/locale-switcher-buttons";

/**
 * Shared footer for public pages: copyright line plus legal/contact links.
 * Rendered by AppShell below the content column, so every page under the
 * (app) layout inherits it.
 */
export async function AppFooter() {
  const t = await getTranslations("footer");
  const tCommon = await getTranslations("common");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 sm:px-6 lg:px-8">
        <LocaleSwitcherButtons />
        <div className="flex w-full flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {t("copyright", { year, name: tCommon("appName") })}
          </p>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              {t("privacy")}
            </Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">
              {t("contact")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
