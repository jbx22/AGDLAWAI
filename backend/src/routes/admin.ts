import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getUserById,
  hasPermission,
  listAuthUsers,
  requestIp,
  requireAdmin,
  requirePermission,
  requireSuperAdmin,
  type AdminPrincipal,
  writeAdminLog,
} from "../lib/admin";
import { createServerSupabase } from "../lib/supabase";
import { BILLING_PLANS, SUBSCRIPTION_TIERS, nextPeriodEnd, normalizePlanId } from "../lib/billingPlans";

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
  const can = (permission: string) => hasPermission(principal, permission);
  const authUsers = await listAuthUsers();

  const { data: profilesRaw } = await db
    .from("user_profiles")
    .select("user_id, display_name, organisation, role, account_status, admin_access_enabled, message_credits_used, tier, suspension_reason, updated_at");
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
      adminAccessEnabled: p.admin_access_enabled !== false,
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
      adminAccessEnabled: u.adminAccessEnabled,
      suspensionReason: profileByUserId.get(u.id)?.suspension_reason ?? null,
      updatedAt: profileByUserId.get(u.id)?.updated_at ?? "",
    }));

  const { data: auditLogsRaw } = await db
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  const [{ data: rolesRaw }, { data: permissionsRaw }, { data: assignmentsRaw }, { data: loginEventsRaw }, { data: activityRaw }, { data: aiUsageRaw }, { data: supportRaw }, { data: contactRaw }] =
    await Promise.all([
      db.from("admin_roles").select("id, slug, name, description, is_system, admin_role_permissions(permission_id)").order("name"),
      db.from("admin_permissions").select("*").order("category"),
      db.from("admin_role_assignments").select("id, admin_user_id, role_id, assigned_at, expires_at"),
      db.from("admin_login_events").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("admin_activity_events").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("ai_usage_events").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("support_requests").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
  const [{ data: usageRaw }, { data: renewalRaw }, { data: paymentRaw }, { data: subAuditRaw }] =
    await Promise.all([
      db.from("subscription_usage_events").select("*").order("created_at", { ascending: false }).limit(250),
      db.from("subscription_renewal_events").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("subscription_payment_events").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("subscription_admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

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
    subscriptionPlans: Object.values(BILLING_PLANS),
    subscriptions: can("subscriptions.read") ? subs : [],
    subscriptionUsageEvents: can("subscriptions.read") || can("ai_usage.read") ? usageRaw ?? [] : [],
    subscriptionRenewalEvents: can("subscriptions.read") ? renewalRaw ?? [] : [],
    subscriptionPaymentEvents: can("subscriptions.read") ? paymentRaw ?? [] : [],
    subscriptionAdminAuditLogs: can("subscriptions.read") ? subAuditRaw ?? [] : [],
    recentUsers: can("users.read") ? recentUsers : [],
    admins: can("admins.read") ? admins : [],
    roles: can("admins.read") || can("rbac.manage") ? (rolesRaw ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description ?? null,
      isSystem: r.is_system === true,
      permissions: (r.admin_role_permissions ?? []).map((p: any) => p.permission_id),
    })) : [],
    permissions: can("rbac.manage") ? permissionsRaw ?? [] : [],
    roleAssignments: can("admins.read") || can("rbac.manage") ? assignmentsRaw ?? [] : [],
    loginEvents: can("audit.read") ? (loginEventsRaw ?? []).map((event: any) => ({
      id: event.id,
      adminUserId: event.admin_user_id,
      email: event.email,
      eventType: event.event_type,
      success: event.success,
      ipAddress: event.ip_address,
      userAgent: event.user_agent,
      createdAt: event.created_at,
    })) : [],
    activityEvents: can("audit.read") ? (activityRaw ?? []).map((event: any) => ({
      id: event.id,
      adminUserId: event.admin_user_id,
      email: event.email,
      action: event.action,
      module: event.module,
      targetType: event.target_type,
      targetId: event.target_id,
      status: event.status,
      ipAddress: event.ip_address,
      userAgent: event.user_agent,
      metadata: event.metadata ?? {},
      createdAt: event.created_at,
    })) : [],
    aiUsageEvents: can("ai_usage.read") ? aiUsageRaw ?? [] : [],
    supportRequests: can("support.manage") ? supportRaw ?? [] : [],
    contactMessages: can("support.manage") ? contactRaw ?? [] : [],
    auditLogs: can("audit.read") ? (auditLogsRaw ?? []).map((l: any) => ({
      id: l.id,
      actorEmail: l.actor_email ?? null,
      action: l.action,
      entityType: l.entity_type,
      entityId: l.entity_id ?? null,
      metadata: l.metadata ?? {},
      createdAt: l.created_at,
    })) : [],
  });
});

adminRouter.patch("/subscriptions/:userId", requireAdmin, requirePermission("subscriptions.write"), async (req, res) => {
  const principal = actor(res);
  const userId = req.params.userId;
  const planId = normalizePlanId(String(req.body?.planId ?? ""));
  const status = String(req.body?.status ?? "active");
  const allowedStatuses = new Set(["trialing", "active", "past_due", "grace_period", "suspended", "canceled", "free"]);
  if (!allowedStatuses.has(status)) {
    res.status(400).json({ detail: "Invalid subscription status" });
    return;
  }
  const plan = BILLING_PLANS[planId];
  const db = createServerSupabase();
  const { data: before } = await db
    .from("user_profiles")
    .select("tier, subscription_plan_id, subscription_status, account_status, subscription_current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date().toISOString();
  const nextEnd = planId === "free" || planId === "enterprise" ? null : nextPeriodEnd();
  const accountStatus = status === "suspended" ? "suspended" : "active";
  const { error } = await db.from("user_profiles").update({
    tier: plan.tier,
    subscription_plan_id: plan.id,
    subscription_status: status,
    subscription_current_period_end: nextEnd,
    subscription_grace_until: null,
    account_status: accountStatus,
    suspension_reason: status === "suspended" ? "Suspended by admin subscription action" : null,
    updated_at: now,
  }).eq("user_id", userId);
  if (error) {
    res.status(500).json({ detail: error.message });
    return;
  }
  const { data: sub } = await db.from("subscriptions").insert({
    user_id: userId,
    provider: "admin",
    plan_id: plan.id,
    tier: plan.tier,
    status,
    amount_cents: plan.amountHalalas,
    currency: "SAR",
    current_period_end: nextEnd,
    auto_renew: req.body?.autoRenew !== false,
    metadata: { changed_by: principal.email, source: "admin_dashboard" },
  }).select("id").single();
  await Promise.all([
    db.from("subscription_renewal_events").insert({
      user_id: userId,
      subscription_id: sub?.id ?? null,
      plan_id: plan.id,
      status: status === "suspended" ? "suspended" : "admin_changed",
      due_at: nextEnd,
      processed_at: now,
      metadata: { actor: principal.email },
    }),
    db.from("subscription_admin_audit_logs").insert({
      actor_user_id: principal.userId,
      actor_email: principal.email,
      target_user_id: userId,
      action: "subscription.updated",
      before_state: before ?? {},
      after_state: { plan_id: plan.id, tier: plan.tier, status, current_period_end: nextEnd },
      ip_address: requestIp(req),
    }),
  ]);
  await writeAdminLog({
    actor: principal,
    action: "subscription.updated",
    entityType: "subscription",
    entityId: userId,
    targetUserId: userId,
    metadata: { planId: plan.id, status },
    ipAddress: requestIp(req),
    module: "subscriptions",
  });
  res.json({ ok: true });
});

adminRouter.patch("/users/:userId", requireAdmin, requirePermission("users.write"), async (req, res) => {
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
  if ("adminAccessEnabled" in req.body) {
    update.admin_access_enabled = req.body.adminAccessEnabled === true;
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

adminRouter.post("/accounts", requireSuperAdmin, requirePermission("admins.write"), async (req, res) => {
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

adminRouter.patch("/accounts/:userId", requireSuperAdmin, requirePermission("admins.write"), async (req, res) => {
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
  if ("adminAccessEnabled" in req.body) {
    update.admin_access_enabled = req.body.adminAccessEnabled === true;
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

adminRouter.delete("/accounts/:userId", requireSuperAdmin, requirePermission("admins.delete"), async (req, res) => {
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

adminRouter.put("/accounts/:userId/roles", requireSuperAdmin, requirePermission("rbac.manage"), async (req, res) => {
  const principal = actor(res);
  const userId = req.params.userId;
  if (principal.userId === userId) {
    res.status(400).json({ detail: "Super admins cannot change their own role assignments here." });
    return;
  }
  const roleIds: string[] = Array.isArray(req.body?.roleIds)
    ? req.body.roleIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const db = createServerSupabase();
  const { error: deleteError } = await db
    .from("admin_role_assignments")
    .delete()
    .eq("admin_user_id", userId);
  if (deleteError) {
    res.status(500).json({ detail: deleteError.message });
    return;
  }
  if (roleIds.length > 0) {
    const { error: insertError } = await db.from("admin_role_assignments").insert(
      roleIds.map((roleId: string) => ({
        admin_user_id: userId,
        role_id: roleId,
        assigned_by: principal.userId,
      })),
    );
    if (insertError) {
      res.status(500).json({ detail: insertError.message });
      return;
    }
  }
  await writeAdminLog({
    actor: principal,
    action: "admin_roles.assigned",
    entityType: "admin_role_assignments",
    entityId: userId,
    targetUserId: userId,
    metadata: { roleIds },
    ipAddress: requestIp(req),
    userAgent: req.headers["user-agent"]?.toString() ?? null,
    module: "rbac",
  });
  res.json({ ok: true });
});

adminRouter.post("/accounts/:userId/password-reset", requireSuperAdmin, requirePermission("admins.write"), async (req, res) => {
  const principal = actor(res);
  const user = await getUserById(req.params.userId);
  if (!user?.email) {
    res.status(404).json({ detail: "Admin account not found" });
    return;
  }
  const db = createServerSupabase();
  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
  });
  if (error) {
    res.status(500).json({ detail: error.message });
    return;
  }
  await db.from("admin_login_events").insert({
    admin_user_id: req.params.userId,
    email: user.email,
    event_type: "password_reset_requested",
    success: true,
    ip_address: requestIp(req),
    user_agent: req.headers["user-agent"]?.toString() ?? null,
  });
  await writeAdminLog({
    actor: principal,
    action: "admin_password_reset.requested",
    entityType: "user",
    entityId: req.params.userId,
    targetUserId: req.params.userId,
    metadata: { email: user.email },
    ipAddress: requestIp(req),
    module: "admin-security",
  });
  res.json({ actionLink: data.properties?.action_link ?? null });
});

adminRouter.post("/accounts/:userId/logout", requireSuperAdmin, requirePermission("admins.write"), async (req, res) => {
  const principal = actor(res);
  const db = createServerSupabase();
  await db.from("admin_login_events").insert({
    admin_user_id: req.params.userId,
    event_type: "session_revoked",
    success: true,
    ip_address: requestIp(req),
    user_agent: req.headers["user-agent"]?.toString() ?? null,
  });
  await writeAdminLog({
    actor: principal,
    action: "admin_session.logout_requested",
    entityType: "user",
    entityId: req.params.userId,
    targetUserId: req.params.userId,
    ipAddress: requestIp(req),
    module: "admin-security",
  });
  res.json({ ok: true, detail: "Session logout has been logged. Supabase token revocation requires dashboard/API session controls." });
});
