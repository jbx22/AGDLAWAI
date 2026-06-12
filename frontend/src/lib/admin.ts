/**
 * Admin helpers — Supabase-backed.
 *
 * Replaces the old Drizzle admin utilities with real Supabase REST queries
 * using the service_role client from @/db.
 */

import { supabase } from "@/db";
import { auth } from "@/lib/auth";
import { jsonHttpError } from "@/lib/http-error";
import type { User } from "@supabase/supabase-js";

export type AdminRole = "user" | "admin" | "super_admin";
export type AccountStatus = "active" | "suspended" | "deleted";

export interface AdminPrincipal {
  userId: string;
  email: string;
  role: AdminRole;
}

export interface AuthUserSummary {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

const SUPER_ADMIN_ENV = "SUPER_ADMIN_EMAILS";
const ADMIN_ENV = "ADMIN_EMAILS";

function parseEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function envRoleForEmail(
  email: string | null | undefined
): AdminRole | null {
  const normalized = (email ?? "").toLowerCase();
  if (!normalized) return null;
  if (parseEmails(process.env[SUPER_ADMIN_ENV]).includes(normalized)) {
    return "super_admin";
  }
  if (parseEmails(process.env[ADMIN_ENV]).includes(normalized)) {
    return "admin";
  }
  return null;
}

export function isAdminRole(
  role: string | null | undefined
): role is "admin" | "super_admin" {
  return role === "admin" || role === "super_admin";
}

export async function getAdminPrincipal(): Promise<AdminPrincipal | null> {
  const session = await auth();
  const userId = (session?.user?.id as string | undefined) ?? "";
  const email = ((session?.user?.email as string | undefined) ?? "").toLowerCase();
  if (!userId || !email) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, account_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    profile?.account_status === "suspended" ||
    profile?.account_status === "deleted"
  ) {
    return null;
  }

  const envRole = envRoleForEmail(email);
  const profileRole = profile?.role as AdminRole | undefined;
  const role =
    envRole === "super_admin" || profileRole === "super_admin"
      ? "super_admin"
      : envRole === "admin" || profileRole === "admin"
        ? "admin"
        : "user";

  if (!isAdminRole(role)) return null;
  return { userId, email, role };
}

export async function requireAdmin(): Promise<AdminPrincipal> {
  const principal = await getAdminPrincipal();
  if (!principal) {
    throw jsonHttpError("Admin access required", 403);
  }
  return principal;
}

export async function requireSuperAdmin(): Promise<AdminPrincipal> {
  const principal = await requireAdmin();
  if (principal.role !== "super_admin") {
    throw jsonHttpError("Super admin access required", 403);
  }
  return principal;
}

export async function ensureProfile(
  userId: string,
  defaults?: Record<string, unknown>
) {
  const { data: existing } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return;

  await supabase.from("user_profiles").insert({
    user_id: userId,
    tabular_model: "deepseek-v4-flash",
    ...defaults,
  });
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
  await supabase.from("admin_audit_logs").insert({
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

function displayNameForAuthUser(user: User): string | null {
  const metadata = user.user_metadata as Record<string, unknown> | null;
  const displayName = metadata?.display_name;
  return typeof displayName === "string" && displayName.trim()
    ? displayName
    : null;
}

export function summarizeAuthUser(user: User): AuthUserSummary {
  return {
    id: user.id,
    email: user.email?.toLowerCase() ?? "",
    displayName: displayNameForAuthUser(user),
    createdAt: user.created_at ?? "",
  };
}

export async function listAuthUsers(): Promise<AuthUserSummary[]> {
  const perPage = 1000;
  const users: AuthUserSummary[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const batch = data?.users ?? [];
    users.push(...batch.map(summarizeAuthUser));
    if (batch.length < perPage) break;
  }

  return users;
}

export async function getUsersByIds(userIds: string[]) {
  const wanted = new Set(userIds);
  if (wanted.size === 0) return [];
  const users = await listAuthUsers();
  return users.filter((user) => wanted.has(user.id));
}

export async function getUserById(userId: string) {
  const [user] = await getUsersByIds([userId]);
  return user ?? null;
}

export async function getUsersByEmails(emails: string[]) {
  const wanted = new Set(emails.map((email) => email.toLowerCase()));
  if (wanted.size === 0) return [];
  const users = await listAuthUsers();
  return users.filter((user) => wanted.has(user.email));
}

export function adminIp(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")
  );
}

export function canChangeAdmin(
  actor: AdminPrincipal,
  target: { user_id: string; role: string }
) {
  if (actor.role !== "super_admin") return false;
  if (actor.userId === target.user_id && target.role === "super_admin")
    return false;
  return true;
}

export const activeAdminWhere = {
  role: ["admin", "super_admin"],
  account_status: "active",
};
