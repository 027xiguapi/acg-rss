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

/**
 * Resolve a parsed subgroup name to its managed subgroup id, creating the
 * subgroup row on first sight so every torrent title tag ends up linked.
 * Safe against concurrent imports: the insert is deduplicated by the
 * unique name index and re-selected on conflict.
 */
export async function resolveOrCreateSubgroupId(
  name: string | null | undefined
): Promise<number | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const [existing] = await db
    .select({ id: subgroups.id })
    .from(subgroups)
    .where(eq(subgroups.name, trimmed))
    .limit(1);
  if (existing) return existing.id;

  const inserted = await db
    .insert(subgroups)
    .values({ name: trimmed })
    .onConflictDoNothing({ target: subgroups.name })
    .returning({ id: subgroups.id });
  if (inserted[0]) return inserted[0].id;

  const [raced] = await db
    .select({ id: subgroups.id })
    .from(subgroups)
    .where(eq(subgroups.name, trimmed))
    .limit(1);
  return raced?.id ?? null;
}
