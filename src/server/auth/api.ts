import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens, users, type User } from "@/db/schema";
import { sha256Hex } from "../crypto";

export interface GeneratedToken {
  /** The plain token, shown to the user exactly once */
  plain: string;
  hash: string;
  prefix: string;
}

export function generateApiToken(): GeneratedToken {
  const plain = `th_${randomBytes(24).toString("hex")}`;
  return {
    plain,
    hash: sha256Hex(plain),
    prefix: plain.slice(0, 8),
  };
}

/**
 * Authenticate an incoming API request via `Authorization: Bearer <token>`.
 * Returns the owning user or null.
 */
export async function authenticateApiRequest(
  req: Request
): Promise<User | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const plain = header.slice(7).trim();
  if (!plain) return null;

  const rows = await db
    .select({ token: apiTokens, user: users })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(eq(apiTokens.tokenHash, sha256Hex(plain)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Best-effort last-used tracking; never fail auth because of it
  db.update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.token.id))
    .catch(() => undefined);

  return row.user;
}
