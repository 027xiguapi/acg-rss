import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Contact" };

/** Static contact page, linked from the shared footer. */
export default async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("emailLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href={`mailto:${t("email")}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:underline"
          >
            <Mail className="size-4" />
            {t("email")}
          </a>
          <p className="text-sm text-muted-foreground">{t("response")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
