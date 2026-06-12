import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createServerSupabase() {
    const serverUrl = process.env.SUPABASE_URL || supabaseUrl;
    const serviceKey = process.env.SUPABASE_SECRET_KEY || "";

    if (!serverUrl || !serviceKey) {
        throw new Error("Supabase server environment is not configured");
    }

    return createClient(serverUrl, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
