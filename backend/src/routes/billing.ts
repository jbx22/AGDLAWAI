import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import { getBillingPlan } from "../lib/billingPlans";

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

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { error: profileError } = await db
    .from("user_profiles")
    .update({
      tier: plan.tier,
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
    status: "paid",
    amount_cents: plan.amountHalalas,
    currency: "SAR",
    current_period_end: periodEnd.toISOString(),
    metadata: invoice,
  });
  if (insertError && insertError.code !== "23505") throw insertError;
  return !insertError;
}

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
  if (!plan || plan.id === "explorer" || plan.id === "enterprise") {
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
