import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "./index";
import { bangumiInfos } from "./schema";

/**
 * Import Japanese names + synopses from bangumi-names-content-ja.csv as
 * `synonym` rows (lang=ja) alongside the existing Chinese `primary` rows.
 * Unlike the English CSV, the Japanese title is already in the `title`
 * column, so it is used directly. Safe to re-run (conflicts are skipped).
 *
 * Usage: tsx src/db/import-ja-names.ts [csvPath]
 */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function main(): Promise<void> {
  const file = process.argv[2] ?? path.join(process.cwd(), "bangumi-names-content-ja.csv");
  let text = readFileSync(file, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = parseCsv(text);
  const header = rows[0];
  const col = {
    bangumiId: header.indexOf("bangumiId"),
    title: header.indexOf("title"),
    content: header.indexOf("content"),
  };
  if (col.bangumiId < 0 || col.title < 0 || col.content < 0) {
    throw new Error(`CSV header missing a column: ${header.join(",")}`);
  }

  let imported = 0;
  let collided = 0;
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const bangumiId = Number(row[col.bangumiId]);
    if (!Number.isInteger(bangumiId) || bangumiId <= 0) {
      skipped++;
      continue;
    }
    const title = (row[col.title] ?? "").trim();
    const content = (row[col.content] ?? "").trim();
    if (!title) {
      skipped++;
      continue;
    }

    const inserted = await db
      .insert(bangumiInfos)
      .values({ bangumiId, kind: "synonym", lang: "ja", title, content: content || null })
      .onConflictDoNothing({ target: [bangumiInfos.bangumiId, bangumiInfos.title] })
      .returning({ id: bangumiInfos.id });
    if (inserted.length > 0) imported++;
    else collided++;
  }

  console.log(
    `Imported ${imported} Japanese synonym row(s); collided ${collided}; skipped ${skipped}.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
