import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Globe, Magnet, RefreshCcw, Rss, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/server/auth/session";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (user) {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");

  const features = [
    { icon: Rss, title: t("feature1Title"), desc: t("feature1Desc") },
    { icon: Sparkles, title: t("feature2Title"), desc: t("feature2Desc") },
    { icon: RefreshCcw, title: t("feature3Title"), desc: t("feature3Desc") },
    { icon: Globe, title: t("feature4Title"), desc: t("feature4Desc") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Magnet className="size-4" />
            </span>
            {tCommon("appName")}
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
            >
              {tNav("login")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center py-20 text-center sm:py-28">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            {t("hero")}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {t("cta")}
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
            >
              {t("login")}
            </Link>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 pb-20 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-lg border bg-card p-6 text-left shadow-sm"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        {tCommon("appName")} · {tCommon("tagline")}
      </footer>
    </div>
  );
}
