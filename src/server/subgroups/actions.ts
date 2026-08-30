"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { subgroups } from "@/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { parseIdList } from "@/lib/form-data";

export interface SubgroupFormState {
  ok?: boolean;
  error?: string;
}

const subgroupSchema = z.object({
  name: z.string().trim().min(1).max(128),
  category: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(64).optional()
  ),
});

export async function createSubgroupAction(
  _prev: SubgroupFormState,
  formData: FormData
): Promise<SubgroupFormState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const parsed = subgroupSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  const [existing] = await db
    .select({ id: subgroups.id })
    .from(subgroups)
    .where(eq(subgroups.name, data.name))
    .limit(1);
  if (existing) return { error: "duplicate" };

  await db.insert(subgroups).values({
    name: data.name,
    category: data.category,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateSubgroupAction(
  _prev: SubgroupFormState,
  formData: FormData
): Promise<SubgroupFormState> {
  const user = await getAdminUser();
  if (!user) return { error: "notAuthenticated" };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "invalid" };

  const parsed = subgroupSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  const [existing] = await db
    .select({ id: subgroups.id })
    .from(subgroups)
    .where(eq(subgroups.name, data.name))
    .limit(1);
  if (existing && existing.id !== id) return { error: "duplicate" };

  await db
    .update(subgroups)
    .set({ name: data.name, category: data.category })
    .where(eq(subgroups.id, id));

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteSubgroupAction(formData: FormData): Promise<void> {
  const user = await getAdminUser();
  if (!user) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db.delete(subgroups).where(eq(subgroups.id, id));
  revalidatePath("/", "layout");
}

/** Delete every subgroup checked in the admin table (formData ids). */
export async function batchDeleteSubgroupsAction(
  formData: FormData
): Promise<void> {
  const user = await getAdminUser();
  if (!user) return;

  const ids = parseIdList(formData);
  if (ids.length === 0) return;

  await db.delete(subgroups).where(inArray(subgroups.id, ids));
  revalidatePath("/", "layout");
}
