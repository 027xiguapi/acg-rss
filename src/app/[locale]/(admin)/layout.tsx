import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getAdminUser } from "@/server/auth/session";

/** Admin guard shared by all management pages under /admin. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();
  if (!user) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
    return null;
  }

  return <>{children}</>;
}
