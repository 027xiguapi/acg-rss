import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Pull the remote production database into the local one.
 *
 * It dumps the remote database with pg_dump (schema + data + sequences,
 * without owner/privilege statements so the restored objects belong to the
 * local user), drops and recreates the local database, then restores the
 * dump with psql.
 *
 * Requires a local PostgreSQL installation with pg_dump/psql (or set PGBIN
 * to its bin directory). Read the target from REMOTE_DATABASE_URL and the
 * local target from DATABASE_URL (both in .env).
 *
 * This is destructive to the LOCAL database only. Run with `--yes` to
 * actually execute; without it the script prints the plan and exits.
 */

interface PgUrl {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

function parsePgUrl(url: string): PgUrl {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || "5432",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
}

function buildPgUrl(c: PgUrl): string {
  const enc = encodeURIComponent;
  return `postgresql://${enc(c.user)}:${enc(c.password)}@${c.host}:${c.port}/${enc(c.database)}`;
}

/** Locate the PostgreSQL bin directory holding pg_dump/psql. */
function findPgBin(): string {
  if (process.env.PGBIN && existsSync(process.env.PGBIN)) {
    return process.env.PGBIN;
  }
  const roots = [
    "D:\\Program Files\\PostgreSQL",
    "C:\\Program Files\\PostgreSQL",
    "C:\\Program Files (x86)\\PostgreSQL",
  ];
  const candidates: { bin: string; version: number }[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const ver of readdirSync(root)) {
      const bin = path.join(root, ver, "bin");
      if (!existsSync(path.join(bin, "pg_dump.exe"))) continue;
      const major = Number((ver.match(/^(\d+)/) ?? [])[1] ?? 0);
      candidates.push({ bin, version: major });
    }
  }
  candidates.sort((a, b) => b.version - a.version);
  return candidates[0]?.bin ?? "";
}

function run(exe: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const res = spawnSync(exe, args, { encoding: "utf8" });
  return {
    ok: res.status === 0,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

function main(): void {
  const remoteUrl = process.env.REMOTE_DATABASE_URL;
  const localUrl = process.env.DATABASE_URL;
  if (!remoteUrl || !localUrl) {
    console.error(
      "Missing DATABASE_URL or REMOTE_DATABASE_URL. Set both in .env."
    );
    process.exit(1);
  }

  const remote = parsePgUrl(remoteUrl);
  const local = parsePgUrl(localUrl);
  const bin = findPgBin();
  if (!bin) {
    console.error(
      "Could not locate pg_dump/psql. Install PostgreSQL or set PGBIN to its bin directory."
    );
    process.exit(1);
  }

  const pgDump = path.join(bin, "pg_dump.exe");
  const psql = path.join(bin, "psql.exe");

  const plan = [
    `source:  ${remote.user}@${remote.host}:${remote.port}/${remote.database}`,
    `target:  ${local.user}@${local.host}:${local.port}/${local.database}`,
    `pg bin:  ${bin}`,
    `action:  DROP local database "${local.database}" then restore a full dump of the remote`,
  ].join("\n");

  if (!process.argv.includes("--yes")) {
    console.log("DRY RUN — pass --yes to execute.\n\n" + plan);
    process.exit(0);
  }

  console.log(plan + "\n");

  // 1. Dump the remote database (plain SQL, no owner/privileges).
  const dumpFile = path.join(os.tmpdir(), `acg-remote-${Date.now()}.sql`);
  console.log("[1/3] dumping remote database…");
  const dump = run(pgDump, [
    `--dbname=${remoteUrl}`,
    "--no-owner",
    "--no-privileges",
    "--file",
    dumpFile,
  ]);
  if (!dump.ok) {
    console.error("pg_dump failed:\n" + (dump.stderr || dump.stdout));
    process.exit(1);
  }

  // 2. Drop and recreate the local database (force-terminates connections).
  const maintenanceUrl = buildPgUrl({ ...local, database: "postgres" });
  console.log(`[2/3] dropping + recreating local database "${local.database}"…`);
  const drop = run(psql, [
    `--dbname=${maintenanceUrl}`,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `DROP DATABASE IF EXISTS "${local.database}" WITH (FORCE);`,
  ]);
  if (!drop.ok) {
    console.error("DROP DATABASE failed:\n" + (drop.stderr || drop.stdout));
    process.exit(1);
  }
  const create = run(psql, [
    `--dbname=${maintenanceUrl}`,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `CREATE DATABASE "${local.database}";`,
  ]);
  if (!create.ok) {
    console.error("CREATE DATABASE failed:\n" + (create.stderr || create.stdout));
    process.exit(1);
  }

  // 3. Restore the dump into the fresh local database.
  console.log("[3/3] restoring dump into local database…");
  const restore = run(psql, [
    `--dbname=${localUrl}`,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    dumpFile,
  ]);
  if (!restore.ok) {
    console.error(
      "Restore failed — keeping dump for inspection: " + dumpFile + "\n" +
      (restore.stderr || restore.stdout)
    );
    process.exit(1);
  }

  unlinkSync(dumpFile);
  console.log("Done. Local database now mirrors the remote.");
}

main();
