import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/auth-helpers";
import {
  hasEnvApiKey,
  normalizeApiKeyProvider,
  saveUserApiKey,
} from "@/lib/userApiKeys";
import { errorToResponse } from "@/lib/http-error";

// PUT /api/user/api-keys/:provider — save or delete an API key
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { provider: providerParam } = await params;
    const provider = normalizeApiKeyProvider(providerParam);

    if (!provider) {
      return NextResponse.json(
        { detail: `Invalid provider: ${providerParam}` },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const apiKey = body?.apiKey?.trim() || null;

    await saveUserApiKey(userId, provider, apiKey);

    return NextResponse.json({
      configured: hasEnvApiKey(provider) || !!apiKey,
      source: hasEnvApiKey(provider) ? "env" : apiKey ? "user" : null,
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
    const { provider: providerParam } = await params;
    const provider = normalizeApiKeyProvider(providerParam);

    if (!provider) {
      return NextResponse.json(
        { detail: `Invalid provider: ${providerParam}` },
        { status: 400 }
      );
    }

    await saveUserApiKey(userId, provider, null);

    return NextResponse.json({
      configured: hasEnvApiKey(provider),
      source: hasEnvApiKey(provider) ? "env" : null,
    });
  } catch (err: any) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("DELETE /api/user/api-keys/:provider error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
