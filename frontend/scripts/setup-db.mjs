#!/usr/bin/env node
/**
 * JBL BIZ LAW - Supabase database setup helper.
 *
 * This project uses the same Postgres schema shape as Mike, hosted in
 * Supabase Postgres. Add your Supabase database connection string to
 * .env.local as DATABASE_URL, then this script will push the Drizzle schema.
 *
 * Supabase path:
 *   Project Settings > Database > Connection string, or run
 *   supabase link --project-ref <project-ref>.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = join(__dirname, "..");
const ENV_FILE = join(FRONTEND_DIR, ".env.local");

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { stdio: "inherit", cwd: FRONTEND_DIR, ...opts });
}

function loadEnv() {
  const env = { ...process.env };
  if (existsSync(ENV_FILE)) {
    const content = readFileSync(ENV_FILE, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
  }
  return env;
}

function maskUrl(url) {
  return url.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

async function main() {
  console.log("JBL BIZ LAW - Supabase database setup\n");

  const env = loadEnv();
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl || !databaseUrl.startsWith("postgresql://")) {
    console.error("DATABASE_URL is missing from frontend/.env.local.");
    console.error("");
    console.error("Add your Supabase Postgres connection string, for example:");
    console.error(
      "DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require",
    );
    console.error("");
    console.error("Then run: npm run db:setup");
    process.exit(1);
  }

  if (!databaseUrl.includes("supabase.com")) {
    console.warn("Warning: DATABASE_URL does not look like a Supabase URL.");
    console.warn("Continuing because any compatible Postgres URL can run the schema.");
  }

  console.log("DATABASE_URL found:");
  console.log(`  ${maskUrl(databaseUrl)}`);

  console.log("\nPushing Supabase migrations...");
  if (env.DATABASE_URL) {
    run(`supabase --workdir .. db push --db-url "${databaseUrl}"`, {
      env: { ...process.env, ...env },
    });
  } else {
    run("supabase --workdir .. db push", { env: { ...process.env, ...env } });
  }

  console.log("\nDatabase setup complete.");
  console.log("Next steps:");
  console.log("  1. Set AUTH_SECRET: npx auth secret");
  console.log("  2. Set SUPABASE_URL, SUPABASE_SECRET_KEY, and NEXT_PUBLIC_SUPABASE_*");
  console.log("  3. Set USER_API_KEYS_ENCRYPTION_SECRET");
  console.log("  4. Set R2 credentials for uploads");
  console.log("  5. Run: npm run db:seed");
  console.log("  6. Run: npm run dev");
}

main().catch((err) => {
  console.error("\nSetup failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
