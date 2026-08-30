import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { subgroups, torrentItems } from "./schema";
import { extractSubgroup } from "../lib/parser";

/**
 * Backfill subgroup linking for existing torrents: re-extract the fansub
 * tag from each title, auto-create missing subgroups rows, and set both
 * the parsed `subgroup` text and the `subgroup_id` link.
 */
async function main(): Promise<void> {
  const rows = await db
    .select({
      id: torrentItems.id,
      title: torrentItems.title,
      subgroup: torrentItems.subgroup,
      subgroupId: torrentItems.subgroupId,
    })
    .from(torrentItems);

  // Cache subgroup ids within the run to avoid a query per torrent.
  const idCache = new Map<string, number>();

  async function subgroupIdFor(name: string): Promise<number | null> {
    const cached = idCache.get(name);
    if (cached != null) return cached;

    const [existing] = await db
      .select({ id: subgroups.id })
      .from(subgroups)
      .where(eq(subgroups.name, name))
      .limit(1);
    if (existing) {
      idCache.set(name, existing.id);
      return existing.id;
    }

    const inserted = await db
      .insert(subgroups)
      .values({ name })
      .onConflictDoNothing({ target: subgroups.name })
      .returning({ id: subgroups.id });
    if (inserted[0]) {
      idCache.set(name, inserted[0].id);
      return inserted[0].id;
    }

    const [raced] = await db
      .select({ id: subgroups.id })
      .from(subgroups)
      .where(eq(subgroups.name, name))
      .limit(1);
    if (raced) idCache.set(name, raced.id);
    return raced?.id ?? null;
  }

  let updated = 0;
  for (const row of rows) {
    const subgroup = extractSubgroup(row.title);
    if (!subgroup) continue;
    const subgroupId = await subgroupIdFor(subgroup);
    if (row.subgroup === subgroup && row.subgroupId === subgroupId) continue;

    await db
      .update(torrentItems)
      .set({ subgroup, subgroupId })
      .where(eq(torrentItems.id, row.id));
    updated += 1;
  }

  console.log(
    `Backfill complete: ${rows.length} torrent(s) scanned, ${updated} updated, ` +
      `${idCache.size} subgroup(s) ensured.`
  );
  process.exit(0);
}

main();
