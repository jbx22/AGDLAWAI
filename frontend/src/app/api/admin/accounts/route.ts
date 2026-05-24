import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { userProfiles, users } from "@/db/schema";
import { adminIp, requireSuperAdmin, writeAdminLog } from "@/lib/admin";
import { errorToResponse } from "@/lib/http-error";
import { desc, eq, sql } from "drizzle-orm";

const DEFAULT_TABULAR_MODEL = "deepseek-v4-flash";
const ADMIN_ROLES = new Set(["admin", "super_admin"]);

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.createHash("sha256").update(password + salt).digest("hex");
  return { salt, passwordHash };
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.display_name,
        role: userProfiles.role,
        accountStatus: userProfiles.account_status,
        suspensionReason: userProfiles.suspension_reason,
        createdAt: users.created_at,
        updatedAt: userProfiles.updated_at,
      })
      .from(userProfiles)
      .innerJoin(users, eq(users.id, userProfiles.user_id))
      .where(sql`${userProfiles.role} in ('admin', 'super_admin')`)
      .orderBy(desc(userProfiles.updated_at));

    return NextResponse.json(rows);
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/admin/accounts error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.displayName ?? "").trim() || null;
    const password = String(body.password ?? "");
    const role = String(body.role ?? "admin");

    if (!email || !email.includes("@")) {
      return NextResponse.json({ detail: "Valid email is required" }, { status: 400 });
    }
    if (!ADMIN_ROLES.has(role)) {
      return NextResponse.json({ detail: "Role must be admin or super_admin" }, { status: 400 });
    }
    if (password.length < 10) {
      return NextResponse.json({ detail: "Temporary password must be at least 10 characters" }, { status: 400 });
    }

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ detail: "Email already exists" }, { status: 409 });
    }

    const { salt, passwordHash } = hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        email,
        display_name: displayName,
        password_hash: passwordHash,
        password_salt: salt,
      })
      .returning({ id: users.id, email: users.email });

    await db.insert(userProfiles).values({
      user_id: created.id,
      display_name: displayName,
      role,
      account_status: "active",
      tabular_model: DEFAULT_TABULAR_MODEL,
    });

    await writeAdminLog({
      actor,
      action: "admin_account.created",
      entityType: "user",
      entityId: created.id,
      targetUserId: created.id,
      metadata: { email, role },
      ipAddress: adminIp(req.headers),
    });

    return NextResponse.json({ id: created.id, email: created.email, role }, { status: 201 });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("POST /api/admin/accounts error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
