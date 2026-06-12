/**
 * Dual database client — provides both Drizzle (for backward compat) and
 * a real Supabase admin client (for new code).
 *
 * Drizzle reads DATABASE_URL from the environment.
 * Supabase reads SUPABASE_URL + SUPABASE_SECRET_KEY.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { createClient } from "@supabase/supabase-js";

type AnyTable = {
  Row: any;
  Insert: any;
  Update: any;
  Relationships: [];
};

type AnyDatabase = {
  public: {
    Tables: Record<string, AnyTable>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};

type SupabaseAdminClient = ReturnType<typeof createClient<AnyDatabase>>;

// ---------------------------------------------------------------------------
// Drizzle client (legacy — for files not yet converted)
// ---------------------------------------------------------------------------

let _drizzleDb: ReturnType<typeof drizzle> | null = null;
let _pgClient: ReturnType<typeof postgres> | null = null;

export function getDrizzleDb() {
  if (!_drizzleDb) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    _pgClient = postgres(process.env.DATABASE_URL, {
      max: 5,
      prepare: false,
      ssl: process.env.DATABASE_URL.includes("sslmode=disable")
        ? false
        : "require",
    });
    _drizzleDb = drizzle(_pgClient, { schema });
  }
  return _drizzleDb;
}

/**
 * Legacy Drizzle db — used by routes not yet migrated to Supabase.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const real = getDrizzleDb();
    const val = (real as any)[prop];
    if (typeof val === "function") return val.bind(real);
    return val;
  },
});

// ---------------------------------------------------------------------------
// Supabase admin client (new code)
// ---------------------------------------------------------------------------

let _supabaseClient: SupabaseAdminClient | null = null;

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

export function getSupabase() {
  if (!_supabaseClient) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SECRET_KEY environment variables must be set"
      );
    }
    _supabaseClient = createClient<AnyDatabase>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _supabaseClient;
}

/**
 * New Supabase admin client — used by admin routes and any new code.
 */
export const supabase = new Proxy({} as SupabaseAdminClient, {
  get(_target, prop) {
    const real = getSupabase();
    const val = (real as any)[prop];
    if (typeof val === "function") return val.bind(real);
    return val;
  },
});
