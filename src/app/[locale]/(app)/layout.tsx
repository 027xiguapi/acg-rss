import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/server/auth/session";

/**
 * Shell for all public pages: fixed sidebar (nav / account / theme) and a
 * centered max-width content column.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <AppShell username={user?.username ?? null}>{children}</AppShell>
  );
}
