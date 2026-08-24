import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

/** Load the currently authenticated user, or null. */
export async function getSessionUser(): Promise<User | null> {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  // Re-read the full row so role changes take effect immediately.
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** The currently authenticated user, but only if they are an admin. */
export async function getAdminUser(): Promise<User | null> {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}
