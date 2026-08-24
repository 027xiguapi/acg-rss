import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    /** "admin" | "user" from the users table */
    role?: string;
    /** Null for accounts created via OAuth */
    username?: string | null;
  }

  interface Session {
    user?: DefaultSession["user"] & {
      /** Numeric users.id, stringified */
      id: string;
      role: string;
      username: string | null;
    };
  }
}

// NOTE: "next-auth/jwt" only star-re-exports `JWT` from "@auth/core/jwt",
// which TypeScript module augmentation cannot merge with, so the interface is
// augmented at its declaration site instead (pinned to the exact @auth/core
// version next-auth depends on).
declare module "@auth/core/jwt" {
  interface JWT {
    /** Numeric users.id */
    id?: number;
    role?: string;
    username?: string | null;
  }
}

// Ensure the augmentation file is treated as a module (required for
// `declare module` to merge with — not replace — the real next-auth types).
export type { DefaultSession };
