import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions, userProfiles } from "@/db/schema";
import { getBillingPlan } from "@/lib/billing/plans";
import { eq } from "drizzle-orm";

type MoyasarCallback = {
    id?: string;
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: {
        plan_id?: string;
        user_id?: string;
        tier?: string;
    };
};

type VerifiedInvoice = MoyasarCallback & {
    id: string;
    status: string;
};

const MOYASAR_INVOICES_URL = "https://api.moyasar.com/v1/invoices";

function basicAuth(secretKey: string): string {
    return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function fetchVerifiedInvoice(invoiceId: string): Promise<VerifiedInvoice | null> {
    const secretKey = process.env.MOYASAR_SECRET_KEY?.trim();
    if (!secretKey) return null;

    const response = await fetch(`${MOYASAR_INVOICES_URL}/${encodeURIComponent(invoiceId)}`, {
        headers: {
            Authorization: basicAuth(secretKey),
            Accept: "application/json",
        },
        cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as VerifiedInvoice;
}

async function applyPaidSubscription(payload: MoyasarCallback | null) {
    const plan = getBillingPlan(payload?.metadata?.plan_id);
    const userId = payload?.metadata?.user_id;

    if (payload?.status === "paid" && plan && userId) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await db
            .update(userProfiles)
            .set({
                tier: plan.tier,
                updated_at: new Date(),
            })
            .where(eq(userProfiles.user_id, userId));

        await db.insert(subscriptions).values({
            user_id: userId,
            provider: "moyasar",
            provider_invoice_id: payload.id ?? null,
            plan_id: plan.id,
            tier: plan.tier,
            status: "paid",
            amount_cents: payload.amount ?? plan.amountHalalas,
            currency: payload.currency ?? "SAR",
            current_period_end: periodEnd,
            metadata: payload,
        });
    }
}

export async function POST(req: NextRequest) {
    const payload = (await req.json().catch(() => null)) as MoyasarCallback | null;
    if (!payload?.id) {
        return NextResponse.json({ ok: false, detail: "Invoice id required" }, { status: 400 });
    }

    const verified = await fetchVerifiedInvoice(payload.id);
    if (!verified) {
        return NextResponse.json({ ok: false, detail: "Payment verification unavailable" }, { status: 202 });
    }

    await applyPaidSubscription(verified);

    return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id") ?? undefined;
    const verified = id ? await fetchVerifiedInvoice(id) : null;
    if (verified) {
        await applyPaidSubscription(verified);
    }

    return NextResponse.redirect(new URL(`/subscription?payment=${verified?.status === "paid" ? "success" : "pending"}`, req.url), 303);
}
