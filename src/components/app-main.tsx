/**
 * Content column for public pages: a flex-1 <main> with a centered
 * max-width wrapper. Split out of AppShell so pages can render it
 * independently of the header.
 */
export function AppMain({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}
