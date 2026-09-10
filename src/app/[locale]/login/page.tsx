import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/server/auth/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("loginTitle") };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (user) redirect({ href: "/", locale });

  // Only offer buttons for providers whose env keys are configured, matching
  // the providers actually enabled in src/auth.ts.
  const providers = {
    github: Boolean(
      process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ),
    google: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ),
  };

  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BrandLogo />
          wami-acg
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">{t("loginTitle")}</CardTitle>
            <CardDescription>{t("loginSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <LoginForm providers={providers} />
            <p className="text-center text-sm text-muted-foreground">
              {t("noAccount")}{" "}
              <Link
                href="/register"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("registerButton")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
