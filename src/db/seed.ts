import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { rssFeeds, users, type User } from "./schema";
import { hashPassword } from "../server/auth/password";

/**
 * Seeds a demo user (demo / demo12345 unless overridden via SEED_*) and one
 * sample torrent RSS feed. Safe to re-run: existing rows are left alone.
 */
async function main(): Promise<void> {
  const username = process.env.SEED_USERNAME ?? "demo";
  const email = (process.env.SEED_EMAIL ?? "demo@torrenthub.local").toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "demo12345";

  let user: User | undefined = (
    await db.select().from(users).where(eq(users.username, username)).limit(1)
  )[0];

  if (!user) {
    user = (
      await db
        .insert(users)
        .values({
          username,
          email,
          passwordHash: await hashPassword(password),
        })
        .returning()
    )[0];
    console.log(`Created user "${username}" (password: ${password})`);
  } else {
    console.log(`User "${username}" already exists — skipping`);
  }

  const feeds = await db
    .select({ id: rssFeeds.id })
    .from(rssFeeds)
    .where(eq(rssFeeds.userId, user.id))
    .limit(1);

  if (feeds.length === 0) {
    await db.insert(rssFeeds).values({
      userId: user.id,
      name: "Nyaa — Anime (English-translated)",
      url: "https://nyaa.si/?page=rss&c=0_1&f=0",
      fetchIntervalMinutes: 5,
      enabled: true,
    });
    console.log("Added sample feed: Nyaa anime RSS");
  } else {
    console.log("User already has feeds — skipping sample feed");
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
