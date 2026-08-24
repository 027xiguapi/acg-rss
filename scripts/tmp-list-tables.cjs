const postgres = require("postgres");

const sql = postgres(
  process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/torrent_hub"
);

async function main() {
  const tables = ["users", "anime", "anime_titles", "anime_episodes", "torrent_items"];
  for (const t of tables) {
    const rows = await sql.unsafe(`select count(*)::int as n from ${t}`);
    console.log(`${t}: ${rows[0].n}`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
