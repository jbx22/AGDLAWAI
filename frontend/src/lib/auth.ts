/**
 * NextAuth credentials provider that validates against Supabase Auth.
 *
 * Replaces the old Drizzle-based password verification with
 * supabase.auth.signInWithPassword().
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import type { JWT } from "next-auth/jwt";
import { createClient } from "@supabase/supabase-js";

function supabaseBrowserKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

type SupabaseBackedUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  supabaseAccessToken?: string;
  supabaseRefreshToken?: string;
  supabaseExpiresAt?: number;
};

function createSupabaseBrowserAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = supabaseBrowserKey();
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase browser auth environment is not configured");
  }
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function refreshSupabaseToken(token: JWT): Promise<JWT> {
  if (!token.supabaseRefreshToken) return token;
  if (
    token.supabaseExpiresAt &&
    Date.now() < token.supabaseExpiresAt * 1000 - 60_000
  ) {
    return token;
  }

  try {
    const client = createSupabaseBrowserAuthClient();
    const { data, error } = await client.auth.refreshSession({
      refresh_token: token.supabaseRefreshToken,
    });
    if (error || !data.session) {
      console.warn("Supabase token refresh failed:", error?.message);
      return {
        ...token,
        supabaseAccessToken: undefined,
        supabaseRefreshToken: undefined,
        supabaseExpiresAt: undefined,
      };
    }
    return {
      ...token,
      supabaseAccessToken: data.session.access_token,
      supabaseRefreshToken:
        data.session.refresh_token ?? token.supabaseRefreshToken,
      supabaseExpiresAt: data.session.expires_at,
    };
  } catch (error) {
    console.error("Supabase token refresh error:", error);
    return token;
  }
}

const providers: Provider[] = [
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

      let anonClient: ReturnType<typeof createSupabaseBrowserAuthClient>;
      try {
        anonClient = createSupabaseBrowserAuthClient();
      } catch (error) {
        console.error(error);
        return null;
      }

      const { data, error } = await anonClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user || !data.session) {
        console.warn("Supabase Auth sign-in failed:", error?.message);
        return null;
      }

      return {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.display_name || null,
        supabaseAccessToken: data.session.access_token,
        supabaseRefreshToken: data.session.refresh_token,
        supabaseExpiresAt: data.session.expires_at,
      } satisfies SupabaseBackedUser;
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          scope: "openid email profile",
        },
      },
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!account.id_token) return false;

      try {
        const client = createSupabaseBrowserAuthClient();
        const { data, error } = await client.auth.signInWithIdToken({
          provider: "google",
          token: account.id_token,
        });
        if (error || !data.user || !data.session) {
          console.warn("Supabase Google sign-in failed:", error?.message);
          return false;
        }

        const backedUser = user as SupabaseBackedUser;
        backedUser.id = data.user.id;
        backedUser.email = data.user.email ?? user.email;
        backedUser.name =
          data.user.user_metadata?.display_name ??
          data.user.user_metadata?.full_name ??
          user.name;
        backedUser.supabaseAccessToken = data.session.access_token;
        backedUser.supabaseRefreshToken = data.session.refresh_token;
        backedUser.supabaseExpiresAt = data.session.expires_at;
        return true;
      } catch (error) {
        console.error("Google OAuth bridge to Supabase failed:", error);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        const backedUser = user as SupabaseBackedUser;
        token.id = backedUser.id;
        token.email = backedUser.email;
        token.supabaseAccessToken = backedUser.supabaseAccessToken;
        token.supabaseRefreshToken = backedUser.supabaseRefreshToken;
        token.supabaseExpiresAt = backedUser.supabaseExpiresAt;
      }
      return refreshSupabaseToken(token);
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.supabaseAccessToken = token.supabaseAccessToken as
          | string
          | undefined;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
});
