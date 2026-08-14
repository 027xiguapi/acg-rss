"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { qbittorrentAccounts } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { encryptSecret } from "@/server/crypto";
import { testConnection } from "./client";

export interface AccountFormState {
  ok?: boolean;
  error?: string;
}

export interface TestConnectionState {
  ok?: boolean;
  version?: string;
  error?: string;
}

const accountSchema = z.object({
  name: z.string().trim().min(1).max(128),
  url: z.url().max(2048),
  username: z.string().trim().min(1).max(128),
  defaultCategory: z
    .string()
    .trim()
    .max(128)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  enabled: z.boolean(),
});

function parseAccountForm(formData: FormData) {
  return accountSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
    username: formData.get("username"),
    defaultCategory: formData.get("defaultCategory") ?? "",
    enabled: formData.get("enabled") != null,
  });
}

/** Create or update a client binding. Blank password on edit = keep current. */
export async function saveAccountAction(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "notAuthenticated" };

  const parsed = parseAccountForm(formData);
  if (!parsed.success) return { error: "invalidUrl" };

  const { name, url, username, defaultCategory, enabled } = parsed.data;
  const password = String(formData.get("password") ?? "");
  const id = Number(formData.get("id"));

  if (Number.isInteger(id) && id > 0) {
    const patch: Partial<typeof qbittorrentAccounts.$inferInsert> = {
      name,
      url,
      username,
      defaultCategory,
      enabled,
    };
    if (password.length > 0) {
      patch.passwordEncrypted = encryptSecret(password);
    }
    await db
      .update(qbittorrentAccounts)
      .set(patch)
      .where(
        and(
          eq(qbittorrentAccounts.id, id),
          eq(qbittorrentAccounts.userId, user.id)
        )
      );
  } else {
    if (password.length === 0) return { error: "passwordRequired" };
    await db.insert(qbittorrentAccounts).values({
      userId: user.id,
      name,
      url,
      username,
      passwordEncrypted: encryptSecret(password),
      defaultCategory,
      enabled,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db
    .delete(qbittorrentAccounts)
    .where(
      and(
        eq(qbittorrentAccounts.id, id),
        eq(qbittorrentAccounts.userId, user.id)
      )
    );
  revalidatePath("/", "layout");
}

/** Verify credentials against a live client before saving them. */
export async function testConnectionAction(
  _prev: TestConnectionState,
  formData: FormData
): Promise<TestConnectionState> {
  const user = await getSessionUser();
  if (!user) return { error: "notAuthenticated" };

  const url = String(formData.get("url") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!url || !username || !password) return { error: "missing" };

  try {
    const version = await testConnection(url, username, password);
    return { ok: true, version };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
