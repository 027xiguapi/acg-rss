import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/server/auth/session";

/** Auth guard + application shell shared by all signed-in pages. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
    return null;
  }

  return <AppShell username={user.username}>{children}</AppShell>;
}
