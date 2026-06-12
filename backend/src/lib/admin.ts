import { Request, Response, NextFunction } from "express";
import { createServerSupabase } from "./supabase";

export type AdminRole = "user" | "admin" | "super_admin";
export type AccountStatus = "active" | "suspended" | "deleted";

export type AdminPrincipal = {
  userId: string;
  email: string;
  role: "admin" | "super_admin";
  permissions: string[];
  jobs: string[];
};

export type AuthUserSummary = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

function isMissingAdminSchema(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "42703";
}

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
    .select("role, account_status, admin_access_enabled, last_admin_login_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const status = String(profile?.account_status ?? "active");
  if (status === "suspended" || status === "deleted") return null;
  if (profile?.admin_access_enabled === false) return null;

  const envRole = envRoleForEmail(email);
  const profileRole = String(profile?.role ?? "user");
  const role =
    envRole === "super_admin" || profileRole === "super_admin"
      ? "super_admin"
      : envRole === "admin" || profileRole === "admin"
        ? "admin"
        : "user";
  if (!isAdminRole(role)) return null;

  const permissions = await getAdminPermissions(userId, role);
  const jobs = await getAdminJobs(userId, role);
  await recordAdminLoginIfStale(userId, email, profile as any);
  return { userId, email, role, permissions, jobs };
}

async function recordAdminLoginIfStale(userId: string, email: string, profile: any) {
  const last = profile?.last_admin_login_at
    ? Date.parse(String(profile.last_admin_login_at))
    : 0;
  if (Number.isFinite(last) && Date.now() - last < 15 * 60 * 1000) return;
  const db = createServerSupabase();
  const { error: profileError } = await db.from("user_profiles").update({
    last_admin_login_at: new Date().toISOString(),
  }).eq("user_id", userId);
  if (profileError && !isMissingAdminSchema(profileError)) throw profileError;

  const { error: loginError } = await db.from("admin_login_events").insert({
    admin_user_id: userId,
    email,
    event_type: "login",
    success: true,
  });
  if (loginError && !isMissingAdminSchema(loginError)) throw loginError;
}

export async function getAdminPermissions(
  userId: string,
  role: "admin" | "super_admin",
): Promise<string[]> {
  if (role === "super_admin") {
    return [
      "users.read",
      "users.write",
      "users.suspend",
      "subscriptions.read",
      "subscriptions.write",
      "ai_usage.read",
      "ai_models.manage",
      "content.manage",
      "support.manage",
      "analytics.read",
      "audit.read",
      "settings.manage",
      "admins.read",
      "admins.write",
      "admins.delete",
      "rbac.manage",
    ];
  }

  const db = createServerSupabase();
  const { data, error } = await db
    .from("admin_role_assignments")
    .select("admin_roles(slug, admin_role_permissions(permission_id))")
    .eq("admin_user_id", userId);
  if (error) {
    // Older DBs before RBAC migration retain broad legacy admin read access.
    if (isMissingAdminSchema(error)) return ["users.read", "subscriptions.read"];
    throw error;
  }

  const out = new Set<string>();
  for (const row of data ?? []) {
    const roleRow = (row as any).admin_roles;
    for (const perm of roleRow?.admin_role_permissions ?? []) {
      if (typeof perm.permission_id === "string") out.add(perm.permission_id);
    }
  }
  return [...out];
}

async function getAdminJobs(userId: string, role: "admin" | "super_admin"): Promise<string[]> {
  if (role === "super_admin") return ["super-admin"];
  const db = createServerSupabase();
  const { data, error } = await db
    .from("admin_role_assignments")
    .select("admin_roles(slug)")
    .eq("admin_user_id", userId);
  if (error) {
    if (isMissingAdminSchema(error)) return [];
    throw error;
  }
  return (data ?? [])
    .map((row: any) => row.admin_roles?.slug)
    .filter((slug: unknown): slug is string => typeof slug === "string");
}

export function hasPermission(principal: AdminPrincipal, permission: string): boolean {
  return principal.role === "super_admin" || principal.permissions.includes(permission);
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const principal = res.locals.admin as AdminPrincipal | undefined;
    if (!principal || !hasPermission(principal, permission)) {
      res.status(403).json({ detail: `Permission required: ${permission}` });
      return;
    }
    next();
  };
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
  userAgent?: string | null;
  status?: "success" | "failure" | "blocked";
  module?: string;
}) {
  const db = createServerSupabase();
  const { error: auditError } = await db.from("admin_audit_logs").insert({
    actor_user_id: input.actor.userId,
    actor_email: input.actor.email,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    target_user_id: input.targetUserId ?? null,
    metadata: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
  });
  if (auditError) throw auditError;

  const { error: activityError } = await db.from("admin_activity_events").insert({
    admin_user_id: input.actor.userId,
    email: input.actor.email,
    action: input.action,
    module: input.module ?? input.entityType,
    target_type: input.entityType,
    target_id: input.entityId ?? null,
    status: input.status ?? "success",
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    metadata: input.metadata ?? {},
  });
  if (activityError && !isMissingAdminSchema(activityError)) throw activityError;
}

export function requestIp(req: Request): string | null {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.headers["x-real-ip"]?.toString() ||
    req.ip ||
    null
  );
}
