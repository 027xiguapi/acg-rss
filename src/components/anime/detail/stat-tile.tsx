import type { ReactNode } from "react";

export function StatTile({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border bg-card px-1 py-2.5">
      <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span className="text-sm font-semibold leading-none">{value}</span>
      <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
    </div>
  );
}
