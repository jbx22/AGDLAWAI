import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { userProfiles, users } from "@/db/schema";
import { adminIp, requireSuperAdmin, writeAdminLog } from "@/lib/admin";
import { errorToResponse } from "@/lib/http-error";
import { eq } from "drizzle-orm";

const ADMIN_ROLES = new Set(["user", "admin", "super_admin"]);
const STATUSES = new Set(["active", "suspended"]);

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.createHash("sha256").update(password + salt).digest("hex");
  return { salt, passwordHash };
}

async function getTarget(userId: string) {
  const [target] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.display_name,
      role: userProfiles.role,
      accountStatus: userProfiles.account_status,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.user_id, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return target;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireSuperAdmin();
    const { userId } = await params;
    const target = await getTarget(userId);
    if (!target) {
      return NextResponse.json({ detail: "Admin account not found" }, { status: 404 });
    }
    if (actor.userId === userId && target.role === "super_admin") {
      return NextResponse.json({ detail: "Super admins cannot demote or suspend themselves" }, { status: 400 });
    }

    const body = await req.json();
    const userUpdate: Record<string, unknown> = { updated_at: new Date() };
    const profileUpdate: Record<string, unknown> = { updated_at: new Date() };

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
        return NextResponse.json({ detail: "Invalid account status" }, { status: 400 });
      }
      profileUpdate.account_status = status;
      profileUpdate.suspension_reason =
        status === "suspended" ? String(body.suspensionReason ?? "").trim() || "Administrative suspension" : null;
    }
    if ("password" in body && String(body.password ?? "").length > 0) {
      const password = String(body.password);
      if (password.length < 10) {
        return NextResponse.json({ detail: "Temporary password must be at least 10 characters" }, { status: 400 });
      }
      const { salt, passwordHash } = hashPassword(password);
      userUpdate.password_hash = passwordHash;
      userUpdate.password_salt = salt;
    }

    if (Object.keys(userUpdate).length > 1) {
      await db.update(users).set(userUpdate).where(eq(users.id, userId));
    }
    if (Object.keys(profileUpdate).length > 1) {
      await db.update(userProfiles).set(profileUpdate).where(eq(userProfiles.user_id, userId));
    }

    await writeAdminLog({
      actor,
      action: "admin_account.updated",
      entityType: "user",
      entityId: userId,
      targetUserId: userId,
      metadata: {
        changed: Object.keys({ ...userUpdate, ...profileUpdate }).filter((key) => key !== "updated_at"),
      },
      ipAddress: adminIp(req.headers),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("PATCH /api/admin/accounts/[userId] error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireSuperAdmin();
    const { userId } = await params;
    const target = await getTarget(userId);
    if (!target) {
      return NextResponse.json({ detail: "Admin account not found" }, { status: 404 });
    }
    if (actor.userId === userId) {
      return NextResponse.json({ detail: "Super admins cannot delete themselves" }, { status: 400 });
    }

    await writeAdminLog({
      actor,
      action: "admin_account.deleted",
      entityType: "user",
      entityId: userId,
      targetUserId: userId,
      metadata: { email: target.email, previousRole: target.role },
      ipAddress: adminIp(req.headers),
    });
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("DELETE /api/admin/accounts/[userId] error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
