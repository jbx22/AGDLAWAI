#!/usr/bin/env node

const baseUrl = (
  process.env.BACKEND_PUBLIC_URL ||
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.agdlawai.com"
).replace(/\/$/, "");

const secret = process.env.BILLING_CRON_SECRET || process.env.CRON_SECRET;

if (!secret) {
  console.error("BILLING_CRON_SECRET or CRON_SECRET must be set.");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/billing/maintenance/renewals`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    Accept: "application/json",
  },
});

const body = await response.text();
if (!response.ok) {
  console.error(`Renewal maintenance failed: ${response.status} ${body}`);
  process.exit(1);
}

console.log(body);
