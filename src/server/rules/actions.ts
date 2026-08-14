"use server";

import { revalidatePath } from "next/cache";
import { and, eq, not } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { downloadRules } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";

export interface RuleFormState {
  ok?: boolean;
  error?: string;
}

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().int().min(0).max(10_000_000).optional()
);

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional()
  );

const ruleSchema = z.object({
  name: z.string().trim().min(1).max(255),
  keyword: z.string().trim().min(1).max(255),
  excludeKeyword: optionalText(255),
  mustRegex: optionalText(1000),
  resolution: optionalText(16),
  minSizeMb: optionalNumber,
  maxSizeMb: optionalNumber,
  feedId: optionalNumber,
  enabled: z.boolean(),
});

function parseRuleForm(formData: FormData) {
  return ruleSchema.safeParse({
    name: formData.get("name"),
    keyword: formData.get("keyword"),
    excludeKeyword: formData.get("excludeKeyword"),
    mustRegex: formData.get("mustRegex"),
    resolution: formData.get("resolution"),
    minSizeMb: formData.get("minSizeMb"),
    maxSizeMb: formData.get("maxSizeMb"),
    feedId: formData.get("feedId"),
    enabled: formData.get("enabled") != null,
  });
}

/** Create or update (when an id is present) one of the user's rules. */
export async function saveRuleAction(
  _prev: RuleFormState,
  formData: FormData
): Promise<RuleFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "notAuthenticated" };

  const parsed = parseRuleForm(formData);
  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  if (data.mustRegex) {
    try {
      new RegExp(data.mustRegex, "i");
    } catch {
      return { error: "invalidRegex" };
    }
  }

  const id = Number(formData.get("id"));

  if (Number.isInteger(id) && id > 0) {
    await db
      .update(downloadRules)
      .set(data)
      .where(and(eq(downloadRules.id, id), eq(downloadRules.userId, user.id)));
  } else {
    await db.insert(downloadRules).values({ userId: user.id, ...data });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteRuleAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db
    .delete(downloadRules)
    .where(and(eq(downloadRules.id, id), eq(downloadRules.userId, user.id)));
  revalidatePath("/", "layout");
}

export async function toggleRuleAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db
    .update(downloadRules)
    .set({ enabled: not(downloadRules.enabled) })
    .where(and(eq(downloadRules.id, id), eq(downloadRules.userId, user.id)));
  revalidatePath("/", "layout");
}
