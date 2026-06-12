import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/db";
import { adminIp, getUserById, requireSuperAdmin, writeAdminLog } from "@/lib/admin";
import { errorToResponse } from "@/lib/http-error";

const ADMIN_ROLES = new Set(["user", "admin", "super_admin"]);
const STATUSES = new Set(["active", "suspended"]);

async function getTarget(userId: string) {
  const user = await getUserById(userId);
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, role, account_status")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: user.displayName,
    role: profile?.role ?? "user",
    accountStatus: profile?.account_status ?? "active",
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireSuperAdmin();
    const { userId } = await params;
    const target = await getTarget(userId);
    if (!target) {
      return NextResponse.json(
        { detail: "Admin account not found" },
        { status: 404 }
      );
    }
    if (actor.userId === userId && target.role === "super_admin") {
      return NextResponse.json(
        {
          detail:
            "Super admins cannot demote or suspend themselves",
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const userUpdate: Record<string, unknown> = {};
    const profileUpdate: Record<string, unknown> = {};

    if ("displayName" in body) {
      const displayName = String(body.displayName ?? "").trim() || null;
      userUpdate.display_name = displayName;
      profileUpdate.display_name = displayName;
    }
    if ("role" in body) {
      const role = String(body.role ?? "user");
      if (!ADMIN_ROLES.has(role)) {
        return NextResponse.json({ detail: "Invalid role" }, { status: 400 });
      }
      profileUpdate.role = role;
    }
    if ("accountStatus" in body) {
      const status = String(body.accountStatus ?? "active");
      if (!STATUSES.has(status)) {
        return NextResponse.json(
          { detail: "Invalid account status" },
          { status: 400 }
        );
      }
      profileUpdate.account_status = status;
      profileUpdate.suspension_reason =
        status === "suspended"
          ? String(body.suspensionReason ?? "").trim() ||
            "Administrative suspension"
          : null;
    }
    if ("password" in body && String(body.password ?? "").length > 0) {
      const password = String(body.password);
      if (password.length < 10) {
        return NextResponse.json(
          {
            detail:
              "Temporary password must be at least 10 characters",
          },
          { status: 400 }
        );
      }
      // Update password via Supabase Auth Admin API
      const { error: authError } =
        await supabase.auth.admin.updateUserById(userId, {
          password,
        });
      if (authError) {
        console.error("Supabase update password error:", authError);
      }
      userUpdate.password_changed = true;
    }

    if ("display_name" in userUpdate) {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { display_name: userUpdate.display_name },
      });
    }
    if (Object.keys(profileUpdate).length > 0) {
      await supabase
        .from("user_profiles")
        .update({ updated_at: new Date().toISOString(), ...profileUpdate })
        .eq("user_id", userId);
    }

    await writeAdminLog({
      actor,
      action: "admin_account.updated",
      entityType: "user",
      entityId: userId,
      targetUserId: userId,
      metadata: {
        changed: Object.keys({ ...userUpdate, ...profileUpdate }).filter(
          (key) => key !== "password_changed"
        ),
      },
      ipAddress: adminIp(req.headers),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("PATCH /api/admin/accounts/[userId] error:", err);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireSuperAdmin();
    const { userId } = await params;
    const target = await getTarget(userId);
    if (!target) {
      return NextResponse.json(
        { detail: "Admin account not found" },
        { status: 404 }
      );
    }
    if (actor.userId === userId) {
      return NextResponse.json(
        { detail: "Super admins cannot delete themselves" },
        { status: 400 }
      );
    }

    await writeAdminLog({
      actor,
      action: "admin_account.deleted",
      entityType: "user",
      entityId: userId,
      targetUserId: userId,
      metadata: {
        email: target.email,
        previousRole: target.role,
      },
      ipAddress: adminIp(req.headers),
    });

    // Delete from Supabase Auth
    const { error: authErr } =
      await supabase.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("Supabase delete user error:", authErr);
    }

    // Delete profile (cascade should handle users table)
    await supabase.from("user_profiles").delete().eq("user_id", userId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("DELETE /api/admin/accounts/[userId] error:", err);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
