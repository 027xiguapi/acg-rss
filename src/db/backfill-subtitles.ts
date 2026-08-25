import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { torrentItems } from "./schema";
import { extractSubtitleInfo } from "../lib/parser";

/** Backfill subtitle_languages / subtitle_format for existing torrents. */
async function main(): Promise<void> {
  const rows = await db.select().from(torrentItems);
  let updated = 0;
  for (const row of rows) {
    const info = extractSubtitleInfo(row.title);
    const languages = info.languages.length ? info.languages : null;
    if (
      JSON.stringify(languages) === JSON.stringify(row.subtitleLanguages ?? null) &&
      (info.format ?? null) === row.subtitleFormat
    ) {
      continue;
    }
    await db
      .update(torrentItems)
      .set({
        subtitleLanguages: languages,
        subtitleFormat: info.format,
      })
      .where(eq(torrentItems.id, row.id));
    updated += 1;
  }
  console.log(`Backfill complete: ${updated} of ${rows.length} torrents updated.`);
  process.exit(0);
}

main();
