import "dotenv/config";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "./index";
import { bangumiInfos } from "./schema";

/**
 * Export every bangumi name (primary + synonyms) to a CSV in the project
 * root. Columns: bangumiId, kind, lang, title.
 */

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main(): Promise<void> {
  const rows = await db
    .select({
      bangumiId: bangumiInfos.bangumiId,
      kind: bangumiInfos.kind,
      lang: bangumiInfos.lang,
      title: bangumiInfos.title,
    })
    .from(bangumiInfos)
    .orderBy(bangumiInfos.bangumiId, bangumiInfos.kind);

  const lines = ["bangumiId,kind,lang,title"];
  for (const row of rows) {
    lines.push(
      [row.bangumiId, row.kind, csvCell(row.lang), csvCell(row.title)].join(",")
    );
  }

  const file = path.join(process.cwd(), "bangumi-names.csv");
  writeFileSync(file, lines.join("\n") + "\n", "utf8");
  console.log(`Exported ${rows.length} name(s) to ${file}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  });
