"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { BILLING_PLANS, type BillingPlanId } from "@/lib/billing/plans";
import { createMoyasarCheckout } from "@/app/lib/mikeApi";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const paymentMessages: Record<string, string> = {
    login_required: "سجل الدخول أو أنشئ حساباً قبل اختيار الباقة حتى نربط الاشتراك بحسابك.",
    moyasar_not_configured: "بوابة الدفع غير مفعلة بعد. أضف مفتاح Moyasar السري في إعدادات الإنتاج.",
    moyasar_error: "تعذر إنشاء فاتورة الدفع. حاول مرة أخرى أو تواصل مع الدعم.",
    invalid_plan: "الباقة المحددة غير صحيحة.",
    success: "تم استلام الدفع. سيتم تحديث باقتك تلقائياً عند تأكيد Moyasar للعملية.",
    pending: "عملية الدفع معلقة. سيتم تحديث باقتك عند تأكيد الدفع.",
};

const plans = [
    {
        id: "explorer" as BillingPlanId,
        name: "المستكشف",
        audience: "للمستقلين والطلاب والمستخدمين الجدد",
        price: "مجاني",
        cadence: "",
        features: ["5 تحليلات عقود شهرياً", "شروح مبسطة للعقود", "رفع PDF و DOCX"],
    },
    {
        id: "business" as BillingPlanId,
        name: "الأعمال",
        audience: "للشركات الناشئة والمتاجر والوكالات والمستشارين",
        price: "SAR 110",
        cadence: "شهرياً",
        features: ["100 تحليل عقد شهرياً", "إنشاء العقود بالذكاء الاصطناعي", "كشف المخاطر القانونية"],
    },
    {
        id: "founder_pro" as BillingPlanId,
        name: "المؤسس الاحترافية",
        audience: "للمؤسسين والشركات الصغيرة والمتوسطة",
        price: "SAR 370",
        cadence: "شهرياً",
        features: ["تحليل غير محدود للعقود", "ذكاء قانوني متقدم", "دعم فني أولوية"],
        featured: true,
    },
    {
        id: "enterprise" as BillingPlanId,
        name: "المؤسسات",
        audience: "لمكاتب المحاماة والشركات الكبرى",
        price: "مخصص",
        cadence: "",
        features: ["استضافة خاصة", "مساحات عمل للفرق", "مدير حساب ودعم مخصص"],
    },
];

export default function SubscriptionPage() {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
    const { profile } = useUserProfile();
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const searchParams =
        typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : new URLSearchParams();
    const payment = searchParams.get("payment");
    const selectedPlan = searchParams.get("plan");
    const locale =
        pathname === "/en" ||
        pathname?.startsWith("/en/") ||
        searchParams.get("lang") === "en"
            ? "en"
            : "ar";

    const orderedPlans = selectedPlan
        ? [...plans].sort((a, b) => {
              if (a.id === selectedPlan) return -1;
              if (b.id === selectedPlan) return 1;
              return 0;
          })
        : plans;

    const handleSubscribe = async (planId: BillingPlanId) => {
        setError(null);
        if (!authLoading && !isAuthenticated) {
            router.push(`/login?callbackUrl=${encodeURIComponent(`/subscription?plan=${planId}`)}`);
            return;
        }
        if (planId === "enterprise") {
            router.push(locale === "en" ? "/en/contact" : "/contact");
            return;
        }
        if (planId === "explorer") return;

        setLoading(planId);
        try {
            const checkout = await createMoyasarCheckout({ plan: planId, locale });
            window.location.href = checkout.url;
        } catch (err) {
            setError(err instanceof Error ? err.message : paymentMessages.moyasar_error);
            setLoading(null);
        }
    };

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-8 md:px-8" dir="rtl">
            <div className="rounded-md border border-[#ded6c3] bg-[#fdfcf8] p-6">
                <p className="text-sm font-bold text-[#8d7330]">باقات الاشتراك</p>
                <h1 className="mt-2 text-3xl font-extrabold text-[#151827]">
                    اختر الباقة المناسبة لاحتياجاتك القانونية والذكاء الاصطناعي
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#55565c]">
                    باقتك الحالية: {profile?.tier || "Free"}. يعمل AGD LAW AI عبر DeepSeek V4 Flash.
                </p>
            </div>

            {payment && paymentMessages[payment] && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    {paymentMessages[payment]}
                </div>
            )}
            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-4">
                {orderedPlans.map((plan) => {
                    const def = BILLING_PLANS[plan.id];
                    const isCurrent = (profile?.tier || "Free").toLowerCase() === def.tier.toLowerCase();
                    const featured = plan.featured || plan.id === selectedPlan;
                    return (
                        <div
                            key={plan.id}
                            className={`flex flex-col rounded-md border p-6 ${
                                featured
                                    ? "border-[#c9a84c] bg-[#1a1a2e] text-white shadow-lg"
                                    : "border-[#ded6c3] bg-white text-[#151827]"
                            }`}
                        >
                            <p className={`text-sm font-bold ${featured ? "text-[#c9a84c]" : "text-[#8d7330]"}`}>
                                {plan.audience}
                            </p>
                            <h3 className="mt-2 text-2xl font-extrabold">{plan.name}</h3>
                            <div className="mt-5">
                                <span className="text-3xl font-extrabold">{plan.price}</span>
                                {plan.cadence && <span className="mx-2 text-sm opacity-70">{plan.cadence}</span>}
                            </div>
                            <ul className="mt-6 flex-1 space-y-3">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2 text-sm leading-6">
                                        <Check size={16} className={`mt-1 shrink-0 ${featured ? "text-[#c9a84c]" : "text-[#2e7d63]"}`} />
                                        <span className={featured ? "text-white/85" : "text-[#4d4f57]"}>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <button
                                disabled={isCurrent || loading === plan.id || authLoading}
                                onClick={() => handleSubscribe(plan.id)}
                                className={`mt-7 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold transition ${
                                    isCurrent
                                        ? "cursor-not-allowed bg-gray-200 text-gray-500"
                                        : featured
                                          ? "bg-[#c9a84c] text-[#151827] hover:bg-[#d9ba65]"
                                          : "border border-[#1a1a2e] text-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white"
                                }`}
                            >
                                {loading === plan.id ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" /> جارٍ التحويل إلى Moyasar
                                    </>
                                ) : isCurrent ? (
                                    "الباقة الحالية"
                                ) : plan.id === "enterprise" ? (
                                    "تواصل معنا"
                                ) : (
                                    <>
                                        اشترك الآن <ArrowLeft size={14} />
                                    </>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
