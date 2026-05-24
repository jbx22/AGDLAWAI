import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  adminAuditLogs,
  chats,
  documents,
  projects,
  subscriptions,
  tabularReviews,
  userProfiles,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { errorToResponse } from "@/lib/http-error";
import { desc, eq, sql } from "drizzle-orm";

const numberValue = (value: unknown) => Number(value ?? 0);

export async function GET() {
  try {
    const principal = await requireAdmin();

    const [counts] = await db
      .select({
        users: sql<number>`count(distinct ${users.id})`,
        activeUsers: sql<number>`count(distinct ${users.id}) filter (where ${userProfiles.account_status} = 'active')`,
        suspendedUsers: sql<number>`count(distinct ${users.id}) filter (where ${userProfiles.account_status} = 'suspended')`,
        admins: sql<number>`count(distinct ${users.id}) filter (where ${userProfiles.role} in ('admin', 'super_admin'))`,
        projects: sql<number>`(select count(*) from ${projects})`,
        documents: sql<number>`(select count(*) from ${documents})`,
        chats: sql<number>`(select count(*) from ${chats})`,
        tabularReviews: sql<number>`(select count(*) from ${tabularReviews})`,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.user_id, users.id));

    const tierRows = await db
      .select({
        tier: userProfiles.tier,
        count: sql<number>`count(*)`,
      })
      .from(userProfiles)
      .groupBy(userProfiles.tier);

    const [financials] = await db
      .select({
        paidSubscriptions: sql<number>`count(*) filter (where ${subscriptions.status} = 'paid')`,
        pendingSubscriptions: sql<number>`count(*) filter (where ${subscriptions.status} = 'pending')`,
        totalRevenueCents: sql<number>`coalesce(sum(${subscriptions.amount_cents}) filter (where ${subscriptions.status} = 'paid'), 0)`,
      })
      .from(subscriptions);

    const recentUsers = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.display_name,
        organisation: userProfiles.organisation,
        tier: userProfiles.tier,
        messageCreditsUsed: userProfiles.message_credits_used,
        role: userProfiles.role,
        accountStatus: userProfiles.account_status,
        createdAt: users.created_at,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.user_id, users.id))
      .orderBy(desc(users.created_at))
      .limit(12);

    const admins = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.display_name,
        role: userProfiles.role,
        accountStatus: userProfiles.account_status,
        updatedAt: userProfiles.updated_at,
      })
      .from(userProfiles)
      .innerJoin(users, eq(users.id, userProfiles.user_id))
      .where(sql`${userProfiles.role} in ('admin', 'super_admin')`)
      .orderBy(desc(userProfiles.updated_at));

    const auditLogs = await db
      .select({
        id: adminAuditLogs.id,
        actorEmail: adminAuditLogs.actor_email,
        action: adminAuditLogs.action,
        entityType: adminAuditLogs.entity_type,
        entityId: adminAuditLogs.entity_id,
        metadata: adminAuditLogs.metadata,
        createdAt: adminAuditLogs.created_at,
      })
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.created_at))
      .limit(25);

    return NextResponse.json({
      principal,
      counts: {
        users: numberValue(counts?.users),
        activeUsers: numberValue(counts?.activeUsers),
        suspendedUsers: numberValue(counts?.suspendedUsers),
        admins: numberValue(counts?.admins),
        projects: numberValue(counts?.projects),
        documents: numberValue(counts?.documents),
        chats: numberValue(counts?.chats),
        tabularReviews: numberValue(counts?.tabularReviews),
      },
      tiers: tierRows.map((row) => ({
        tier: row.tier || "Free",
        count: numberValue(row.count),
      })),
      financials: {
        paidSubscriptions: numberValue(financials?.paidSubscriptions),
        pendingSubscriptions: numberValue(financials?.pendingSubscriptions),
        totalRevenueCents: numberValue(financials?.totalRevenueCents),
        currency: "SAR",
      },
      recentUsers,
      admins,
      auditLogs,
    });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/admin/overview error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
