import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { getDb } from "./db";
import { sessions, users } from "./db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!process.env.AUTH_SECRET) return null;
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) return null;
        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) return null;
        await getDb()
          .insert(sessions)
          .values({
            userId: user.id,
            sessionToken: crypto.randomUUID(),
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
          })
          .catch(() => undefined);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
