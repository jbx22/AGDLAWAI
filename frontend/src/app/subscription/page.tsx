"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import {
    createMoyasarCheckout,
    getSubscriptionOverview,
    type SubscriptionOverview,
} from "@/app/lib/mikeApi";
import {
    ORDERED_BILLING_PLANS,
    type BillingPlan,
    type BillingPlanId,
} from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const paymentMessages: Record<string, string> = {
    login_required: "Sign in first so we can attach the subscription to your account.",
    moyasar_not_configured: "Moyasar is not configured yet for production checkout.",
    moyasar_error: "Payment checkout could not be created. Try again or contact support.",
    invalid_plan: "That subscription plan is not available.",
    success: "Payment received. Your plan updates after Moyasar confirms the invoice.",
    pending: "Payment is pending. We will update your plan when Moyasar confirms it.",
};

function money(plan: BillingPlan) {
    if (plan.id === "enterprise") return "Custom";
    if (plan.amountHalalas === 0) return "Free";
    return `${Math.round(plan.amountHalalas / 100)} SAR`;
}

function usagePercent(used: number, limit: number | null | undefined) {
    if (!limit || limit >= 999_999) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
}

export default function SubscriptionPage() {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
    const { profile } = useUserProfile();
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [overview, setOverview] = useState<SubscriptionOverview | null>(null);

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
    const dir = locale === "ar" ? "rtl" : "ltr";

    useEffect(() => {
        if (!isAuthenticated) return;
        getSubscriptionOverview()
            .then(setOverview)
            .catch((err) => setError(err instanceof Error ? err.message : "Subscription lookup failed"));
    }, [isAuthenticated]);

    const currentPlanId = useMemo(() => {
        const fromOverview = overview?.entitlement.plan.id;
        if (fromOverview) return fromOverview;
        const tier = (profile?.tier || "Free").toLowerCase();
        if (tier === "starter") return "starter";
        if (tier === "professional") return "professional";
        if (tier === "enterprise") return "enterprise";
        return "free";
    }, [overview, profile?.tier]);

    const orderedPlans = selectedPlan
        ? [...ORDERED_BILLING_PLANS].sort((a, b) => {
              if (a.id === selectedPlan) return -1;
              if (b.id === selectedPlan) return 1;
              return 0;
          })
        : ORDERED_BILLING_PLANS;

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
        if (planId === "free") return;

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
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8" dir={dir}>
            <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-[#8d7330]">
                        AGD LAW AI subscriptions
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold text-gray-950">
                        Choose the legal AI capacity your work needs
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
                        New users start with a 14-day Professional trial, 20 free analyses, and automatic downgrade to Free when the trial expires.
                    </p>
                </div>
                {overview && (
                    <div className="rounded-md border border-gray-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-950">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            Current plan: {overview.entitlement.plan.tier}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            Status: {overview.entitlement.status}
                            {overview.entitlement.trialEndsAt
                                ? ` · Trial ends ${new Date(overview.entitlement.trialEndsAt).toLocaleDateString()}`
                                : ""}
                        </div>
                    </div>
                )}
            </section>

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

            <section className="grid gap-4 lg:grid-cols-4">
                {orderedPlans.map((plan) => {
                    const isCurrent = currentPlanId === plan.id;
                    const featured = plan.id === "professional" || plan.id === selectedPlan;
                    return (
                        <article
                            key={plan.id}
                            className={`flex min-h-[420px] flex-col rounded-md border p-5 ${
                                featured
                                    ? "border-[#c9a84c] bg-[#151827] text-white"
                                    : "border-gray-200 bg-white text-gray-950"
                            }`}
                        >
                            <div className="text-sm font-semibold text-[#c9a84c]">{plan.descriptionEn}</div>
                            <h2 className="mt-2 text-2xl font-semibold">{plan.tier}</h2>
                            <div className="mt-4">
                                <span className="text-3xl font-semibold">{money(plan)}</span>
                                {plan.cadence && <span className="mx-2 text-sm opacity-70">/ {plan.cadence}</span>}
                            </div>
                            <ul className="mt-5 flex-1 space-y-3">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2 text-sm leading-6">
                                        <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                                        <span className={featured ? "text-white/85" : "text-gray-600"}>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <Button
                                disabled={isCurrent || loading === plan.id || authLoading}
                                onClick={() => handleSubscribe(plan.id)}
                                variant={featured ? "default" : "outline"}
                                className="mt-6 w-full"
                            >
                                {loading === plan.id ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening Moyasar
                                    </>
                                ) : isCurrent ? (
                                    "Current plan"
                                ) : plan.id === "enterprise" ? (
                                    "Contact sales"
                                ) : (
                                    "Subscribe"
                                )}
                            </Button>
                        </article>
                    );
                })}
            </section>

            {overview && (
                <section className="grid gap-4 lg:grid-cols-3">
                    <UsageCard
                        title="Analyses"
                        used={overview.entitlement.usage.analyses ?? 0}
                        limit={overview.entitlement.plan.quotas.analyses}
                    />
                    <UsageCard
                        title="Summaries"
                        used={overview.entitlement.usage.summaries ?? 0}
                        limit={overview.entitlement.plan.quotas.summaries}
                    />
                    <UsageCard
                        title="AI questions"
                        used={
                            overview.entitlement.plan.dailyAiQuestions
                                ? overview.entitlement.dailyAiQuestionsUsed
                                : overview.entitlement.usage.ai_questions ?? 0
                        }
                        limit={overview.entitlement.plan.dailyAiQuestions ?? overview.entitlement.plan.quotas.ai_questions}
                    />
                </section>
            )}
        </div>
    );
}

function UsageCard({
    title,
    used,
    limit,
}: {
    title: string;
    used: number;
    limit: number | null | undefined;
}) {
    const pct = usagePercent(used, limit);
    const label = !limit || limit >= 999_999 ? `${used} used · fair use` : `${used} / ${limit}`;
    return (
        <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-950">{title}</h3>
                <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-[#c9a84c]" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
