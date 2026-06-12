export type BillingPlanId = "explorer" | "business" | "founder_pro" | "enterprise";

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
    explorer: {
        id: "explorer",
        tier: "Explorer",
        amountHalalas: 0,
        descriptionAr: "AGD LAW AI المستكشف - مجاني",
        descriptionEn: "AGD LAW AI Explorer - Free",
        monthlyAiRequests: 5,
        allowedModels: ["DeepSeek V4 Flash"],
    },
    business: {
        id: "business",
        tier: "Business",
        amountHalalas: 11000,
        descriptionAr: "AGD LAW AI باقة الأعمال - شهري",
        descriptionEn: "AGD LAW AI Business subscription - monthly",
        monthlyAiRequests: 100,
        allowedModels: ["DeepSeek V4 Flash"],
    },
    founder_pro: {
        id: "founder_pro",
        tier: "Founder Pro",
        amountHalalas: 37000,
        descriptionAr: "AGD LAW AI باقة المؤسس الاحترافية - شهري",
        descriptionEn: "AGD LAW AI Founder Pro subscription - monthly",
        monthlyAiRequests: 999999,
        allowedModels: ["DeepSeek V4 Flash"],
    },
    enterprise: {
        id: "enterprise",
        tier: "Enterprise",
        amountHalalas: 0,
        descriptionAr: "AGD LAW AI المؤسسات - تسعير مخصص",
        descriptionEn: "AGD LAW AI Enterprise - Custom pricing",
        monthlyAiRequests: 999999,
        allowedModels: ["DeepSeek V4 Flash"],
    },
};
