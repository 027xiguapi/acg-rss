import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Privacy" };

const SECTIONS = ["data", "use", "storage", "cookies", "contact"] as const;

/** Static privacy policy, linked from the shared footer. */
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("updated")}</p>
      </div>

      <div className="space-y-4">
        {SECTIONS.map((id) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle>{t(`sections.${id}.heading`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t(`sections.${id}.body`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
