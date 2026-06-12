export type BillingPlanId = "explorer" | "business" | "founder_pro" | "enterprise";

export type BillingPlan = {
  id: BillingPlanId;
  tier: string;
  amountHalalas: number;
  descriptionAr: string;
  descriptionEn: string;
  monthlyAiRequests: number;
};

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  explorer: {
    id: "explorer",
    tier: "Explorer",
    amountHalalas: 0,
    descriptionAr: "AGD LAW AI المستكشف - مجاني",
    descriptionEn: "AGD LAW AI Explorer - Free",
    monthlyAiRequests: 5,
  },
  business: {
    id: "business",
    tier: "Business",
    amountHalalas: 11000,
    descriptionAr: "AGD LAW AI باقة الأعمال - شهري",
    descriptionEn: "AGD LAW AI Business subscription - monthly",
    monthlyAiRequests: 100,
  },
  founder_pro: {
    id: "founder_pro",
    tier: "Founder Pro",
    amountHalalas: 37000,
    descriptionAr: "AGD LAW AI باقة المؤسس الاحترافية - شهري",
    descriptionEn: "AGD LAW AI Founder Pro subscription - monthly",
    monthlyAiRequests: 999999,
  },
  enterprise: {
    id: "enterprise",
    tier: "Enterprise",
    amountHalalas: 0,
    descriptionAr: "AGD LAW AI المؤسسات - تسعير مخصص",
    descriptionEn: "AGD LAW AI Enterprise - Custom pricing",
    monthlyAiRequests: 999999,
  },
};

export function normalizePlanId(planId: string | null | undefined): BillingPlanId {
  if (planId === "professional") return "business";
  if (planId && planId in BILLING_PLANS) return planId as BillingPlanId;
  return "explorer";
}

export function getBillingPlan(id: string | null | undefined): BillingPlan | null {
  if (!id) return null;
  return BILLING_PLANS[id as BillingPlanId] ?? BILLING_PLANS[normalizePlanId(id)] ?? null;
}

export const SUBSCRIPTION_TIERS = new Set([
  "Free",
  "Explorer",
  "Business",
  "Founder Pro",
  "Enterprise",
]);
