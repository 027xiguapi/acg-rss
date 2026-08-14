"use server";

import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";
import { clearSessionCookie, setSessionCookie } from "./session";

export type AuthState = { error?: string };

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

const registerSchema = z.object({
  username: z.string().trim().min(3).max(64),
  email: z.email().max(255),
  password: z.string().min(8).max(128),
  confirmPassword: z.string(),
});

const loginSchema = z.object({
  identity: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function registerAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: "usernameFormat" };

  const { username, email, password, confirmPassword } = parsed.data;
  if (!USERNAME_RE.test(username)) return { error: "usernameFormat" };
  if (password !== confirmPassword) return { error: "passwordMismatch" };

  const existing = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(eq(users.username, username));
  if (existing.length > 0) return { error: "usernameTaken" };

  const emailTaken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (emailTaken.length > 0) return { error: "emailTaken" };

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({ username, email: email.toLowerCase(), passwordHash })
    .returning({ id: users.id });

  await setSessionCookie(inserted[0].id);
  const locale = await getLocale();
  redirect(`/${locale}/dashboard`);
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    identity: formData.get("identity"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalidCredentials" };

  const { identity, password } = parsed.data;
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, identity))
    .limit(1);

  let user = rows[0];
  if (!user) {
    const byEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, identity.toLowerCase()))
      .limit(1);
    user = byEmail[0];
  }

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "invalidCredentials" };
  }

  await setSessionCookie(user.id);
  const locale = await getLocale();
  redirect(`/${locale}/dashboard`);
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  const locale = await getLocale();
  redirect(`/${locale}/login`);
}
