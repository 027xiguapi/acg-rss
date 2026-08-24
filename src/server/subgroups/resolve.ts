import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subgroups } from "@/db/schema";

/** Resolve a parsed subgroup name to its managed subgroup id, if any. */
export async function resolveSubgroupId(
  name: string | null | undefined
): Promise<number | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const [row] = await db
    .select({ id: subgroups.id })
    .from(subgroups)
    .where(eq(subgroups.name, trimmed))
    .limit(1);
  return row?.id ?? null;
}
