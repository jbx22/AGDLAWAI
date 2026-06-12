#!/usr/bin/env node
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = join(__dirname, "..", ".env.local");

let DATABASE_URL = process.env.DATABASE_URL;
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL=(.+)$/);
    if (match && !DATABASE_URL) {
      DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
    }
    const envMatch = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (!envMatch) continue;
    const value = envMatch[2].trim().replace(/^["']|["']$/g, "");
    if (envMatch[1] === "SUPABASE_URL" && !SUPABASE_URL) SUPABASE_URL = value;
    if (envMatch[1] === "SUPABASE_SECRET_KEY" && !SUPABASE_SECRET_KEY) {
      SUPABASE_SECRET_KEY = value;
    }
  }
}

if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("DATABASE_URL, SUPABASE_URL, and SUPABASE_SECRET_KEY must be set.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  prepare: false,
  ssl: DATABASE_URL.includes("sslmode=disable") ? false : "require",
});
const demoEmails = [
  "demo@jblbizlaw.com",
  "admin@jblbizlaw.com",
  "superadmin@jblbizlaw.com",
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const { data, error } = await supabase.auth.admin.listUsers();
if (error) throw error;
const demoUserIds = (data?.users ?? [])
  .filter((user) => demoEmails.includes(user.email?.toLowerCase() ?? ""))
  .map((user) => user.id);

if (demoUserIds.length) {
  await sql`delete from user_profiles where user_id = any(${demoUserIds})`;
  for (const userId of demoUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
}

console.log(`Removed ${demoUserIds.length} demo users and their cascading demo data.`);
await sql.end();
