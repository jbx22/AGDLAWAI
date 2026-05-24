import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/auth-helpers";
import { db } from "@/db";
import { userApiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import type { ApiKeyStatus } from "@/app/lib/mikeApi";
import { errorToResponse } from "@/lib/http-error";

type ApiKeyProvider = "deepseek" | "claude" | "gemini" | "openai";

const ALGORITHM = "aes-256-gcm";
const ENV_KEY = (process.env.API_KEY_ENCRYPTION_KEY || process.env.AUTH_SECRET || "jbl-biz-law-fallback-encryption-key-32c").slice(0, 32);
const KEY_BUFFER = Buffer.from(ENV_KEY, "utf8");

function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return {
    encrypted,
    iv: iv.toString("hex"),
    tag: (cipher as any).getAuthTag().toString("hex"),
  };
}

function decrypt(encrypted: string, ivHex: string, tagHex: string): string {
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
  (decipher as any).setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// GET /api/user/api-keys — list all stored provider keys for the user
export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const rows = await db
      .select({
        provider: userApiKeys.provider,
      })
      .from(userApiKeys)
      .where(eq(userApiKeys.user_id, userId));

    const hasDeepSeekEnv = !!process.env.DEEPSEEK_API_KEY?.trim();
    const hasOpenAIEnv = !!process.env.OPENAI_API_KEY?.trim();
    const hasGeminiEnv = !!process.env.GEMINI_API_KEY?.trim();
    const hasClaudeEnv = !!process.env.ANTHROPIC_API_KEY?.trim();

    const stored = new Set(rows.map((r) => r.provider));

    const status: ApiKeyStatus = {
      deepseek: hasDeepSeekEnv || stored.has("deepseek"),
      claude: hasClaudeEnv || stored.has("claude"),
      gemini: hasGeminiEnv || stored.has("gemini"),
      openai: hasOpenAIEnv || stored.has("openai"),
      sources: {
        deepseek: hasDeepSeekEnv ? "env" : stored.has("deepseek") ? "user" : null,
        claude: hasClaudeEnv ? "env" : stored.has("claude") ? "user" : null,
        gemini: hasGeminiEnv ? "env" : stored.has("gemini") ? "user" : null,
        openai: hasOpenAIEnv ? "env" : stored.has("openai") ? "user" : null,
      },
    };

    return NextResponse.json(status);
  } catch (err: any) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/user/api-keys error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
