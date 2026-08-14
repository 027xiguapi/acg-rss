"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { generateApiToken } from "@/server/auth/api";

export interface CreateTokenState {
  ok?: boolean;
  /** Plain token — returned exactly once, never stored in clear */
  token?: string;
  error?: string;
}

const tokenSchema = z.object({
  name: z.string().trim().min(1).max(128),
});

export async function createTokenAction(
  _prev: CreateTokenState,
  formData: FormData
): Promise<CreateTokenState> {
  const user = await getSessionUser();
  if (!user) return { error: "notAuthenticated" };

  const parsed = tokenSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "invalid" };

  const generated = generateApiToken();
  await db.insert(apiTokens).values({
    userId: user.id,
    name: parsed.data.name,
    tokenHash: generated.hash,
    prefix: generated.prefix,
  });

  revalidatePath("/", "layout");
  return { ok: true, token: generated.plain };
}

export async function deleteTokenAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)));
  revalidatePath("/", "layout");
}
