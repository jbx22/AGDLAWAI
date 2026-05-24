import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/auth-helpers";
import { db } from "@/db";
import { userApiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { errorToResponse } from "@/lib/http-error";

const VALID_PROVIDERS = ["deepseek", "claude", "gemini", "openai"] as const;
type ApiKeyProvider = (typeof VALID_PROVIDERS)[number];

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

// PUT /api/user/api-keys/:provider — save or delete an API key
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { provider } = await params;

    if (!VALID_PROVIDERS.includes(provider as ApiKeyProvider)) {
      return NextResponse.json(
        { detail: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const apiKey = body?.apiKey?.trim() || null;

    // Delete existing key for this provider
    await db
      .delete(userApiKeys)
      .where(
        and(
          eq(userApiKeys.user_id, userId),
          eq(userApiKeys.provider, provider as ApiKeyProvider)
        )
      );

    if (apiKey) {
      // Encrypt and store the new key
      const { encrypted, iv, tag } = encrypt(apiKey);
      await db.insert(userApiKeys).values({
        user_id: userId,
        provider: provider as ApiKeyProvider,
        encrypted_key: encrypted,
        iv,
        auth_tag: tag,
      });
    }

    // Return updated status
    const hasEnvKey =
      (provider === "deepseek" && !!process.env.DEEPSEEK_API_KEY?.trim()) ||
      (provider === "claude" && !!process.env.ANTHROPIC_API_KEY?.trim()) ||
      (provider === "gemini" && !!process.env.GEMINI_API_KEY?.trim()) ||
      (provider === "openai" && !!process.env.OPENAI_API_KEY?.trim());

    return NextResponse.json({
      configured: hasEnvKey || !!apiKey,
      source: hasEnvKey ? "env" : apiKey ? "user" : null,
    });
  } catch (err: any) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("PUT /api/user/api-keys/:provider error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/user/api-keys/:provider — remove stored key
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { provider } = await params;

    if (!VALID_PROVIDERS.includes(provider as ApiKeyProvider)) {
      return NextResponse.json(
        { detail: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    await db
      .delete(userApiKeys)
      .where(
        and(
          eq(userApiKeys.user_id, userId),
          eq(userApiKeys.provider, provider as ApiKeyProvider)
        )
      );

    return NextResponse.json({ configured: false, source: null });
  } catch (err: any) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("DELETE /api/user/api-keys/:provider error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
