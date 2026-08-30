"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAdminUser } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { parseIdList } from "@/lib/form-data";

export interface UserFormState {
  ok?: boolean;
  /** Stable codes: invalid | usernameFormat | usernameTaken | emailTaken |
   *  weakPassword | selfRole | lastAdmin | notFound */
  error?: string;
}

const ROLES = ["user", "admin"] as const;

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

/** Shared fields of the create/update forms. Password is optional: OAuth
 *  accounts exist without one, and edits leave it unchanged when blank. */
const baseSchema = z.object({
  username: z.string().trim().min(3).max(64),
  name: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().max(255).optional()
  ),
  email: z.email().max(255),
  role: z.enum(ROLES),
  password: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(8).max(128).optional()
  ),
});

async function adminCountExcluding(userId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), ne(users.id, userId)));
  return row?.total ?? 0;
}

async function takenCheck(
  field: "username" | "email",
  value: string,
  exceptId?: number
): Promise<boolean> {
  const column = field === "username" ? users.username : users.email;
  const condition = exceptId
    ? and(eq(column, value), ne(users.id, exceptId))
    : eq(column, value);
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(condition)
    .limit(1);
  return rows.length > 0;
}

function parseForm(formData: FormData) {
  return baseSchema.safeParse({
    username: formData.get("username"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role") || "user",
    password: formData.get("password"),
  });
}

/** Create an account from the admin panel; password is required here so the
 *  local credentials provider works immediately. */
export async function createUserAction(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "invalid" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.path?.[0];
    if (first === "username") return { error: "usernameFormat" };
    if (first === "password") return { error: "weakPassword" };
    return { error: "invalid" };
  }
  const { username, name, email, role, password } = parsed.data;
  if (!USERNAME_RE.test(username)) return { error: "usernameFormat" };
  if (!password) return { error: "weakPassword" };
  const normalizedEmail = email.toLowerCase();

  if (await takenCheck("username", username)) return { error: "usernameTaken" };
  if (await takenCheck("email", normalizedEmail)) return { error: "emailTaken" };

  await db.insert(users).values({
    username,
    name: name ?? username,
    email: normalizedEmail,
    role,
    passwordHash: await hashPassword(password),
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Update profile fields, role or reset the password of one account. */
export async function updateUserAction(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "invalid" };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "invalid" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.path?.[0];
    if (first === "password") return { error: "weakPassword" };
    if (first === "username") return { error: "usernameFormat" };
    return { error: "invalid" };
  }
  const { username, name, email, role, password } = parsed.data;
  if (!USERNAME_RE.test(username)) return { error: "usernameFormat" };
  const normalizedEmail = email.toLowerCase();

  // Guard rails: an admin can neither lock themselves out nor demote the
  // last remaining admin account.
  if (id === admin.id && role !== "admin") return { error: "selfRole" };

  if (await takenCheck("username", username, id)) return { error: "usernameTaken" };
  if (await takenCheck("email", normalizedEmail, id)) return { error: "emailTaken" };

  const updated = await db
    .update(users)
    .set(
      password
        ? {
            username,
            name: name ?? username,
            email: normalizedEmail,
            role,
            passwordHash: await hashPassword(password),
          }
        : { username, name: name ?? username, email: normalizedEmail, role }
    )
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!updated[0]) return { error: "notFound" };

  // Undo a change that would leave zero admins and report it back.
  if (role !== "admin" && (await adminCountExcluding(id)) === 0) {
    await db.update(users).set({ role: "admin" }).where(eq(users.id, id));
    return { error: "lastAdmin" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Delete an account. Refuses to delete the caller themselves or the last
 *  remaining admin. Cascades remove their bangumi/accounts/sessions/etc. */
export async function deleteUserAction(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  if (id === admin.id) return;

  if ((await adminCountExcluding(id)) === 0) return;

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/", "layout");
}

/** Delete every user checked in the admin table (formData ids). Applies the
 *  same guard rails as the single delete: the caller is never deleted and a
 *  selection that would leave zero admins is trimmed down to non-admins. */
export async function batchDeleteUsersAction(
  formData: FormData
): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const ids = parseIdList(formData).filter((id) => id !== admin.id);
  if (ids.length === 0) return;

  const targets = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(inArray(users.id, ids));
  if (targets.length === 0) return;

  const adminIds = targets
    .filter((row) => row.role === "admin")
    .map((row) => row.id);
  let deletable = targets.map((row) => row.id);
  if (adminIds.length > 0) {
    const [{ count: otherAdmins }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), notInArray(users.id, adminIds)));
    if (otherAdmins === 0) {
      const keep = new Set(adminIds);
      deletable = deletable.filter((id) => !keep.has(id));
    }
  }
  if (deletable.length === 0) return;

  await db.delete(users).where(inArray(users.id, deletable));
  revalidatePath("/", "layout");
}
