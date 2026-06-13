# Billing operations

## Moyasar webhooks

Configure Moyasar to call:

```text
https://api.agdlawai.com/billing/moyasar/webhook
```

Set `MOYASAR_WEBHOOK_SECRET` on the backend host and enter the same raw secret
token in Moyasar. The backend verifies `secret_token` when configured.

Handled events:

- `payment_paid`: verifies the invoice with Moyasar before activating the plan.
- `payment_failed`, `payment_faild`, `payment_abandoned`, `payment_voided`:
  marks the subscription/profile as `grace_period`, records a failed payment
  event, and starts a three-day grace window.

Webhook payment events are idempotent by Moyasar event id, so retries do not
double-count failed payments.

## Renewal monitor

The backend exposes a protected maintenance endpoint:

```text
POST https://api.agdlawai.com/billing/maintenance/renewals
Authorization: Bearer <BILLING_CRON_SECRET>
```

It checks trials, upcoming renewals, expired periods, grace windows, and account
suspension after grace expiry.

Any scheduler can call it every hour. For example, from this repo:

```bash
BACKEND_PUBLIC_URL=https://api.agdlawai.com \
BILLING_CRON_SECRET=... \
node scripts/run-billing-renewals.mjs
```

Keep `BILLING_CRON_SECRET` server-side only.

## Usage metering

The backend enforces:

- `uploads`: document upload count and page limits.
- `analyses`: tabular/document analysis actions.
- `summaries`: explicit summary prompts and summary-style tabular columns.
- `ai_questions`: chat and tabular review Q&A.
- `tokens`: estimated monthly token usage for AI calls.
