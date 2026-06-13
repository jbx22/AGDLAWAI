import { createServerSupabase } from "./supabase";
import {
  BILLING_PLANS,
  type BillingPlan,
  type BillingPlanId,
  type UsageMetric,
  normalizePlanId,
  planIdForTier,
  trialEnd,
} from "./billingPlans";

type Db = ReturnType<typeof createServerSupabase>;

export type Entitlement = {
  userId: string;
  plan: BillingPlan;
  status: string;
  isTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
  autoRenew: boolean;
  usage: Record<UsageMetric, number>;
  dailyAiQuestionsUsed: number;
};

export type MaintenanceResult = {
  checked: number;
  trialExpired: number;
  graceStarted: number;
  suspended: number;
  renewalDue: number;
  autoRenewDisabled: number;
};

export type QuotaCheck =
  | { ok: true; entitlement: Entitlement }
  | {
      ok: false;
      status: number;
      code: string;
      detail: string;
      entitlement: Entitlement;
    };

const METRICS: UsageMetric[] = [
  "analyses",
  "summaries",
  "uploads",
  "ai_questions",
  "tokens",
];

function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function isMissingSubscriptionSchema(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "42703";
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function quotaExceededResponse(detail: string, entitlement: Entitlement): QuotaCheck {
  return {
    ok: false,
    status: 402,
    code: "subscription_quota_exceeded",
    detail,
    entitlement,
  };
}

async function maybeBootstrapTrial(userId: string, db: Db) {
  const now = new Date();
  const trialEnds = trialEnd(now);
  await db
    .from("user_profiles")
    .update({
      subscription_plan_id: "professional",
      subscription_status: "trialing",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds,
      subscription_current_period_end: trialEnds,
      tier: "Professional",
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId)
    .is("trial_started_at", null);
}

async function maybeExpireTrial(
  userId: string,
  profile: any,
  db: Db,
): Promise<any> {
  const status = String(profile?.subscription_status ?? "");
  const trialEndsAt = profile?.trial_ends_at ? Date.parse(String(profile.trial_ends_at)) : 0;
  if (status !== "trialing" || !trialEndsAt || Date.now() <= trialEndsAt) return profile;

  const now = new Date().toISOString();
  await db
    .from("user_profiles")
    .update({
      tier: "Free",
      subscription_plan_id: "free",
      subscription_status: "free",
      subscription_current_period_end: null,
      subscription_grace_until: null,
      updated_at: now,
    })
    .eq("user_id", userId);
  await db.from("subscription_renewal_events").insert({
    user_id: userId,
    plan_id: "professional",
    status: "trial_expired",
    due_at: profile.trial_ends_at,
    processed_at: now,
    metadata: { downgraded_to: "free" },
  });
  return {
    ...profile,
    tier: "Free",
    subscription_plan_id: "free",
    subscription_status: "free",
    subscription_current_period_end: null,
    subscription_grace_until: null,
  };
}

async function maybeApplyGraceOrSuspension(
  userId: string,
  profile: any,
  db: Db,
): Promise<any> {
  const status = String(profile?.subscription_status ?? "");
  if (!["active", "grace_period", "past_due"].includes(status)) return profile;
  const periodEnd = profile?.subscription_current_period_end
    ? Date.parse(String(profile.subscription_current_period_end))
    : 0;
  if (!periodEnd || Date.now() <= periodEnd) return profile;

  const now = new Date();
  const graceUntilRaw = profile?.subscription_grace_until
    ? Date.parse(String(profile.subscription_grace_until))
    : 0;
  if (!graceUntilRaw) {
    const graceUntil = addDays(now, 3).toISOString();
    await db.from("user_profiles").update({
      subscription_status: "grace_period",
      subscription_grace_until: graceUntil,
      updated_at: now.toISOString(),
    }).eq("user_id", userId);
    await db.from("subscription_renewal_events").insert({
      user_id: userId,
      plan_id: normalizePlanId(profile.subscription_plan_id),
      status: "grace_started",
      due_at: profile.subscription_current_period_end,
      processed_at: now.toISOString(),
      metadata: { grace_until: graceUntil },
    });
    return { ...profile, subscription_status: "grace_period", subscription_grace_until: graceUntil };
  }

  if (Date.now() > graceUntilRaw) {
    await db.from("user_profiles").update({
      account_status: "suspended",
      subscription_status: "suspended",
      suspension_reason: "Subscription payment failed after grace period",
      updated_at: now.toISOString(),
    }).eq("user_id", userId);
    await db.from("subscription_renewal_events").insert({
      user_id: userId,
      plan_id: normalizePlanId(profile.subscription_plan_id),
      status: "suspended",
      due_at: profile.subscription_current_period_end,
      processed_at: now.toISOString(),
      metadata: { reason: "failed_payment_grace_expired" },
    });
    return { ...profile, account_status: "suspended", subscription_status: "suspended" };
  }

  return profile;
}

async function hasRecentRenewalEvent(
  db: Db,
  userId: string,
  status: string,
  since: Date,
): Promise<boolean> {
  const { data, error } = await db
    .from("subscription_renewal_events")
    .select("id")
    .eq("user_id", userId)
    .eq("status", status)
    .gte("created_at", since.toISOString())
    .limit(1);
  if (error) {
    if (isMissingSubscriptionSchema(error)) return true;
    throw error;
  }
  return (data ?? []).length > 0;
}

async function currentUsage(userId: string, db: Db): Promise<{
  usage: Record<UsageMetric, number>;
  dailyAiQuestionsUsed: number;
}> {
  const usage = Object.fromEntries(METRICS.map((metric) => [metric, 0])) as Record<UsageMetric, number>;
  const { data, error } = await db
    .from("subscription_usage_events")
    .select("metric, quantity")
    .eq("user_id", userId)
    .eq("period_key", monthKey());
  if (error) {
    if (isMissingSubscriptionSchema(error)) return { usage, dailyAiQuestionsUsed: 0 };
    throw error;
  }
  for (const row of data ?? []) {
    const metric = row.metric as UsageMetric;
    if (METRICS.includes(metric)) usage[metric] += Number(row.quantity ?? 0);
  }
  const { data: dailyRows } = await db
    .from("subscription_usage_events")
    .select("quantity")
    .eq("user_id", userId)
    .eq("metric", "ai_questions")
    .eq("period_key", dayKey());
  const dailyAiQuestionsUsed = (dailyRows ?? []).reduce(
    (sum, row) => sum + Number(row.quantity ?? 0),
    0,
  );
  return { usage, dailyAiQuestionsUsed };
}

export async function getEntitlement(userId: string, db = createServerSupabase()): Promise<Entitlement> {
  await maybeBootstrapTrial(userId, db).catch((error) => {
    if (!isMissingSubscriptionSchema(error)) throw error;
  });

  const { data, error } = await db
    .from("user_profiles")
    .select("tier, subscription_plan_id, subscription_status, trial_ends_at, subscription_current_period_end, subscription_grace_until, subscription_auto_renew")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && !isMissingSubscriptionSchema(error)) throw error;

  let profile: any = data ?? {};
  profile = await maybeExpireTrial(userId, profile, db).catch((err) => {
    if (isMissingSubscriptionSchema(err)) return profile;
    throw err;
  });
  profile = await maybeApplyGraceOrSuspension(userId, profile, db).catch((err) => {
    if (isMissingSubscriptionSchema(err)) return profile;
    throw err;
  });

  const planId = normalizePlanId(profile.subscription_plan_id ?? planIdForTier(profile.tier));
  const usageData = await currentUsage(userId, db);
  return {
    userId,
    plan: BILLING_PLANS[planId],
    status: String(profile.subscription_status ?? (planId === "free" ? "free" : "active")),
    isTrial: String(profile.subscription_status ?? "") === "trialing",
    trialEndsAt: profile.trial_ends_at ?? null,
    currentPeriodEnd: profile.subscription_current_period_end ?? null,
    graceUntil: profile.subscription_grace_until ?? null,
    autoRenew: profile.subscription_auto_renew !== false,
    ...usageData,
  };
}

export async function checkQuota(
  userId: string,
  metric: UsageMetric,
  quantity = 1,
  db = createServerSupabase(),
): Promise<QuotaCheck> {
  const entitlement = await getEntitlement(userId, db);
  if (entitlement.status === "suspended") {
    return {
      ok: false,
      status: 403,
      code: "subscription_suspended",
      detail: "Subscription is suspended. Update payment or contact support.",
      entitlement,
    };
  }
  if (metric === "ai_questions" && entitlement.plan.dailyAiQuestions != null) {
    if (entitlement.dailyAiQuestionsUsed + quantity > entitlement.plan.dailyAiQuestions) {
      return quotaExceededResponse(
        `Daily AI question limit reached for ${entitlement.plan.tier}.`,
        entitlement,
      );
    }
  }
  const limit = entitlement.plan.quotas[metric];
  if (limit != null && entitlement.usage[metric] + quantity > limit) {
    return quotaExceededResponse(
      `${metric.replace("_", " ")} limit reached for ${entitlement.plan.tier}.`,
      entitlement,
    );
  }
  return { ok: true, entitlement };
}

export async function assertUploadAllowed(
  userId: string,
  pageCount: number | null,
  db = createServerSupabase(),
): Promise<QuotaCheck> {
  const entitlement = await getEntitlement(userId, db);
  const limit = entitlement.plan.uploadPageLimit;
  if (limit != null && pageCount != null && pageCount > limit) {
    return quotaExceededResponse(
      `Upload page limit is ${limit} pages for ${entitlement.plan.tier}.`,
      entitlement,
    );
  }
  return checkQuota(userId, "uploads", 1, db);
}

export async function recordUsage(input: {
  userId: string;
  metric: UsageMetric;
  quantity?: number;
  source: string;
  model?: string | null;
  tokensPrompt?: number;
  tokensCompletion?: number;
  metadata?: Record<string, unknown>;
  db?: Db;
}) {
  const db = input.db ?? createServerSupabase();
  const entitlement = await getEntitlement(input.userId, db);
  const period = input.metric === "ai_questions" && entitlement.plan.dailyAiQuestions != null
    ? dayKey()
    : monthKey();
  const { error } = await db.from("subscription_usage_events").insert({
    user_id: input.userId,
    plan_id: entitlement.plan.id,
    metric: input.metric,
    quantity: input.quantity ?? 1,
    period_key: period,
    source: input.source,
    model: input.model ?? null,
    tokens_prompt: input.tokensPrompt ?? 0,
    tokens_completion: input.tokensCompletion ?? 0,
    metadata: input.metadata ?? {},
  });
  if (error && !isMissingSubscriptionSchema(error)) throw error;
}

export async function subscriptionOverview(userId: string, db = createServerSupabase()) {
  const entitlement = await getEntitlement(userId, db);
  const { data: renewals } = await db
    .from("subscription_renewal_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: payments } = await db
    .from("subscription_payment_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return {
    entitlement,
    plans: Object.values(BILLING_PLANS),
    renewalEvents: renewals ?? [],
    paymentEvents: payments ?? [],
  };
}

export async function markPaymentFailed(input: {
  userId: string;
  planId: string;
  subscriptionId?: string | null;
  provider?: string;
  providerEventId?: string | null;
  providerInvoiceId?: string | null;
  amountCents?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  db?: Db;
}) {
  const db = input.db ?? createServerSupabase();
  if (input.providerEventId) {
    const { data: existing, error: existingError } = await db
      .from("subscription_payment_events")
      .select("id")
      .eq("provider", input.provider ?? "moyasar")
      .eq("provider_event_id", input.providerEventId)
      .limit(1);
    if (existingError && !isMissingSubscriptionSchema(existingError)) throw existingError;
    if ((existing ?? []).length > 0) return;
  }
  const now = new Date();
  const graceUntil = addDays(now, 3).toISOString();
  const planId = normalizePlanId(input.planId);
  await Promise.all([
    db.from("user_profiles").update({
      subscription_status: "grace_period",
      subscription_grace_until: graceUntil,
      subscription_plan_id: planId,
      updated_at: now.toISOString(),
    }).eq("user_id", input.userId),
    input.subscriptionId
      ? db.from("subscriptions").update({
          status: "past_due",
          failed_payment_count: (input.metadata?.failed_payment_count as number | undefined) ?? 1,
          last_payment_status: "failed",
          grace_until: graceUntil,
          updated_at: now.toISOString(),
        }).eq("id", input.subscriptionId)
      : Promise.resolve({ error: null }),
    db.from("subscription_payment_events").insert({
      user_id: input.userId,
      subscription_id: input.subscriptionId ?? null,
      provider: input.provider ?? "moyasar",
      provider_event_id: input.providerEventId ?? null,
      provider_invoice_id: input.providerInvoiceId ?? null,
      plan_id: planId,
      status: "failed",
      amount_cents: input.amountCents ?? 0,
      currency: input.currency ?? "SAR",
      metadata: input.metadata ?? {},
    }),
    db.from("subscription_renewal_events").insert({
      user_id: input.userId,
      subscription_id: input.subscriptionId ?? null,
      plan_id: planId,
      status: "payment_failed",
      processed_at: now.toISOString(),
      metadata: { grace_until: graceUntil, ...(input.metadata ?? {}) },
    }),
    db.from("subscription_renewal_events").insert({
      user_id: input.userId,
      subscription_id: input.subscriptionId ?? null,
      plan_id: planId,
      status: "grace_started",
      due_at: graceUntil,
      processed_at: now.toISOString(),
      metadata: input.metadata ?? {},
    }),
  ]);
}

export async function runSubscriptionMaintenance(db = createServerSupabase()): Promise<MaintenanceResult> {
  const result: MaintenanceResult = {
    checked: 0,
    trialExpired: 0,
    graceStarted: 0,
    suspended: 0,
    renewalDue: 0,
    autoRenewDisabled: 0,
  };
  const { data, error } = await db
    .from("user_profiles")
    .select("user_id, subscription_status, subscription_plan_id, subscription_current_period_end, subscription_grace_until, subscription_auto_renew, trial_ends_at")
    .in("subscription_status", ["trialing", "active", "past_due", "grace_period"]);
  if (error) {
    if (isMissingSubscriptionSchema(error)) return result;
    throw error;
  }

  const rows = (data ?? []) as any[];
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const recentWindow = addDays(now, -1);
  for (const row of rows) {
    const userId = String(row.user_id);
    result.checked += 1;
    const beforeStatus = String(row.subscription_status ?? "");
    await getEntitlement(userId, db);
    const { data: after } = await db
      .from("user_profiles")
      .select("subscription_status")
      .eq("user_id", userId)
      .maybeSingle();
    const afterStatus = String((after as any)?.subscription_status ?? beforeStatus);
    if (beforeStatus === "trialing" && afterStatus === "free") result.trialExpired += 1;
    if (beforeStatus !== "grace_period" && afterStatus === "grace_period") result.graceStarted += 1;
    if (afterStatus === "suspended") result.suspended += 1;

    const periodEndMs = row.subscription_current_period_end
      ? Date.parse(String(row.subscription_current_period_end))
      : 0;
    if (
      afterStatus === "active" &&
      periodEndMs > now.getTime() &&
      periodEndMs <= tomorrow.getTime()
    ) {
      const alreadyLogged = await hasRecentRenewalEvent(db, userId, "renewal_due", recentWindow);
      if (!alreadyLogged) {
        await db.from("subscription_renewal_events").insert({
          user_id: userId,
          plan_id: normalizePlanId(row.subscription_plan_id),
          status: "renewal_due",
          due_at: new Date(periodEndMs).toISOString(),
          metadata: { auto_renew: row.subscription_auto_renew !== false },
        });
        result.renewalDue += 1;
      }
      if (row.subscription_auto_renew === false) result.autoRenewDisabled += 1;
    }
  }
  return result;
}
