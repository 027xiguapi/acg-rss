import { AppHeader } from "@/components/app-header";
import { AppMain } from "@/components/app-main";
import { AppFooter } from "@/components/app-footer";

/**
 * Full-page shell for public pages: sticky header plus the flex column's
 * content area. Composed from AppHeader and AppMain, which pages can also
 * use individually when they need a different layout.
 */
export function AppShell({
  username,
  userId,
  children,
}: {
  username: string | null;
  userId: number | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader username={username} userId={userId} />
      <AppMain>{children}</AppMain>
      <AppFooter />
    </div>
  );
}
