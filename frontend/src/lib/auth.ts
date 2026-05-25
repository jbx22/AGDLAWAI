import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { userProfiles, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function legacySha256(password: string, salt: string): string {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

function scryptHash(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (storedHash.startsWith("scrypt:")) {
    return safeEqualHex(scryptHash(password, salt), storedHash.slice("scrypt:".length));
  }
  return safeEqualHex(legacySha256(password, salt), storedHash);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).toLowerCase();
        const password = credentials.password as string;
        
        const userRows = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        
        const user = userRows[0];
        if (!user) return null;
        
        if (!verifyPassword(password, user.password_hash, user.password_salt)) return null;

        const [profile] = await db
          .select({
            account_status: userProfiles.account_status,
          })
          .from(userProfiles)
          .where(eq(userProfiles.user_id, user.id))
          .limit(1);

        if (profile?.account_status === "suspended" || profile?.account_status === "deleted") {
          return null;
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.display_name || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
});
