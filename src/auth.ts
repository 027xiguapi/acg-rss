import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { eq, or } from "drizzle-orm";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";
import { verifyPassword } from "@/server/auth/password";

/**
 * The adapter's public schema type is a union across SQL flavors; pick the
 * Postgres variant so the (intentional) id-type mismatch is the only cast.
 */
type PgAdapterSchema = Extract<
  NonNullable<Parameters<typeof DrizzleAdapter>[1]>,
  { usersTable: { _: { config: { dialect: "pg" } } } }
>;

/**
 * Auth.js (next-auth v5) setup. The Credentials provider keeps the local
 * username-or-email + bcrypt login; GitHub/Google activate automatically
 * when their AUTH_* env keys are present. JWT sessions are required for
 * Credentials to work alongside the database adapter.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter's nominal types expect string ids; our users table uses a
  // serial integer (the adapter detects the column default and omits the
  // incoming id on insert, so runtime works fine with either).
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  } as unknown as PgAdapterSchema),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        identity: { label: "Username or email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identity =
          typeof credentials?.identity === "string"
            ? credentials.identity.trim()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!identity || !password) return null;

        const rows = await db
          .select()
          .from(users)
          .where(
            or(
              eq(users.username, identity),
              eq(users.email, identity.toLowerCase())
            )
          )
          .limit(1);
        const user = rows[0];
        if (!user?.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        return {
          id: String(user.id),
          name: user.name ?? user.username,
          email: user.email,
          image: user.image,
          role: user.role,
          username: user.username,
        };
      },
    }),
    ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
      ? [GitHub]
      : []),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google]
      : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // user.id is a string here but the adapter passes numbers
        token.id = Number(user.id);
        token.role = user.role;
        token.username = user.username ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? 0);
        session.user.role = token.role ?? "user";
        session.user.username = token.username ?? null;
      }
      return session;
    },
  },
});
