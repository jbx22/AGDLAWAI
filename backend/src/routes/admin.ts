import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getUserById,
  listAuthUsers,
  requestIp,
  requireAdmin,
  requireSuperAdmin,
  type AdminPrincipal,
  writeAdminLog,
} from "../lib/admin";
import { createServerSupabase } from "../lib/supabase";
import { SUBSCRIPTION_TIERS } from "../lib/billingPlans";

export const adminRouter = Router();

const ROLES = new Set(["user", "admin", "super_admin"]);
const ADMIN_ROLES = new Set(["admin", "super_admin"]);
const STATUSES = new Set(["active", "suspended"]);

function numberValue(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function actor(res: import("express").Response): AdminPrincipal {
  return res.locals.admin as AdminPrincipal;
}

adminRouter.use(requireAuth);

adminRouter.get("/overview", requireAdmin, async (_req, res) => {
  const db = createServerSupabase();
  const principal = actor(res);
  const authUsers = await listAuthUsers();

  const { data: profilesRaw } = await db
    .from("user_profiles")
    .select("user_id, display_name, organisation, role, account_status, message_credits_used, tier, suspension_reason, updated_at");
  const profiles = profilesRaw ?? [];
  const profileByUserId = new Map<string, any>(profiles.map((p: any) => [p.user_id, p]));

  const [{ count: projects }, { count: documents }, { count: chats }, { count: tabularReviews }] =
    await Promise.all([
      db.from("projects").select("*", { count: "exact", head: true }),
      db.from("documents").select("*", { count: "exact", head: true }),
      db.from("chats").select("*", { count: "exact", head: true }),
      db.from("tabular_reviews").select("*", { count: "exact", head: true }),
    ]);

  const { data: subsRaw } = await db.from("subscriptions").select("*");
  const subs = subsRaw ?? [];
  const paidSubs = subs.filter((s: any) => s.status === "paid" || s.status === "active");
  const pendingSubs = subs.filter((s: any) => s.status === "pending");
  const totalRevenueCents = paidSubs.reduce((sum: number, s: any) => sum + numberValue(s.amount_cents), 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const recentPaidSubs = paidSubs.filter((s: any) => String(s.created_at ?? "") >= thirtyDaysAgo);
  const revenue30dCents = recentPaidSubs.reduce((sum: number, s: any) => sum + numberValue(s.amount_cents), 0);

  const recentUsers = authUsers
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50)
    .map((u) => {
      const p = profileByUserId.get(u.id) ?? {};
      return {
        id: u.id,
        email: u.email,
        displayName: p.display_name ?? u.displayName,
        organisation: p.organisation ?? null,
        tier: p.tier ?? "Free",
        messageCreditsUsed: p.message_credits_used ?? 0,
        role: p.role ?? "user",
        accountStatus: p.account_status ?? "active",
        createdAt: u.createdAt,
      };
    })
    .filter((u) => principal.role === "super_admin" || u.role !== "super_admin");

  const admins = recentUsers
    .filter((u) => u.role === "admin" || u.role === "super_admin")
    .map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      accountStatus: u.accountStatus,
      suspensionReason: profileByUserId.get(u.id)?.suspension_reason ?? null,
      updatedAt: profileByUserId.get(u.id)?.updated_at ?? "",
    }));

  const { data: auditLogsRaw } = await db
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);

  const tierMap: Record<string, number> = {};
  for (const p of profiles as any[]) {
    const tier = p.tier || "Free";
    tierMap[tier] = (tierMap[tier] || 0) + 1;
  }

  res.json({
    principal,
    counts: {
      users: authUsers.length,
      activeUsers: profiles.filter((p: any) => (p.account_status ?? "active") === "active").length,
      suspendedUsers: profiles.filter((p: any) => p.account_status === "suspended").length,
      admins: profiles.filter((p: any) => p.role === "admin" || p.role === "super_admin").length,
      projects: projects ?? 0,
      documents: documents ?? 0,
      chats: chats ?? 0,
      tabularReviews: tabularReviews ?? 0,
      aiCreditsUsed: profiles.reduce((sum: number, p: any) => sum + numberValue(p.message_credits_used), 0),
    },
    tiers: Object.entries(tierMap).map(([tier, count]) => ({ tier, count })),
    financials: {
      paidSubscriptions: paidSubs.length,
      pendingSubscriptions: pendingSubs.length,
      activeSubscriptions: paidSubs.length,
      totalRevenueCents,
      revenue30dCents,
      payingUsers: new Set(paidSubs.map((s: any) => s.user_id).filter(Boolean)).size,
      averageRevenuePerPaidUserCents:
        paidSubs.length > 0 ? Math.round(totalRevenueCents / paidSubs.length) : 0,
      currency: "SAR",
    },
    recentUsers,
    admins,
    auditLogs: (auditLogsRaw ?? []).map((l: any) => ({
      id: l.id,
      actorEmail: l.actor_email ?? null,
      action: l.action,
      entityType: l.entity_type,
      entityId: l.entity_id ?? null,
      metadata: l.metadata ?? {},
      createdAt: l.created_at,
    })),
  });
});

adminRouter.patch("/users/:userId", requireAdmin, async (req, res) => {
  const principal = actor(res);
  const userId = req.params.userId;
  if (principal.userId === userId) {
    res.status(400).json({ detail: "Admins cannot modify their own account here." });
    return;
  }
  const db = createServerSupabase();
  const user = await getUserById(userId);
  if (!user) {
    res.status(404).json({ detail: "User not found" });
    return;
  }
  const { data: targetProfile } = await db
    .from("user_profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const targetRole = String(targetProfile?.role ?? "user");
  if ((targetRole === "admin" || targetRole === "super_admin") && principal.role !== "super_admin") {
    res.status(403).json({ detail: "Only super admins can modify admin users." });
    return;
  }

  const update: Record<string, unknown> = {};
  if ("accountStatus" in req.body) {
    const status = String(req.body.accountStatus ?? "active");
    if (!STATUSES.has(status)) {
      res.status(400).json({ detail: "Invalid account status" });
      return;
    }
    update.account_status = status;
    update.suspension_reason =
      status === "suspended"
        ? String(req.body.suspensionReason ?? "").trim() || "Suspended by admin"
        : null;
  }
  if ("tier" in req.body) {
    const tier = String(req.body.tier ?? "Free");
    if (!SUBSCRIPTION_TIERS.has(tier)) {
      res.status(400).json({ detail: "Invalid subscription tier" });
      return;
    }
    update.tier = tier;
  }
  if ("messageCreditsUsed" in req.body) {
    const credits = Number(req.body.messageCreditsUsed);
    if (!Number.isInteger(credits) || credits < 0) {
      res.status(400).json({ detail: "Invalid credit usage value" });
      return;
    }
    update.message_credits_used = credits;
  }
  if (Object.keys(update).length === 0) {
    res.status(400).json({ detail: "No supported fields to update" });
    return;
  }

  const { error } = await db
    .from("user_profiles")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) {
    res.status(500).json({ detail: error.message });
    return;
  }

  await writeAdminLog({
    actor: principal,
    action: "user.updated",
    entityType: "user",
    entityId: userId,
    targetUserId: userId,
    metadata: { email: user.email, changed: Object.keys(update) },
    ipAddress: requestIp(req),
  });
  res.json({ ok: true });
});

adminRouter.post("/accounts", requireSuperAdmin, async (req, res) => {
  const principal = actor(res);
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const displayName = String(req.body?.displayName ?? "").trim() || null;
  const password = String(req.body?.password ?? "");
  const role = String(req.body?.role ?? "admin");
  if (!email.includes("@")) {
    res.status(400).json({ detail: "Valid email is required" });
    return;
  }
  if (!ADMIN_ROLES.has(role)) {
    res.status(400).json({ detail: "Role must be admin or super_admin" });
    return;
  }
  if (password.length < 10) {
    res.status(400).json({ detail: "Temporary password must be at least 10 characters" });
    return;
  }

  const db = createServerSupabase();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) {
    res.status(500).json({ detail: error?.message || "Failed to create user" });
    return;
  }

  await db.from("user_profiles").upsert({
    user_id: data.user.id,
    display_name: displayName,
    role,
    account_status: "active",
    tabular_model: "deepseek-v4-flash",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  await writeAdminLog({
    actor: principal,
    action: "admin_account.created",
    entityType: "user",
    entityId: data.user.id,
    targetUserId: data.user.id,
    metadata: { email, role },
    ipAddress: requestIp(req),
  });

  res.status(201).json({ id: data.user.id, email, role });
});

adminRouter.patch("/accounts/:userId", requireSuperAdmin, async (req, res) => {
  const principal = actor(res);
  const userId = req.params.userId;
  if (principal.userId === userId) {
    res.status(400).json({ detail: "Super admins cannot change their own admin role/status here." });
    return;
  }
  const db = createServerSupabase();
  const update: Record<string, unknown> = {};
  if ("displayName" in req.body) {
    update.display_name = String(req.body.displayName ?? "").trim() || null;
  }
  if ("role" in req.body) {
    const role = String(req.body.role ?? "user");
    if (!ROLES.has(role)) {
      res.status(400).json({ detail: "Invalid role" });
      return;
    }
    update.role = role;
  }
  if ("accountStatus" in req.body) {
    const status = String(req.body.accountStatus ?? "active");
    if (!STATUSES.has(status)) {
      res.status(400).json({ detail: "Invalid account status" });
      return;
    }
    update.account_status = status;
    update.suspension_reason =
      status === "suspended"
        ? String(req.body.suspensionReason ?? "").trim() || "Administrative suspension"
        : null;
  }
  if (String(req.body?.password ?? "").length > 0) {
    const password = String(req.body.password);
    if (password.length < 10) {
      res.status(400).json({ detail: "Temporary password must be at least 10 characters" });
      return;
    }
    const { error } = await db.auth.admin.updateUserById(userId, { password });
    if (error) {
      res.status(500).json({ detail: error.message });
      return;
    }
  }
  if ("display_name" in update) {
    await db.auth.admin.updateUserById(userId, {
      user_metadata: { display_name: update.display_name },
    });
  }
  if (Object.keys(update).length > 0) {
    const { error } = await db
      .from("user_profiles")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) {
      res.status(500).json({ detail: error.message });
      return;
    }
  }
  await writeAdminLog({
    actor: principal,
    action: "admin_account.updated",
    entityType: "user",
    entityId: userId,
    targetUserId: userId,
    metadata: { changed: Object.keys(update) },
    ipAddress: requestIp(req),
  });
  res.json({ ok: true });
});

adminRouter.delete("/accounts/:userId", requireSuperAdmin, async (req, res) => {
  const principal = actor(res);
  const userId = req.params.userId;
  if (principal.userId === userId) {
    res.status(400).json({ detail: "Super admins cannot delete themselves." });
    return;
  }
  const db = createServerSupabase();
  await writeAdminLog({
    actor: principal,
    action: "admin_account.deleted",
    entityType: "user",
    entityId: userId,
    targetUserId: userId,
    ipAddress: requestIp(req),
  });
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    res.status(500).json({ detail: error.message });
    return;
  }
  res.json({ ok: true });
});
