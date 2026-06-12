# AGDLAWAI Supabase Integration Security Report

Date: 2026-06-12
Branch: `codex/supabase-auth-integration`

## Scope

Reviewed the Supabase/Auth integration changes for AGDLAWAI, including database schema migration, auth/admin flows, payment callback handling, document upload/export routes, API-key storage, and dependency advisories.

The scan used targeted code review plus parallel security discovery over:

- Auth/admin authorization and Supabase Auth migration paths.
- Document upload, storage, and ZIP export paths.
- API-key encryption, billing callbacks, and dependency risk.

## Fixed Findings

### Reserved admin email self-registration

Risk: A public signup request using an email in `SUPER_ADMIN_EMAILS` or `ADMIN_EMAILS` could create a confirmed Supabase Auth user and inherit admin privileges from environment-derived role logic.

Fix: `frontend/src/app/api/auth/signup/route.ts` now blocks public signup for environment-reserved admin emails. These accounts must be provisioned by an administrator.

Validation: `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed in `frontend`.

### Admin mutation of environment-derived admins

Risk: Admin account mutation checked only `user_profiles.role`. An environment-derived super admin with a default profile role could be suspended or changed by a normal admin.

Fix: `frontend/src/app/api/admin/users/[userId]/route.ts` now resolves the target's effective role from both environment-derived role and profile role before allowing admin mutation.

Validation: `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed in `frontend`.

### Moyasar invoice replay and mismatch acceptance

Risk: Replaying a paid Moyasar invoice could repeatedly update a profile and insert additional subscription rows. The callback also did not verify invoice amount/currency against the selected plan before granting access.

Fixes:

- `frontend/src/app/api/billing/moyasar/callback/route.ts` now requires a verified `paid` invoice with matching amount and `SAR` currency.
- The callback checks for an existing invoice and wraps subscription application in a transaction.
- Duplicate invoice insertion is treated as idempotent.
- `frontend/src/db/schema.ts` and `supabase/migrations/20260611034351_init_agdlawai_supabase_auth_schema.sql` now include a unique provider/invoice constraint or index for non-null invoice IDs.

Validation: `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed in `frontend`.

### ZIP export path traversal filenames

Risk: Document filenames were written directly into generated ZIP archives, allowing names with `../`, path separators, drive prefixes, or control characters.

Fixes:

- `frontend/src/app/api/single-documents/download-zip/route.ts` sanitizes ZIP entry names and deduplicates collisions.
- `backend/src/routes/documents.ts` applies the same ZIP entry sanitization.

Validation: `npm run build` passed in `backend`; frontend type/lint/build passed.

### Unbounded frontend upload buffering

Risk: The Next.js upload path buffered uploaded files before enforcing a size boundary.

Fix: `frontend/src/app/api/document-upload.ts` now rejects files larger than 100 MB before `arrayBuffer()` is called. `supabase/config.toml` local storage limit was aligned to `100MiB`.

Validation: frontend type/lint/build passed.

## Supabase Integration Status

Completed in Supabase:

- Created hosted project `AGDLAWAI` in org `fleipodaklddnelgbehb`, region `eu-central-1`.
- Project ref: `xritxanibwvcsucbbykf`.
- Linked local Supabase config to the hosted project.
- Applied migration `20260611034351_init_agdlawai_supabase_auth_schema.sql`.
- Wrote real local values to ignored `frontend/.env.local`.
- Verified transaction pooler connectivity via `aws-1-eu-central-1.pooler.supabase.com`.
- Seeded 6 system workflows into `public.workflows`.

Completed in repo:

- Added `supabase/config.toml` with `auto_expose_new_tables = false`.
- Added tracked migration `supabase/migrations/20260611034351_init_agdlawai_supabase_auth_schema.sql`.
- Migration uses `auth.users` as the canonical user identity source and creates app tables with RLS enabled.
- Migration revokes direct table access from `anon` and `authenticated`, and grants backend access to `service_role`.
- Auth/admin code now uses Supabase Auth Admin APIs instead of relying on a conflicting `public.users` table.
- Environment templates now include Supabase Postgres/API variables and `USER_API_KEYS_ENCRYPTION_SECRET`.
- API-key routes now delegate to the stricter helper requiring `USER_API_KEYS_ENCRYPTION_SECRET`.

Remote validation:

- Migration history matches locally and remotely.
- All public app tables have RLS enabled.
- `anon` and `authenticated` have no direct sampled table grants; `service_role` has backend table access.
- `private.handle_new_user()` is `security definer` but not executable by `anon` or `authenticated`.
- Auth trigger `on_auth_user_created` exists and is enabled.
- Auth-owned foreign keys point to `auth.users` for user profiles, subscriptions, API keys, and admin audit user references.
- Supabase advisors at `warn` level report no security or performance issues.

## Dependency Advisories

Frontend `npm audit --json` reports 19 advisories: 13 moderate and 6 high. High-risk chains include `next-pwa` / Workbox / `serialize-javascript` and `tmp`. Several npm suggested fixes require semver-major downgrades or major package changes, so they were not force-applied during this integration pass.

Backend `npm audit --json` reports 2 advisories: `@anthropic-ai/sdk` moderate and transitive `tmp` high. The SDK fix is semver-major.

## Validation Commands

- `cd frontend && npm install`: passed.
- `cd frontend && npx tsc --noEmit`: passed.
- `cd frontend && npm run lint`: passed with 153 existing warnings and 0 errors.
- `cd frontend && npm run build`: passed.
- `cd backend && npm install`: passed, with audit advisories noted.
- `cd backend && npm run build`: passed.
- `cd frontend && npm run db:seed`: passed; 6 system workflows inserted.
- `supabase db push --linked --dry-run`: passed; one pending migration before apply.
- `supabase db push --linked`: passed; migration applied.
- `supabase migration list --linked`: passed; local and remote migration versions match.
- `supabase db advisors --linked --type security --level warn --fail-on none`: passed; no issues found.
- `supabase db advisors --linked --type performance --level warn --fail-on none`: passed; no issues found.
- `Invoke-WebRequest http://localhost:3000/api/health`: passed with HTTP 200.
- `Invoke-WebRequest http://localhost:3000/signup`: passed with HTTP 200.
- `cd frontend && npm audit --json`: completed with advisories.
- `cd backend && npm audit --json`: completed with advisories.

## Remaining Work

- Populate real local/deployment secrets outside Git.
- Decide dependency remediation strategy for `next-pwa`/Workbox, `tmp`, and `@anthropic-ai/sdk`.
- Complete manual browser QA for signup, login, profile edits, project creation, document upload, workflow visibility, and user API-key save/delete.
