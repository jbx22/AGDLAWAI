import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/db";
import {
  adminIp,
  envRoleForEmail,
  getUserById,
  requireAdmin,
  writeAdminLog,
} from "@/lib/admin";
import { errorToResponse } from "@/lib/http-error";

const STATUSES = new Set(["active", "suspended"]);
const TIERS = new Set(["Free", "Professional", "Business", "Enterprise"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { userId } = await params;
    const body = await req.json();

    // Fetch target user
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { detail: "User not found" },
        { status: 404 }
      );
    }

    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    const profileRole = targetProfile?.role ?? "user";
    const envRole = envRoleForEmail(user.email);
    const targetRole =
      envRole === "super_admin" || profileRole === "super_admin"
        ? "super_admin"
        : envRole === "admin" || profileRole === "admin"
          ? "admin"
          : "user";

    if (
      (targetRole === "admin" || targetRole === "super_admin") &&
      actor.role !== "super_admin"
    ) {
      return NextResponse.json(
        {
          detail:
            "Only super admins can modify admin users",
        },
        { status: 403 }
      );
    }
    if (actor.userId === userId) {
      return NextResponse.json(
        {
          detail:
            "Admins cannot modify their own account from this action",
        },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {};
    if ("accountStatus" in body) {
      const status = String(body.accountStatus ?? "active");
      if (!STATUSES.has(status)) {
        return NextResponse.json(
          { detail: "Invalid account status" },
          { status: 400 }
        );
      }
      update.account_status = status;
      update.suspension_reason =
        status === "suspended"
          ? String(body.suspensionReason ?? "").trim() ||
            "Suspended by admin"
          : null;
    }
    if ("tier" in body) {
      const tier = String(body.tier ?? "Free");
      if (!TIERS.has(tier)) {
        return NextResponse.json(
          { detail: "Invalid subscription tier" },
          { status: 400 }
        );
      }
      update.tier = tier;
    }
    if ("messageCreditsUsed" in body) {
      const credits = Number(body.messageCreditsUsed);
      if (!Number.isInteger(credits) || credits < 0) {
        return NextResponse.json(
          { detail: "Invalid credit usage value" },
          { status: 400 }
        );
      }
      update.message_credits_used = credits;
    }

    if (Object.keys(update).length <= 0) {
      return NextResponse.json(
        { detail: "No supported fields to update" },
        { status: 400 }
      );
    }

    update.updated_at = new Date().toISOString();

    await supabase
      .from("user_profiles")
      .update(update)
      .eq("user_id", userId);

    await writeAdminLog({
      actor,
      action: "user.updated",
      entityType: "user",
      entityId: userId,
      targetUserId: userId,
      metadata: {
        email: user.email,
        changed: Object.keys(update).filter(
          (key) => key !== "updated_at"
        ),
      },
      ipAddress: adminIp(req.headers),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("PATCH /api/admin/users/[userId] error:", err);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
