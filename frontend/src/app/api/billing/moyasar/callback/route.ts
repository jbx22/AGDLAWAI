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
    await applyPaidSubscription(payload);

    return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const planId = req.nextUrl.searchParams.get("plan_id") ?? undefined;
    const userId = req.nextUrl.searchParams.get("user_id") ?? undefined;
    const id = req.nextUrl.searchParams.get("id") ?? undefined;
    const amount = Number(req.nextUrl.searchParams.get("amount") ?? 0) || undefined;
    const currency = req.nextUrl.searchParams.get("currency") ?? undefined;

    await applyPaidSubscription({
        id,
        status,
        amount,
        currency,
        metadata: {
            plan_id: planId,
            user_id: userId,
        },
    });

    return NextResponse.redirect(new URL(`/subscription?payment=${status === "paid" ? "success" : "pending"}`, req.url), 303);
}
