export type BillingPlanId = "free" | "starter" | "professional" | "enterprise";

export type BillingPlan = {
    id: BillingPlanId;
    tier: string;
    amountHalalas: number;
    priceLabel: string;
    cadence: string;
    descriptionAr: string;
    descriptionEn: string;
    features: string[];
    uploadPageLimit: number | null;
    cta: "current" | "checkout" | "contact";
};

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
    free: {
        id: "free",
        tier: "Free",
        amountHalalas: 0,
        priceLabel: "Free",
        cadence: "",
        descriptionAr: "للبداية والتجربة الخفيفة",
        descriptionEn: "For getting started with light legal AI work",
        features: [
            "3 contract analyses/month",
            "3 summaries/month",
            "5 AI questions/day",
            "10-page upload limit",
        ],
        uploadPageLimit: 10,
        cta: "current",
    },
    starter: {
        id: "starter",
        tier: "Starter",
        amountHalalas: 14_900,
        priceLabel: "149 SAR",
        cadence: "monthly",
        descriptionAr: "للأفراد والفرق الصغيرة",
        descriptionEn: "For individuals and small teams",
        features: [
            "25 analyses/month",
            "100 AI questions/month",
            "50-page uploads",
            "Contract comparison",
            "Legal translation",
        ],
        uploadPageLimit: 50,
        cta: "checkout",
    },
    professional: {
        id: "professional",
        tier: "Professional",
        amountHalalas: 39_900,
        priceLabel: "399 SAR",
        cadence: "monthly",
        descriptionAr: "للاستخدام المهني اليومي",
        descriptionEn: "For daily professional legal operations",
        features: [
            "Unlimited/fair-use AI usage",
            "Team accounts",
            "Contract repository",
            "Due diligence workspace",
            "Advanced analytics",
        ],
        uploadPageLimit: null,
        cta: "checkout",
    },
    enterprise: {
        id: "enterprise",
        tier: "Enterprise",
        amountHalalas: 0,
        priceLabel: "Custom",
        cadence: "",
        descriptionAr: "للمؤسسات ومتطلبات الحوكمة",
        descriptionEn: "For enterprise governance and scale",
        features: [
            "Custom pricing",
            "Custom quotas",
            "SSO placeholder",
            "Dedicated support",
        ],
        uploadPageLimit: null,
        cta: "contact",
    },
};

export const ORDERED_BILLING_PLANS: BillingPlan[] = [
    BILLING_PLANS.free,
    BILLING_PLANS.starter,
    BILLING_PLANS.professional,
    BILLING_PLANS.enterprise,
];
