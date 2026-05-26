"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { BILLING_PLANS, type BillingPlanId } from "@/lib/billing/plans";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const plansList: {
  id: BillingPlanId;
  name: string;
  audience: string;
  features: string[];
  featured?: boolean;
}[] = [
  {
    id: "professional",
    name: "المهني",
    audience: "للمحترفين",
    features: [
      "DeepSeek V4 Flash فقط",
      "30 طلب ذكاء اصطناعي شهريا",
      "إنشاء ومراجعة عقود ونماذج ومستندات",
    ],
    featured: true,
  },
  {
    id: "business",
    name: "الشركات الصغيرة",
    audience: "للشركات والفرق الصغيرة",
    features: [
      "DeepSeek V4 Flash فقط",
      "75 طلب ذكاء اصطناعي شهريا",
      "مسارات عمل للشركات والعقود والضرائب",
    ],
  },
  {
    id: "enterprise",
    name: "الحسابات المخصصة",
    audience: "للجهات ذات المتطلبات الخاصة",
    features: [
      "DeepSeek V4 Flash فقط",
      "300 طلب ذكاء اصطناعي شهريا",
      "حوكمة وتكاملات ودعم إعداد",
    ],
  },
];

function paymentMessage(code: string | null) {
  if (code === "login_required") return "سجل الدخول أو أنشئ حسابا قبل اختيار الباقة حتى نربط الاشتراك بحسابك.";
  if (code === "moyasar_not_configured") return "بوابة الدفع غير مفعلة بعد. أضف مفتاح Moyasar السري في إعدادات الإنتاج لتفعيل الدفع.";
  if (code === "moyasar_error") return "تعذر إنشاء فاتورة الدفع. حاول مرة أخرى أو تواصل مع الدعم.";
  if (code === "invalid_plan") return "الباقة المحددة غير صحيحة. اختر إحدى الباقات المعروضة.";
  if (code === "success") return "تم استلام الدفع. سيتم تحديث باقتك تلقائيا عند تأكيد Moyasar للعملية.";
  if (code === "pending") return "عملية الدفع معلقة. سيتم تحديث باقتك عند تأكيد الدفع.";
  return null;
}

export default function SubscriptionPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, authLoading } = useAuth();
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState<string | null>(null);
  const currentTier = profile?.tier || "Free";
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
    ? [...plansList].sort((a, b) => {
        if (a.id === selectedPlan) return -1;
        if (b.id === selectedPlan) return 1;
        return 0;
      })
    : plansList;

  const handleSubscribe = async (planId: BillingPlanId) => {
    if (!authLoading && !isAuthenticated) {
      const callbackUrl = `/subscription?plan=${planId}${locale === "en" ? "&lang=en" : ""}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}${locale === "en" ? "&lang=en" : ""}`);
      return;
    }

    setLoading(planId);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/billing/moyasar/checkout";

    const planInput = document.createElement("input");
    planInput.type = "hidden";
    planInput.name = "plan";
    planInput.value = planId;
    form.appendChild(planInput);

    const localeInput = document.createElement("input");
    localeInput.type = "hidden";
    localeInput.name = "locale";
    localeInput.value = locale;
    form.appendChild(localeInput);

    document.body.appendChild(form);
    form.submit();
    setTimeout(() => setLoading(null), 5000);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-8 md:px-8" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="rounded-md border border-[#ded6c3] bg-[#fdfcf8] p-6">
        <p className="text-sm font-bold text-[#8d7330]">باقات الاشتراك</p>
        <h1 className="mt-2 text-3xl font-extrabold text-[#151827]">
          اختر الباقة نفسها المعروضة في الصفحة الرئيسية
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#55565c]">
          باقتك الحالية: <strong>{currentTier}</strong>. استخدام الذكاء الاصطناعي متاح للعضويات المدفوعة فقط، ويعمل داخل JBL BIZ LAW عبر DeepSeek V4 Flash.
        </p>
      </div>

      {paymentMessage(payment) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {paymentMessage(payment)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {orderedPlans.map((plan) => {
          const def = BILLING_PLANS[plan.id];
          const isCurrent = currentTier.toLowerCase() === def.tier.toLowerCase();
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
              <p className={`text-sm font-bold ${featured ? "text-[#c9a84c]" : "text-[#8d7330]"}`}>{plan.audience}</p>
              <h3 className="mt-2 text-2xl font-extrabold">{plan.name}</h3>
              <div className="mt-5">
                <span className="text-3xl font-extrabold">{def.amountHalalas / 100} ر.س</span>
                <span className={`mx-2 text-sm ${featured ? "text-white/70" : "text-[#666]"}`}>شهريا</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm leading-6">
                    <Check
                      size={16}
                      className={`mt-1 shrink-0 ${featured ? "text-[#c9a84c]" : "text-[#2e7d63]"}`}
                      aria-hidden="true"
                    />
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
                    <Loader2 size={14} className="animate-spin" /> جار التحويل إلى Moyasar
                  </>
                ) : isCurrent ? (
                  "الباقة الحالية"
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

      <p className="text-center text-xs text-gray-500">
        تتم معالجة المدفوعات عبر Moyasar. بعد نجاح الدفع يتم تحديث الباقة تلقائيا.
      </p>
    </div>
  );
}
