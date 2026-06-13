# AGDLAWAI backend deployment

AGDLAWAI uses Supabase for Auth and Postgres, but the website also needs the
Node/Express backend in `backend/` for chat, document processing, admin APIs,
billing callbacks, R2 downloads, and LibreOffice document conversion.

## Required runtime

- Node.js 22
- LibreOffice Writer / `soffice`
- Public HTTPS URL, usually `https://api.agdlawai.com`
- Environment variables set only on the backend host

## Required environment variables

```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://agdlawai.com
FRONTEND_URLS=https://agdlawai.com,https://www.agdlawai.com
BACKEND_PUBLIC_URL=https://api.agdlawai.com

SUPABASE_URL=https://xritxanibwvcsucbbykf.supabase.co
SUPABASE_SECRET_KEY=...

R2_ENDPOINT_URL=https://20af8653055a0b9e99aa4a30e346f3d4.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=mike

DOWNLOAD_SIGNING_SECRET=...
USER_API_KEYS_ENCRYPTION_SECRET=...

SUPER_ADMIN_EMAIL=jabosaag@gmail.com
SUPER_ADMIN_EMAILS=jabosaag@gmail.com
ADMIN_EMAILS=

MOYASAR_SECRET_KEY=...
MOYASAR_WEBHOOK_SECRET=...
BILLING_CRON_SECRET=...

DEEPSEEK_API_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
RESEND_API_KEY=...
COURTLISTENER_API_TOKEN=...
```

Do not set `SUPABASE_SECRET_KEY`, R2 secrets, provider API keys, or payment
secrets in the frontend or any `NEXT_PUBLIC_*` variable.

## Docker deployment

The backend includes `backend/Dockerfile`, which installs Node.js dependencies,
builds TypeScript, and includes LibreOffice for document conversion.

From the repo root:

```bash
docker build -t agdlawai-backend ./backend
docker run --env-file ./backend/.env.local -p 3001:3001 agdlawai-backend
```

Then verify:

```bash
curl http://localhost:3001/health
```

## Cloudflare routing

Point `api.agdlawai.com` at the backend host. If using Cloudflare Tunnel, create
a public hostname:

- Hostname: `api.agdlawai.com`
- Service: `http://localhost:3001` for a local tunnel, or the private service
  URL for a deployed container/VM

The frontend must use:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.agdlawai.com
```

## Scheduled jobs

Configure a scheduler to call the renewal monitor at least hourly:

```bash
POST https://api.agdlawai.com/billing/maintenance/renewals
Authorization: Bearer <BILLING_CRON_SECRET>
```

The same call can be run with:

```bash
node scripts/run-billing-renewals.mjs
```
