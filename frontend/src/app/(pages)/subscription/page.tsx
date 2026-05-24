"use client";

import { useUserProfile } from "@/contexts/UserProfileContext";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BillingPlanId } from "@/lib/billing/plans";
import { BILLING_PLANS } from "@/lib/billing/plans";

const plansList: { id: BillingPlanId; features: string[] }[] = [
  {
    id: "professional",
    features: [
      "DeepSeek V4 Flash — 200 AI requests/month",
      "Contract & document generation and review",
      "Legal forms & company documents",
      "Tax and compliance guidance (U.S. & Europe)",
      "Standard support via email",
    ],
  },
  {
    id: "business",
    features: [
      "DeepSeek V4 Flash — 1,000 AI requests/month",
      "OpenAI access (bring your own API key)",
      "Everything in Professional, plus:",
      "Workflow automation for teams",
      "Multi-project dashboards",
      "Priority email support",
    ],
  },
  {
    id: "enterprise",
    features: [
      "DeepSeek V4 Flash — 5,000+ AI requests/month",
      "OpenAI access (bring your own API key)",
      "Everything in Business, plus:",
      "Custom integrations & SSO",
      "Dedicated onboarding & training",
      "Volume pricing & annual agreements",
    ],
  },
];

export default function SubscriptionPage() {
  const { profile } = useUserProfile();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const currentTier = profile?.tier || "Free";

  const handleSubscribe = async (planId: BillingPlanId) => {
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
    localeInput.value = "en";
    form.appendChild(localeInput);
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => setLoading(null), 5000);
  };

  return (
    <div className="flex flex-col gap-6 px-6 py-10 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-medium font-serif text-gray-900">
          Upgrade your subscription
        </h1>
        <p className="text-sm text-gray-500 mt-1.5">
          Current plan: <strong>{currentTier}</strong>. Choose a plan below and pay securely via Moyasar.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plansList.map((plan) => {
          const def = BILLING_PLANS[plan.id];
          const isCurrent = currentTier.toLowerCase() === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-6 flex flex-col ${
                plan.id === "business"
                  ? "border-[#c9a84c] bg-[#1a1a2e] text-white shadow-lg"
                  : "border-gray-200 bg-white"
              }`}
            >
              <h3
                className={`text-lg font-semibold ${
                  plan.id === "business" ? "text-[#c9a84c]" : "text-gray-900"
                }`}
              >
                {def.tier}
              </h3>
              <div className="mt-3">
                <span className="text-2xl font-bold">
                  {plan.id === "enterprise" ? "Custom" : `SAR ${def.amountHalalas / 100}`}
                </span>
                {plan.id !== "enterprise" && (
                  <span
                    className={`ml-1.5 text-sm ${
                      plan.id === "business" ? "text-white/60" : "text-gray-500"
                    }`}
                  >
                    /month
                  </span>
                )}
              </div>
              <ul className="mt-5 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm leading-5">
                    <Check
                      size={14}
                      className={`mt-0.5 shrink-0 ${
                        plan.id === "business" ? "text-[#c9a84c]" : "text-emerald-600"
                      }`}
                    />
                    <span className={plan.id === "business" ? "text-white/85" : "text-gray-700"}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                disabled={isCurrent || loading === plan.id}
                onClick={() => handleSubscribe(plan.id)}
                className={`mt-6 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  isCurrent
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : plan.id === "business"
                      ? "bg-[#c9a84c] text-[#151827] hover:bg-[#d9ba65]"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {loading === plan.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Redirecting to Moyasar...
                  </>
                ) : isCurrent ? (
                  "Current plan"
                ) : (
                  <>
                    Subscribe <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Payments are processed securely via{" "}
        <a href="https://moyasar.com" className="underline" target="_blank" rel="noopener">
          Moyasar
        </a>
        . After successful payment your tier will be updated automatically.
      </p>
    </div>
  );
}
