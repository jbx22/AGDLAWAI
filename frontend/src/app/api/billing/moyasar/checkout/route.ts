import { NextRequest, NextResponse } from "next/server";
import { optionalAuth } from "@/app/api/auth-helpers";
import { getBillingPlan } from "@/lib/billing/plans";

const MOYASAR_INVOICES_URL = "https://api.moyasar.com/v1/invoices";

type MoyasarInvoice = {
    id: string;
    status: string;
    url?: string;
};

function appUrl(req: NextRequest): string {
    return (
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        `${req.nextUrl.protocol}//${req.nextUrl.host}`
    );
}

function basicAuth(secretKey: string): string {
    return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export async function POST(req: NextRequest) {
    const secretKey = process.env.MOYASAR_SECRET_KEY?.trim();
    if (!secretKey) {
        return NextResponse.redirect(new URL("/subscription?payment=moyasar_not_configured", req.url), 303);
    }

    const form = await req.formData();
    const plan = getBillingPlan(String(form.get("plan") ?? ""));
    const locale = String(form.get("locale") ?? "ar") === "en" ? "en" : "ar";
    if (!plan) {
        return NextResponse.redirect(new URL("/subscription?payment=invalid_plan", req.url), 303);
    }

    const auth = await optionalAuth();
    if (!auth) {
        return NextResponse.redirect(new URL("/login?callbackUrl=/subscription", req.url), 303);
    }

    const baseUrl = appUrl(req);
    const description = locale === "en" ? plan.descriptionEn : plan.descriptionAr;

    const response = await fetch(MOYASAR_INVOICES_URL, {
        method: "POST",
        headers: {
            Authorization: basicAuth(secretKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            amount: plan.amountHalalas,
            currency: "SAR",
            description,
            callback_url: `${baseUrl}/api/billing/moyasar/callback?plan_id=${encodeURIComponent(plan.id)}&user_id=${encodeURIComponent(auth.userId)}`,
            success_url: `${baseUrl}/subscription?payment=success&plan=${plan.id}`,
            back_url: `${baseUrl}/subscription`,
            metadata: {
                plan_id: plan.id,
                tier: plan.tier,
                user_id: auth.userId,
                user_email: auth.userEmail,
                source: "jbl-biz-law",
            },
        }),
    });

    if (!response.ok) {
        const errorUrl = new URL("/subscription?payment=moyasar_error", req.url);
        return NextResponse.redirect(errorUrl, 303);
    }

    const invoice = (await response.json()) as MoyasarInvoice;
    if (!invoice.url) {
        return NextResponse.redirect(new URL("/subscription?payment=moyasar_error", req.url), 303);
    }

    return NextResponse.redirect(invoice.url, 303);
}
