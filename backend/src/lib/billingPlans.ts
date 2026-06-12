export type BillingPlanId = "free" | "starter" | "professional" | "enterprise";

export type UsageMetric =
  | "analyses"
  | "summaries"
  | "uploads"
  | "ai_questions"
  | "tokens";

export type BillingPlan = {
  id: BillingPlanId;
  tier: string;
  amountHalalas: number;
  currency: "SAR";
  cadence: "month" | "custom";
  descriptionAr: string;
  descriptionEn: string;
  quotas: Record<UsageMetric, number | null>;
  dailyAiQuestions: number | null;
  uploadPageLimit: number | null;
  features: string[];
  cta: "current" | "checkout" | "contact";
};

export const FAIR_USE_LIMIT = 999_999;

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  free: {
    id: "free",
    tier: "Free",
    amountHalalas: 0,
    currency: "SAR",
    cadence: "month",
    descriptionAr: "AGD LAW AI المجانية",
    descriptionEn: "AGD LAW AI Free",
    quotas: {
      analyses: 3,
      summaries: 3,
      uploads: null,
      ai_questions: null,
      tokens: null,
    },
    dailyAiQuestions: 5,
    uploadPageLimit: 10,
    features: [
      "3 contract analyses/month",
      "3 summaries/month",
      "5 AI questions/day",
      "10-page upload limit",
    ],
    cta: "current",
  },
  starter: {
    id: "starter",
    tier: "Starter",
    amountHalalas: 14_900,
    currency: "SAR",
    cadence: "month",
    descriptionAr: "AGD LAW AI Starter - شهري",
    descriptionEn: "AGD LAW AI Starter subscription - monthly",
    quotas: {
      analyses: 25,
      summaries: null,
      uploads: null,
      ai_questions: 100,
      tokens: null,
    },
    dailyAiQuestions: null,
    uploadPageLimit: 50,
    features: [
      "25 analyses/month",
      "100 AI questions/month",
      "50-page uploads",
      "Contract comparison",
      "Legal translation",
    ],
    cta: "checkout",
  },
  professional: {
    id: "professional",
    tier: "Professional",
    amountHalalas: 39_900,
    currency: "SAR",
    cadence: "month",
    descriptionAr: "AGD LAW AI Professional - شهري",
    descriptionEn: "AGD LAW AI Professional subscription - monthly",
    quotas: {
      analyses: FAIR_USE_LIMIT,
      summaries: FAIR_USE_LIMIT,
      uploads: null,
      ai_questions: FAIR_USE_LIMIT,
      tokens: FAIR_USE_LIMIT,
    },
    dailyAiQuestions: null,
    uploadPageLimit: null,
    features: [
      "Unlimited/fair-use AI usage",
      "Team accounts",
      "Contract repository",
      "Due diligence workspace",
      "Advanced analytics",
    ],
    cta: "checkout",
  },
  enterprise: {
    id: "enterprise",
    tier: "Enterprise",
    amountHalalas: 0,
    currency: "SAR",
    cadence: "custom",
    descriptionAr: "AGD LAW AI Enterprise - تسعير مخصص",
    descriptionEn: "AGD LAW AI Enterprise - custom pricing",
    quotas: {
      analyses: null,
      summaries: null,
      uploads: null,
      ai_questions: null,
      tokens: null,
    },
    dailyAiQuestions: null,
    uploadPageLimit: null,
    features: [
      "Custom pricing",
      "Custom quotas",
      "SSO placeholder",
      "Dedicated support",
    ],
    cta: "contact",
  },
};

const LEGACY_PLAN_MAP: Record<string, BillingPlanId> = {
  explorer: "free",
  business: "starter",
  founder_pro: "professional",
};

export function normalizePlanId(planId: string | null | undefined): BillingPlanId {
  const key = String(planId ?? "").trim().toLowerCase();
  if (key in BILLING_PLANS) return key as BillingPlanId;
  if (key in LEGACY_PLAN_MAP) return LEGACY_PLAN_MAP[key];
  return "free";
}

export function getBillingPlan(id: string | null | undefined): BillingPlan | null {
  if (!id) return null;
  return BILLING_PLANS[normalizePlanId(id)] ?? null;
}

export const SUBSCRIPTION_TIERS = new Set(
  Object.values(BILLING_PLANS).map((plan) => plan.tier),
);

export function planIdForTier(tier: string | null | undefined): BillingPlanId {
  const normalized = String(tier ?? "").trim().toLowerCase();
  const plan = Object.values(BILLING_PLANS).find(
    (candidate) => candidate.tier.toLowerCase() === normalized,
  );
  return plan?.id ?? "free";
}

export function nextPeriodEnd(from = new Date()): string {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end.toISOString();
}

export function trialEnd(from = new Date()): string {
  const end = new Date(from);
  end.setDate(end.getDate() + 14);
  return end.toISOString();
}
