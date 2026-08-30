import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Magnet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { RegisterForm } from "@/components/auth/register-form";
import { getSessionUser } from "@/server/auth/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("registerTitle") };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (user) redirect(`/${locale}`);

  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Magnet className="size-4" />
          </span>
          acg-rss
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">{t("registerTitle")}</CardTitle>
            <CardDescription>{t("registerSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <RegisterForm />
            <p className="text-center text-sm text-muted-foreground">
              {t("hasAccount")}{" "}
              <Link
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("loginButton")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
