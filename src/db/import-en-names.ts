import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "./index";
import { bangumiInfos } from "./schema";

/**
 * Import English names + synopses from bangumi-names-content-en.csv as
 * `synonym` rows (lang=en) alongside the existing Chinese `primary` rows.
 *
 * The English title is not a separate column in the CSV — it is embedded at
 * the head of `content` as a quoted string (`"Title" follows …`). Rows
 * without that quoted title are skipped and listed. Safe to re-run.
 *
 * Usage: tsx src/db/import-en-names.ts [csvPath]
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
  const file = process.argv[2] ?? path.join(process.cwd(), "bangumi-names-content-en.csv");
  let text = readFileSync(file, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = parseCsv(text);
  const header = rows[0];
  const col = {
    bangumiId: header.indexOf("bangumiId"),
    content: header.indexOf("content"),
  };
  if (col.bangumiId < 0 || col.content < 0) {
    throw new Error(`CSV header missing a column: ${header.join(",")}`);
  }

  let imported = 0;
  const skipped: number[] = [];
  const collided: number[] = [];

  for (const row of rows.slice(1)) {
    const bangumiId = Number(row[col.bangumiId]);
    if (!Number.isInteger(bangumiId) || bangumiId <= 0) continue;

    const content = (row[col.content] ?? "").trim();
    // English title sits at the head of content as "Title" ….
    const match = /^"([^"]+)"\s*(.*)$/s.exec(content);
    if (!match || !match[1].trim()) {
      skipped.push(bangumiId);
      continue;
    }
    const title = match[1].trim();

    const inserted = await db
      .insert(bangumiInfos)
      .values({ bangumiId, kind: "synonym", lang: "en", title, content })
      .onConflictDoNothing({ target: [bangumiInfos.bangumiId, bangumiInfos.title] })
      .returning({ id: bangumiInfos.id });
    if (inserted.length > 0) imported++;
    else collided.push(bangumiId);
  }

  console.log(
    `Imported ${imported} English synonym row(s); ` +
      `collided ${collided.length} (title already exists, e.g. English == primary); ` +
      `skipped ${skipped.length} (no embedded English title).`
  );
  if (skipped.length) {
    console.log(`Skipped bangumiIds (${skipped.length}): ${skipped.join(",")}`);
  }
  if (collided.length) {
    console.log(`Collided bangumiIds (${collided.length}): ${collided.join(",")}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
