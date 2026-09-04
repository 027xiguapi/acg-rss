import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { bangumiInfos } from "./schema";

/**
 * Backfill every bangumi's primary name row: set the default language to
 * zh-CN and fill `content` with a Chinese synopsis. Edit DEFAULT_LANG /
 * DEFAULT_CONTENT below to change what is written. Safe to re-run.
 */
const DEFAULT_LANG = "zh-CN";
const DEFAULT_CONTENT = "暂无简介，敬请期待。";

async function main(): Promise<void> {
  const updated = await db
    .update(bangumiInfos)
    .set({ lang: DEFAULT_LANG, content: DEFAULT_CONTENT })
    .where(eq(bangumiInfos.kind, "primary"))
    .returning({ id: bangumiInfos.id });

  console.log(
    `Backfill complete: ${updated.length} primary name(s) set to lang=${DEFAULT_LANG} with content.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
