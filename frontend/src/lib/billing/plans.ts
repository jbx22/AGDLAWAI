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
        descriptionAr: "اشتراك JBL BIZ LAW المهني - شهري",
        descriptionEn: "JBL BIZ LAW Professional subscription - monthly",
        monthlyAiRequests: 200,
        allowedModels: ["DeepSeek V4 Flash"],
    },
    business: {
        id: "business",
        tier: "Business",
        amountHalalas: 29900,
        descriptionAr: "اشتراك JBL BIZ LAW للأعمال - شهري",
        descriptionEn: "JBL BIZ LAW Business subscription - monthly",
        monthlyAiRequests: 1000,
        allowedModels: ["DeepSeek V4 Flash", "OpenAI"],
    },
    enterprise: {
        id: "enterprise",
        tier: "Enterprise",
        amountHalalas: 99900,
        descriptionAr: "دفعة تواصل أولية لخطة JBL BIZ LAW المؤسسية",
        descriptionEn: "Initial JBL BIZ LAW Enterprise engagement payment",
        monthlyAiRequests: 5000,
        allowedModels: ["DeepSeek V4 Flash", "OpenAI"],
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
        monthlyAiRequests: 200,
        deepseek: true,
        openai: false,
    },
    Business: {
        tier: "Business",
        monthlyAiRequests: 1000,
        deepseek: true,
        openai: true,
    },
    Enterprise: {
        tier: "Enterprise",
        monthlyAiRequests: 5000,
        deepseek: true,
        openai: true,
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
