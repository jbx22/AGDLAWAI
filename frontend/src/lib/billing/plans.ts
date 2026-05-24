export type BillingPlanId = "professional" | "business" | "enterprise";

export type BillingPlan = {
    id: BillingPlanId;
    tier: string;
    amountHalalas: number;
    descriptionAr: string;
    descriptionEn: string;
    monthlyAiRequests: number;
    allowedModels: string[];
};

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
    professional: {
        id: "professional",
        tier: "Professional",
        amountHalalas: 9900,
        descriptionAr: "اشتراك JBL BIZ LAW للمحترفين - شهري",
        descriptionEn: "JBL BIZ LAW Professional subscription - monthly",
        monthlyAiRequests: 30,
        allowedModels: ["DeepSeek V4 Flash"],
    },
    business: {
        id: "business",
        tier: "Business",
        amountHalalas: 29900,
        descriptionAr: "اشتراك JBL BIZ LAW للشركات الصغيرة - شهري",
        descriptionEn: "JBL BIZ LAW Small Companies subscription - monthly",
        monthlyAiRequests: 75,
        allowedModels: ["DeepSeek V4 Flash"],
    },
    enterprise: {
        id: "enterprise",
        tier: "Enterprise",
        amountHalalas: 50000,
        descriptionAr: "اشتراك JBL BIZ LAW للحسابات المخصصة - شهري",
        descriptionEn: "JBL BIZ LAW Customized Accounts subscription - monthly",
        monthlyAiRequests: 300,
        allowedModels: ["DeepSeek V4 Flash"],
    },
};

export type TierPolicy = {
    tier: string;
    monthlyAiRequests: number;
    deepseek: boolean;
    openai: boolean;
};

export const TIER_POLICIES: Record<string, TierPolicy> = {
    Free: {
        tier: "Free",
        monthlyAiRequests: 0,
        deepseek: false,
        openai: false,
    },
    Professional: {
        tier: "Professional",
        monthlyAiRequests: 30,
        deepseek: true,
        openai: false,
    },
    Business: {
        tier: "Business",
        monthlyAiRequests: 75,
        deepseek: true,
        openai: false,
    },
    Enterprise: {
        tier: "Enterprise",
        monthlyAiRequests: 300,
        deepseek: true,
        openai: false,
    },
};

export function normalizeTier(tier: string | null | undefined): keyof typeof TIER_POLICIES {
    if (tier && tier in TIER_POLICIES) return tier as keyof typeof TIER_POLICIES;
    return "Free";
}

export function getTierPolicy(tier: string | null | undefined): TierPolicy {
    return TIER_POLICIES[normalizeTier(tier)];
}

export function getBillingPlan(id: string | null | undefined): BillingPlan | null {
    if (!id) return null;
    return BILLING_PLANS[id as BillingPlanId] ?? null;
}
