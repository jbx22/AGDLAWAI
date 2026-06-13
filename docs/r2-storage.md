# Cloudflare R2 storage

AGDLAWAI keeps the original Mike-compatible S3 storage wiring. The backend uses the AWS SDK against a Cloudflare R2 S3-compatible endpoint in `backend/src/lib/storage.ts`.

## Bucket

- Cloudflare account ID: `20af8653055a0b9e99aa4a30e346f3d4`
- R2 bucket: `mike`
- Bucket location: `EEUR`
- Storage class: `Standard`
- Endpoint URL: `https://20af8653055a0b9e99aa4a30e346f3d4.r2.cloudflarestorage.com`

## Backend environment

Set these only on the backend host. Do not expose R2 keys in the frontend.

```bash
R2_ENDPOINT_URL=https://20af8653055a0b9e99aa4a30e346f3d4.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=replace-with-cloudflare-r2-access-key-id
R2_SECRET_ACCESS_KEY=replace-with-cloudflare-r2-secret-access-key
R2_BUCKET_NAME=mike
```

## Create R2 S3 credentials

Cloudflare displays the R2 S3 secret only once when creating the token.

1. Open Cloudflare dashboard.
2. Go to R2 > Manage R2 API Tokens.
3. Create a token with object read/write access for bucket `mike`.
4. Store the Access Key ID and Secret Access Key only in the backend deployment environment.

## CORS

The bucket CORS policy allows read access for signed URLs from:

- `https://agdlawai.com`
- `https://www.agdlawai.com`
- `http://localhost:3000`

Allowed methods are `GET` and `HEAD`; write access stays backend-only.

## Verification

Bucket provisioning was verified with Wrangler remote object operations:

```bash
npx wrangler r2 object put mike/codex-smoke/r2-smoke.txt --remote
npx wrangler r2 object get mike/codex-smoke/r2-smoke.txt --remote
npx wrangler r2 object delete mike/codex-smoke/r2-smoke.txt --remote
```

The smoke object was deleted after verification.
