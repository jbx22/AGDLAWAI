import { Request, Response, NextFunction } from "express";
import { createServerSupabase } from "./supabase";

export type AdminRole = "user" | "admin" | "super_admin";
export type AccountStatus = "active" | "suspended" | "deleted";

export type AdminPrincipal = {
  userId: string;
  email: string;
  role: "admin" | "super_admin";
};

export type AuthUserSummary = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

function parseEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function superAdminEmails(): string[] {
  return [
    ...parseEmails(process.env.SUPER_ADMIN_EMAIL),
    ...parseEmails(process.env.SUPER_ADMIN_EMAILS),
  ];
}

export function envRoleForEmail(email: string | null | undefined): AdminRole | null {
  const normalized = (email ?? "").toLowerCase();
  if (!normalized) return null;
  if (superAdminEmails().includes(normalized)) return "super_admin";
  if (parseEmails(process.env.ADMIN_EMAILS).includes(normalized)) return "admin";
  return null;
}

export function isAdminRole(role: string | null | undefined): role is "admin" | "super_admin" {
  return role === "admin" || role === "super_admin";
}

export async function getAdminPrincipal(userId: string, email: string): Promise<AdminPrincipal | null> {
  const db = createServerSupabase();
  const { data: profile, error } = await db
    .from("user_profiles")
    .select("role, account_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const status = String(profile?.account_status ?? "active");
  if (status === "suspended" || status === "deleted") return null;

  const envRole = envRoleForEmail(email);
  const profileRole = String(profile?.role ?? "user");
  const role =
    envRole === "super_admin" || profileRole === "super_admin"
      ? "super_admin"
      : envRole === "admin" || profileRole === "admin"
        ? "admin"
        : "user";
  return isAdminRole(role) ? { userId, email, role } : null;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const principal = await getAdminPrincipal(
      String(res.locals.userId ?? ""),
      String(res.locals.userEmail ?? ""),
    );
    if (!principal) {
      res.status(403).json({ detail: "Admin access required" });
      return;
    }
    res.locals.admin = principal;
    next();
  } catch (error) {
    res.status(500).json({
      detail: error instanceof Error ? error.message : "Admin lookup failed",
    });
  }
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAdmin(req, res, () => {
    const principal = res.locals.admin as AdminPrincipal | undefined;
    if (principal?.role !== "super_admin") {
      res.status(403).json({ detail: "Super admin access required" });
      return;
    }
    next();
  });
}

export function summarizeAuthUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> | null;
  created_at?: string;
}): AuthUserSummary {
  const displayName = user.user_metadata?.display_name;
  return {
    id: user.id,
    email: user.email?.toLowerCase() ?? "",
    displayName:
      typeof displayName === "string" && displayName.trim() ? displayName : null,
    createdAt: user.created_at ?? "",
  };
}

export async function listAuthUsers(): Promise<AuthUserSummary[]> {
  const db = createServerSupabase();
  const perPage = 1000;
  const users: AuthUserSummary[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users ?? [];
    users.push(...batch.map(summarizeAuthUser));
    if (batch.length < perPage) break;
  }
  return users;
}

export async function getUserById(userId: string): Promise<AuthUserSummary | null> {
  const db = createServerSupabase();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return summarizeAuthUser(data.user);
}

export async function writeAdminLog(input: {
  actor: AdminPrincipal;
  action: string;
  entityType: string;
  entityId?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  const db = createServerSupabase();
  await db.from("admin_audit_logs").insert({
    actor_user_id: input.actor.userId,
    actor_email: input.actor.email,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    target_user_id: input.targetUserId ?? null,
    metadata: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
  });
}

export function requestIp(req: Request): string | null {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.headers["x-real-ip"]?.toString() ||
    req.ip ||
    null
  );
}
