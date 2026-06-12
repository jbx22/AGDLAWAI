"use client";

import { getSession } from "next-auth/react";

export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const session = await getSession();
    return session?.supabaseAccessToken ?? null;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Unable to fetch Auth.js session for API token:", error);
    }
    return null;
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getSupabaseAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
