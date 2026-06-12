import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/db";
import { adminIp, getUsersByIds, requireSuperAdmin, writeAdminLog } from "@/lib/admin";
import { errorToResponse } from "@/lib/http-error";

const DEFAULT_TABULAR_MODEL = "deepseek-v4-flash";
const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export async function GET() {
  try {
    await requireSuperAdmin();
    // Fetch all admin profiles
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, role, account_status, suspension_reason, updated_at")
      .in("role", ["admin", "super_admin"])
      .order("updated_at", { ascending: false });

    const userIds = (profiles ?? []).map((p) => p.user_id);
    const userData = await getUsersByIds(userIds);

    const usersById: Record<string, any> = {};
    for (const u of userData) {
      usersById[u.id] = u;
    }

    const rows = (profiles ?? []).map((p) => {
      const u = usersById[p.user_id] ?? {};
      return {
        id: p.user_id,
        email: u.email ?? "",
        displayName: u.displayName ?? null,
        role: p.role,
        accountStatus: p.account_status,
        suspensionReason: p.suspension_reason ?? null,
        createdAt: u.createdAt ?? "",
        updatedAt: p.updated_at ?? "",
      };
    });

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
      return NextResponse.json(
        { detail: "Temporary password must be at least 10 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );
    if (existing) {
      return NextResponse.json({ detail: "Email already exists" }, { status: 409 });
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (error || !data.user) {
      return NextResponse.json(
        { detail: error?.message || "Failed to create user" },
        { status: 500 }
      );
    }

    // Create profile
    await supabase.from("user_profiles").insert({
      user_id: data.user.id,
      display_name: displayName,
      role,
      account_status: "active",
      tabular_model: DEFAULT_TABULAR_MODEL,
    });

    await writeAdminLog({
      actor,
      action: "admin_account.created",
      entityType: "user",
      entityId: data.user.id,
      targetUserId: data.user.id,
      metadata: { email, role },
      ipAddress: adminIp(req.headers),
    });

    return NextResponse.json(
      { id: data.user.id, email, role },
      { status: 201 }
    );
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("POST /api/admin/accounts error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
