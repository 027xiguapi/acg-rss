import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getAdminUser } from "@/server/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";

/** Admin guard + shared chrome for all management pages under /admin. */
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

  return (
    <AdminShell username={user.name ?? user.username ?? "?"}>
      {children}
    </AdminShell>
  );
}
