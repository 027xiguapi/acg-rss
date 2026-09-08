import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { bangumi } from "./schema";

/**
 * Import the production year from bangumi-names-content.csv into
 * bangumi.year. Each CSV row is keyed 1:1 by bangumiId (the `primary`
 * zh-CN row), so the year is written straight onto the matching bangumi.
 * Rows whose CSV year already matches are skipped; bangumi not present in
 * the CSV are left untouched. Safe to re-run.
 *
 * Targets DATABASE_URL by default; pass --remote to run against
 * REMOTE_DATABASE_URL (production) instead. Preview with --dry-run first.
 * Updates are applied in chunked `UPDATE … FROM (VALUES …)` statements so
 * large remote imports finish in a few round-trips.
 *
 * Usage: tsx src/db/import-years.ts [csvPath] [--remote] [--dry-run]
 */

/** Rows per batched UPDATE statement. */
const CHUNK_SIZE = 500;

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
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const remote = args.includes("--remote");
  const file =
    args.find((a) => !a.startsWith("--")) ??
    path.join(process.cwd(), "bangumi-names-content.csv");

  const envName = remote ? "REMOTE_DATABASE_URL" : "DATABASE_URL";
  const connectionString = remote
    ? process.env.REMOTE_DATABASE_URL
    : process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(`${envName} is not set. Configure it in .env.`);
  }
  const client = postgres(connectionString, { max: 10, idle_timeout: 20 });
  const db = drizzle(client);

  let text = readFileSync(file, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = parseCsv(text);
  const header = rows[0];
  const col = {
    bangumiId: header.indexOf("bangumiId"),
    year: header.indexOf("year"),
  };
  if (col.bangumiId < 0 || col.year < 0) {
    throw new Error(`CSV header missing a column: ${header.join(",")}`);
  }

  // CSV year -> bangumiId map. A valid year is a plain 4-digit integer.
  const yearById = new Map<number, number>();
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const bangumiId = Number(row[col.bangumiId]);
    if (!Number.isInteger(bangumiId) || bangumiId <= 0) {
      skipped++;
      continue;
    }
    const year = Number((row[col.year] ?? "").trim());
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      skipped++;
      continue;
    }
    yearById.set(bangumiId, year);
  }

  const existing = await db
    .select({ id: bangumi.id, year: bangumi.year })
    .from(bangumi);
  const currentYear = new Map(existing.map((r) => [r.id, r.year]));
  const ids = new Set(existing.map((r) => r.id));

  const pending: [bangumiId: number, year: number][] = [];
  let unchanged = 0;
  let missing = 0;
  for (const [bangumiId, year] of yearById) {
    if (!ids.has(bangumiId)) {
      missing++;
      continue;
    }
    if (currentYear.get(bangumiId) === year) {
      unchanged++;
      continue;
    }
    pending.push([bangumiId, year]);
  }

  if (!dryRun) {
    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE);
      const values = sql.join(
        chunk.map(([id, year]) => sql`(${id}::int, ${year}::int)`),
        sql`, `
      );
      await db.execute(sql`
        UPDATE bangumi AS b
        SET year = v.year, updated_at = now()
        FROM (VALUES ${values}) AS v(id, year)
        WHERE b.id = v.id
      `);
    }
  }

  console.log(`Target: ${envName} (${new URL(connectionString).host})`);
  console.log(
    `${dryRun ? "[dry-run] " : ""}CSV rows: ${yearById.size} valid, ${skipped} skipped; ` +
      `DB bangumi: ${existing.length}.`
  );
  console.log(
    `${dryRun ? "[dry-run] " : ""}${dryRun ? "Would update" : "Updated"} ${pending.length}; unchanged ${unchanged}; ` +
      `missing in DB ${missing}.`
  );

  await client.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
