import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import { getBillingPlan, nextPeriodEnd, normalizePlanId } from "../lib/billingPlans";
import {
  getEntitlement,
  markPaymentFailed,
  runSubscriptionMaintenance,
  subscriptionOverview,
} from "../lib/subscription";

type MoyasarInvoice = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  url?: string;
  metadata?: {
    plan_id?: string;
    user_id?: string;
    tier?: string;
  };
};

type MoyasarPayment = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  invoice_id?: string;
  metadata?: {
    plan_id?: string;
    user_id?: string;
    tier?: string;
  };
};

type MoyasarWebhook = {
  id?: string;
  type?: string;
  secret_token?: string;
  data?: MoyasarPayment;
};

const MOYASAR_INVOICES_URL = "https://api.moyasar.com/v1/invoices";

export const billingRouter = Router();

function basicAuth(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

function frontendUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function requestBaseUrl(req: import("express").Request): string {
  const proto = req.headers["x-forwarded-proto"]?.toString().split(",")[0] || req.protocol;
  const host = req.headers["x-forwarded-host"]?.toString().split(",")[0] || req.get("host");
  return `${proto}://${host}`.replace(/\/$/, "");
}

function moyasarSecret(): string | null {
  return process.env.MOYASAR_SECRET_KEY?.trim() || null;
}

function moyasarWebhookSecret(): string | null {
  return process.env.MOYASAR_WEBHOOK_SECRET?.trim() || null;
}

function cronSecret(): string | null {
  return (process.env.BILLING_CRON_SECRET ?? process.env.CRON_SECRET ?? "").trim() || null;
}

async function fetchVerifiedInvoice(invoiceId: string): Promise<MoyasarInvoice | null> {
  const secretKey = moyasarSecret();
  if (!secretKey) return null;
  const response = await fetch(`${MOYASAR_INVOICES_URL}/${encodeURIComponent(invoiceId)}`, {
    headers: {
      Authorization: basicAuth(secretKey),
      Accept: "application/json",
    },
  });
  if (!response.ok) return null;
  return (await response.json()) as MoyasarInvoice;
}

function expectedPaidInvoice(invoice: MoyasarInvoice): boolean {
  const plan = getBillingPlan(invoice.metadata?.plan_id);
  return (
    !!plan &&
    invoice.status === "paid" &&
    typeof invoice.id === "string" &&
    invoice.amount === plan.amountHalalas &&
    (invoice.currency ?? "").toUpperCase() === "SAR" &&
    invoice.metadata?.user_id !== undefined
  );
}

async function applyPaidInvoice(invoice: MoyasarInvoice): Promise<boolean> {
  if (!expectedPaidInvoice(invoice) || !invoice.id || !invoice.metadata?.user_id) {
    return false;
  }
  const plan = getBillingPlan(invoice.metadata.plan_id);
  if (!plan) return false;

  const db = createServerSupabase();
  const { data: existing } = await db
    .from("subscriptions")
    .select("id")
    .eq("provider", "moyasar")
    .eq("provider_invoice_id", invoice.id)
    .maybeSingle();
  if (existing) return false;

  const periodEnd = nextPeriodEnd();

  const { error: profileError } = await db
    .from("user_profiles")
    .update({
      tier: plan.tier,
      subscription_plan_id: plan.id,
      subscription_status: "active",
      subscription_current_period_end: periodEnd,
      subscription_grace_until: null,
      subscription_auto_renew: true,
      account_status: "active",
      suspension_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", invoice.metadata.user_id);
  if (profileError) throw profileError;

  const { error: insertError } = await db.from("subscriptions").insert({
    user_id: invoice.metadata.user_id,
    provider: "moyasar",
    provider_invoice_id: invoice.id,
    plan_id: plan.id,
    tier: plan.tier,
    status: "active",
    amount_cents: plan.amountHalalas,
    currency: "SAR",
    current_period_end: periodEnd,
    auto_renew: true,
    last_payment_status: "paid",
    metadata: invoice,
  });
  if (insertError && insertError.code !== "23505") throw insertError;
  const { data: subscription } = await db
    .from("subscriptions")
    .select("id")
    .eq("provider", "moyasar")
    .eq("provider_invoice_id", invoice.id)
    .maybeSingle();
  await Promise.all([
    db.from("subscription_payment_events").insert({
      user_id: invoice.metadata.user_id,
      subscription_id: subscription?.id ?? null,
      provider: "moyasar",
      provider_event_id: invoice.id,
      provider_invoice_id: invoice.id,
      plan_id: plan.id,
      status: "paid",
      amount_cents: plan.amountHalalas,
      currency: "SAR",
      metadata: invoice,
    }),
    db.from("subscription_renewal_events").insert({
      user_id: invoice.metadata.user_id,
      subscription_id: subscription?.id ?? null,
      plan_id: plan.id,
      status: "renewed",
      due_at: periodEnd,
      processed_at: new Date().toISOString(),
      metadata: { provider_invoice_id: invoice.id },
    }),
  ]);
  return !insertError;
}

async function applyFailedPayment(payment: MoyasarPayment, eventId?: string | null) {
  const invoiceId = payment.invoice_id ?? "";
  const db = createServerSupabase();
  const { data: sub } = invoiceId
    ? await db
        .from("subscriptions")
        .select("id, user_id, plan_id, failed_payment_count")
        .eq("provider", "moyasar")
        .eq("provider_invoice_id", invoiceId)
        .maybeSingle()
    : { data: null };
  const userId = payment.metadata?.user_id ?? (sub as any)?.user_id ?? null;
  if (!userId) return false;
  const planId = normalizePlanId(payment.metadata?.plan_id ?? (sub as any)?.plan_id);
  await markPaymentFailed({
    userId,
    planId,
    subscriptionId: (sub as any)?.id ?? null,
    provider: "moyasar",
    providerEventId: eventId ?? payment.id ?? null,
    providerInvoiceId: invoiceId || null,
    amountCents: payment.amount ?? 0,
    currency: payment.currency ?? "SAR",
    metadata: {
      payment,
      failed_payment_count: Number((sub as any)?.failed_payment_count ?? 0) + 1,
    },
    db,
  });
  return true;
}

billingRouter.get("/subscription", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  try {
    res.json(await subscriptionOverview(userId));
  } catch (error) {
    res.status(500).json({
      detail: error instanceof Error ? error.message : "Subscription lookup failed",
    });
  }
});

billingRouter.patch("/subscription/auto-renew", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ detail: "enabled must be a boolean" });
    return;
  }
  const db = createServerSupabase();
  const entitlement = await getEntitlement(userId, db);
  const now = new Date().toISOString();
  const [{ error: profileError }, { error: subError }] = await Promise.all([
    db.from("user_profiles").update({
      subscription_auto_renew: enabled,
      updated_at: now,
    }).eq("user_id", userId),
    db.from("subscriptions").update({
      auto_renew: enabled,
      updated_at: now,
    }).eq("user_id", userId).in("status", ["active", "past_due", "grace_period"]),
  ]);
  if (profileError || subError) {
    res.status(500).json({ detail: profileError?.message ?? subError?.message });
    return;
  }
  await db.from("subscription_renewal_events").insert({
    user_id: userId,
    plan_id: entitlement.plan.id,
    status: "admin_changed",
    processed_at: now,
    metadata: { action: "auto_renew.updated", enabled },
  });
  res.json(await subscriptionOverview(userId, db));
});

billingRouter.post("/moyasar/checkout", requireAuth, async (req, res) => {
  const secretKey = moyasarSecret();
  if (!secretKey) {
    res.status(503).json({
      code: "moyasar_not_configured",
      detail: "Moyasar payment gateway is not configured.",
    });
    return;
  }

  const plan = getBillingPlan(String(req.body?.plan ?? ""));
  const locale = String(req.body?.locale ?? "ar") === "en" ? "en" : "ar";
  if (!plan || plan.id === "free" || plan.id === "enterprise") {
    res.status(400).json({ code: "invalid_plan", detail: "Invalid paid plan." });
    return;
  }

  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string | undefined;
  const baseUrl = frontendUrl();
  const callbackBase =
    (process.env.PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? process.env.BACKEND_PUBLIC_URL ?? "")
      .replace(/\/$/, "") || requestBaseUrl(req);
  const callbackUrl = `${callbackBase}/billing/moyasar/callback`;

  const response = await fetch(MOYASAR_INVOICES_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: plan.amountHalalas,
      currency: "SAR",
      description: locale === "en" ? plan.descriptionEn : plan.descriptionAr,
      callback_url: callbackUrl,
      success_url: `${baseUrl}/subscription?payment=success&plan=${plan.id}`,
      back_url: `${baseUrl}/subscription?plan=${plan.id}`,
      metadata: {
        plan_id: plan.id,
        tier: plan.tier,
        user_id: userId,
        user_email: userEmail,
        source: "agdlawai",
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    res.status(502).json({
      code: "moyasar_error",
      detail: detail || "Failed to create Moyasar invoice.",
    });
    return;
  }

  const invoice = (await response.json()) as MoyasarInvoice;
  if (!invoice.url) {
    res.status(502).json({ code: "moyasar_error", detail: "Moyasar invoice URL missing." });
    return;
  }
  res.json({ url: invoice.url, invoiceId: invoice.id ?? null });
});

billingRouter.post("/moyasar/callback", async (req, res) => {
  const invoiceId = typeof req.body?.id === "string" ? req.body.id : "";
  if (!invoiceId) {
    res.status(400).json({ ok: false, detail: "Invoice id required" });
    return;
  }
  const verified = await fetchVerifiedInvoice(invoiceId);
  if (!verified) {
    res.status(202).json({ ok: false, detail: "Payment verification unavailable" });
    return;
  }
  await applyPaidInvoice(verified);
  res.json({ ok: true });
});

billingRouter.post("/moyasar/webhook", async (req, res) => {
  const body = req.body as MoyasarWebhook;
  const configuredSecret = moyasarWebhookSecret();
  if (configuredSecret && body.secret_token !== configuredSecret) {
    res.status(401).json({ ok: false, detail: "Invalid webhook secret" });
    return;
  }

  const type = String(body.type ?? "");
  const payment = body.data ?? {};
  try {
    if (type === "payment_paid" && payment.invoice_id) {
      const verified = await fetchVerifiedInvoice(payment.invoice_id);
      if (verified) await applyPaidInvoice(verified);
    } else if (type === "payment_faild" || type === "payment_failed" || payment.status === "failed") {
      await applyFailedPayment(payment, body.id ?? null);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("[billing/moyasar/webhook]", error);
    res.status(500).json({
      ok: false,
      detail: error instanceof Error ? error.message : "Webhook processing failed",
    });
  }
});

billingRouter.post("/maintenance/renewals", async (req, res) => {
  const secret = cronSecret();
  const provided =
    req.headers.authorization?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers["x-cron-secret"]?.toString() ||
    "";
  if (secret && provided !== secret) {
    res.status(401).json({ detail: "Invalid cron secret" });
    return;
  }
  if (!secret && process.env.NODE_ENV === "production") {
    res.status(503).json({ detail: "Billing cron secret is not configured" });
    return;
  }
  try {
    res.json(await runSubscriptionMaintenance());
  } catch (error) {
    res.status(500).json({
      detail: error instanceof Error ? error.message : "Renewal maintenance failed",
    });
  }
});

billingRouter.get("/moyasar/callback", async (req, res) => {
  const invoiceId = typeof req.query.id === "string" ? req.query.id : "";
  const verified = invoiceId ? await fetchVerifiedInvoice(invoiceId) : null;
  if (verified) {
    await applyPaidInvoice(verified);
  }
  const payment = verified?.status === "paid" ? "success" : "pending";
  const plan = verified?.metadata?.plan_id ? `&plan=${encodeURIComponent(verified.metadata.plan_id)}` : "";
  res.redirect(303, `${frontendUrl()}/subscription?payment=${payment}${plan}`);
});
