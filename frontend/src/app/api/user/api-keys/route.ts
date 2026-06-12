import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/auth-helpers";
import { getUserApiKeyStatus } from "@/lib/userApiKeys";
import { errorToResponse } from "@/lib/http-error";

// GET /api/user/api-keys — list all stored provider keys for the user
export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth();
    return NextResponse.json(await getUserApiKeyStatus(userId));
  } catch (err: any) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/user/api-keys error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
