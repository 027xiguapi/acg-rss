import { Badge } from "@/components/ui/badge";

const VARIANT_BY_STATUS: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  COMPLETED: "success",
  DOWNLOADING: "default",
  PAUSED: "warning",
  ERROR: "destructive",
  QUEUED: "secondary",
};

/** Presentational badge — the label arrives pre-translated from the page. */
export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return <Badge variant={VARIANT_BY_STATUS[status] ?? "secondary"}>{label}</Badge>;
}
