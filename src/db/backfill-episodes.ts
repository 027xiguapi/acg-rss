import "dotenv/config";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "./index";
import { torrentItems } from "./schema";
import { findOrCreateEpisode } from "../server/bangumi/linker";

/**
 * One-off backfill for the bangumi → episode → torrent hierarchy: creates
 * episode rows for torrents already linked to an bangumi with a parsed
 * episode number, and stores the link on each torrent. Safe to re-run.
 */
async function main(): Promise<void> {
  const rows = await db
    .select({
      id: torrentItems.id,
      bangumiId: torrentItems.bangumiId,
      episode: torrentItems.episode,
      episodeId: torrentItems.episodeId,
    })
    .from(torrentItems)
    .where(isNotNull(torrentItems.bangumiId));

  let linked = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.episodeId || row.bangumiId == null || row.episode == null) {
      skipped++;
      continue;
    }
    const episodeId = await findOrCreateEpisode(row.bangumiId, row.episode);
    await db
      .update(torrentItems)
      .set({ episodeId })
      .where(eq(torrentItems.id, row.id));
    linked++;
  }

  console.log(
    `Backfill done: ${linked} torrent(s) attached to episode rows, ${skipped} skipped.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
