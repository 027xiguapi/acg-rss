import "dotenv/config";
import { readdirSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { bangumi, bangumiInfos } from "./schema";

/**
 * Backfill cover URLs from the local poster files in public/images/bangumi.
 * Those files are named after the zh-Hans title (e.g. "葬送的芙莉莲.webp")
 * and are committed to the repo, so they deploy as static assets. In
 * production the runtime `existsSync` check in resolveCover can't see them,
 * so we persist the local /images/... path into bangumi.cover_url instead —
 * it is served directly by the CDN/static host. Safe to re-run.
 */
async function main(): Promise<void> {
  const dir = path.join(process.cwd(), "public", "images", "bangumi");
  const localCovers = new Set(
    readdirSync(dir)
      .filter((name) => name.endsWith(".webp"))
      .map((name) => name.slice(0, -".webp".length))
  );

  const rows = await db
    .select({ bangumiId: bangumiInfos.bangumiId, title: bangumiInfos.title })
    .from(bangumiInfos)
    .where(eq(bangumiInfos.lang, "zh-Hans"));

  // One zh-Hans title per bangumi, last row wins (matches the card query).
  const byBangumi = new Map<number, string>();
  for (const row of rows) byBangumi.set(row.bangumiId, row.title);

  let updated = 0;
  for (const [bangumiId, title] of byBangumi) {
    if (!localCovers.has(title)) continue;
    const url = `/images/bangumi/${encodeURIComponent(title)}.webp`;
    await db
      .update(bangumi)
      .set({ coverUrl: url })
      .where(eq(bangumi.id, bangumiId));
    updated += 1;
  }

  console.log(
    `Backfill complete: ${byBangumi.size} bangumi scanned, ${updated} cover URL(s) set ` +
      `from ${localCovers.size} local poster(s).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
