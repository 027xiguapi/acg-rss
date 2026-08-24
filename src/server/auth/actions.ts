"use server";

import { eq, sql } from "drizzle-orm";
import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "./password";
import { signIn, signOut } from "@/auth";

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
    .select({ id: users.id })
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
  // Bootstrap: the first ever account becomes the administrator
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users);
  await db.insert(users).values({
    username,
    name: username,
    email: email.toLowerCase(),
    passwordHash,
    role: total === 0 ? "admin" : "user",
  });

  try {
    await signIn("credentials", {
      identity: username,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "generic" };
    throw error;
  }
  const locale = await getLocale();
  redirect(`/${locale}`);
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
  try {
    await signIn("credentials", { identity, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: "invalidCredentials" };
    throw error;
  }
  const locale = await getLocale();
  redirect(`/${locale}`);
}

/** Sign in with an OAuth provider (buttons on the login page). */
export async function oauthSignInAction(
  provider: "github" | "google"
): Promise<void> {
  const locale = await getLocale();
  await signIn(provider, { redirectTo: `/${locale}` });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  const locale = await getLocale();
  redirect(`/${locale}/login`);
}
