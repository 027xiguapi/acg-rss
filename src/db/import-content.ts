import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { bangumiInfos } from "./schema";

/**
 * Import Chinese synopses from bangumi-names-content.csv into
 * bangumi_infos.content. Each row is matched to the bangumi's primary name
 * row by bangumiId; title mismatches are reported but the content is still
 * written (the CSV is keyed by bangumiId). Safe to re-run.
 *
 * Usage: tsx src/db/import-content.ts [csvPath]
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
  const file = process.argv[2] ?? path.join(process.cwd(), "bangumi-names-content.csv");
  let text = readFileSync(file, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = parseCsv(text);
  const header = rows[0];
  const col = {
    bangumiId: header.indexOf("bangumiId"),
    kind: header.indexOf("kind"),
    lang: header.indexOf("lang"),
    title: header.indexOf("title"),
    content: header.indexOf("content"),
  };
  if (Object.values(col).some((i) => i < 0)) {
    throw new Error(`CSV header missing a column: ${header.join(",")}`);
  }

  // Load every primary name row once, keyed by bangumiId.
  const primaries = await db
    .select({ id: bangumiInfos.id, bangumiId: bangumiInfos.bangumiId, title: bangumiInfos.title })
    .from(bangumiInfos)
    .where(eq(bangumiInfos.kind, "primary"));
  const primaryMap = new Map(primaries.map((r) => [r.bangumiId, r]));

  let updated = 0;
  let missing = 0;
  const mismatches: { bangumiId: number; csv: string; db: string }[] = [];

  for (const row of rows.slice(1)) {
    const bangumiId = Number(row[col.bangumiId]);
    if (!Number.isInteger(bangumiId) || bangumiId <= 0) continue;

    const csvTitle = (row[col.title] ?? "").trim();
    const content = (row[col.content] ?? "").trim();
    const lang = (row[col.lang] ?? "").trim() || "zh-CN";

    const target = primaryMap.get(bangumiId);
    if (!target) {
      missing++;
      continue;
    }
    if (target.title !== csvTitle) {
      mismatches.push({ bangumiId, csv: csvTitle, db: target.title });
    }

    await db
      .update(bangumiInfos)
      .set({ content: content || null, lang })
      .where(eq(bangumiInfos.id, target.id));
    updated++;
  }

  console.log(`Imported ${updated} content row(s); ${missing} bangumi not found.`);
  if (mismatches.length) {
    console.log(`Title mismatches (${mismatches.length}):`);
    for (const m of mismatches.slice(0, 20)) {
      console.log(`  #${m.bangumiId} csv="${m.csv}" db="${m.db}"`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
