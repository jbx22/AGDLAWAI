"use client";

import { supabase } from "@/lib/supabase";

export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Unable to fetch Supabase session for API token:", error);
    }
    return null;
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getSupabaseAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
