-- Mike Supabase schema
-- Use this for a fresh Supabase database. Existing deployments should continue
-- to apply the incremental migration files in backend/oss-migrations instead.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- User profiles
-- ---------------------------------------------------------------------------

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  organisation text,
  tier text not null default 'Free',
  role text not null default 'user'
    check (role in ('user', 'admin', 'super_admin')),
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'deleted')),
  suspension_reason text,
  admin_access_enabled boolean not null default true,
  last_admin_login_at timestamptz,
  last_admin_login_ip text,
  admin_notes text,
  trial_started_at timestamptz default now(),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'grace_period', 'suspended', 'canceled', 'free')),
  subscription_plan_id text not null default 'professional',
  subscription_current_period_end timestamptz default (now() + interval '14 days'),
  subscription_grace_until timestamptz,
  subscription_auto_renew boolean not null default true,
  message_credits_used integer not null default 0,
  credits_reset_date timestamptz not null default (now() + interval '30 days'),
  title_model text,
  tabular_model text not null default 'deepseek-v4-flash',
  quote_model text,
  mfa_on_login boolean not null default false,
  legal_research_us boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_user
  on public.user_profiles(user_id);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_actor_idx
  on public.admin_audit_logs(actor_user_id, created_at);

create index if not exists admin_audit_target_idx
  on public.admin_audit_logs(target_user_id, created_at);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'moyasar',
  provider_invoice_id text,
  plan_id text not null,
  tier text not null,
  status text not null default 'pending',
  amount_cents integer not null default 0,
  currency text not null default 'SAR',
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  billing_interval text not null default 'month',
  auto_renew boolean not null default true,
  trial_ends_at timestamptz,
  grace_until timestamptz,
  failed_payment_count integer not null default 0,
  last_payment_status text,
  suspended_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx
  on public.subscriptions(user_id, status);

create unique index if not exists subscriptions_provider_invoice_unique
  on public.subscriptions(provider, provider_invoice_id)
  where provider_invoice_id is not null;

create table if not exists public.subscription_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id text not null,
  metric text not null
    check (metric in ('analyses', 'summaries', 'uploads', 'ai_questions', 'tokens')),
  quantity integer not null default 1 check (quantity >= 0),
  period_key text not null,
  source text not null,
  model text,
  tokens_prompt integer not null default 0,
  tokens_completion integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_usage_events_user_metric_period_idx
  on public.subscription_usage_events(user_id, metric, period_key);

create index if not exists subscription_usage_events_created_idx
  on public.subscription_usage_events(created_at desc);

create table if not exists public.subscription_renewal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id text not null,
  status text not null
    check (status in ('trial_started', 'trial_expired', 'renewal_due', 'renewed', 'payment_failed', 'grace_started', 'suspended', 'downgraded', 'admin_changed')),
  due_at timestamptz,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_renewal_events_user_idx
  on public.subscription_renewal_events(user_id, created_at desc);

create index if not exists subscription_renewal_events_status_idx
  on public.subscription_renewal_events(status, created_at desc);

create table if not exists public.subscription_payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'moyasar',
  provider_event_id text,
  provider_invoice_id text,
  plan_id text,
  status text not null,
  amount_cents integer not null default 0,
  currency text not null default 'SAR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_payment_events_user_idx
  on public.subscription_payment_events(user_id, created_at desc);

create index if not exists subscription_payment_events_status_idx
  on public.subscription_payment_events(status, created_at desc);

create unique index if not exists subscription_payment_events_provider_event_unique
  on public.subscription_payment_events(provider, provider_event_id)
  where provider_event_id is not null;

create table if not exists public.subscription_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_admin_audit_logs_target_idx
  on public.subscription_admin_audit_logs(target_user_id, created_at desc);

create table if not exists public.admin_permissions (
  id text primary key,
  category text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission_id text not null references public.admin_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.admin_role_assignments (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  unique(admin_user_id, role_id)
);

create index if not exists admin_role_assignments_user_idx
  on public.admin_role_assignments(admin_user_id);

create table if not exists public.admin_login_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  email text,
  event_type text not null
    check (event_type in ('login', 'logout', 'session_revoked', 'password_reset_requested', 'access_denied')),
  success boolean not null default true,
  ip_address text,
  user_agent text,
  device jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_events_user_idx
  on public.admin_login_events(admin_user_id, created_at desc);

create index if not exists admin_login_events_type_idx
  on public.admin_login_events(event_type, created_at desc);

create table if not exists public.admin_activity_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  email text,
  action text not null,
  module text not null,
  target_type text,
  target_id text,
  status text not null default 'success'
    check (status in ('success', 'failure', 'blocked')),
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_events_user_idx
  on public.admin_activity_events(admin_user_id, created_at desc);

create index if not exists admin_activity_events_action_idx
  on public.admin_activity_events(action, created_at desc);

create table if not exists public.admin_system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  subject text,
  status text not null default 'open'
    check (status in ('open', 'pending', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_requests_status_idx
  on public.support_requests(status, created_at desc);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  subject text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'resolved', 'spam')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_messages_status_idx
  on public.contact_messages(status, created_at desc);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text,
  model text,
  route text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  status text not null default 'success'
    check (status in ('success', 'failed', 'blocked')),
  error_code text,
  latency_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_idx
  on public.ai_usage_events(user_id, created_at desc);

create index if not exists ai_usage_events_model_idx
  on public.ai_usage_events(provider, model, created_at desc);

insert into public.admin_permissions (id, category, description)
values
  ('users.read', 'User Management', 'View users and account profiles'),
  ('users.write', 'User Management', 'Edit user tier, status, and quota fields'),
  ('users.suspend', 'User Management', 'Suspend or reactivate user accounts'),
  ('subscriptions.read', 'Subscription & Billing', 'View subscriptions and billing status'),
  ('subscriptions.write', 'Subscription & Billing', 'Manage subscription state and billing support actions'),
  ('ai_usage.read', 'AI Usage Monitoring', 'View AI/token usage and failed requests'),
  ('ai_models.manage', 'AI Model/API Management', 'Manage model/provider settings and key placeholders'),
  ('content.manage', 'Content/Website', 'Manage website content and settings'),
  ('support.manage', 'Customer Support', 'View and manage support/contact requests'),
  ('analytics.read', 'Analytics', 'View visitor, conversion, and revenue analytics'),
  ('audit.read', 'Compliance & Audit', 'View and export audit/security logs'),
  ('settings.manage', 'System Settings', 'Manage system-level settings'),
  ('admins.read', 'Admin Management', 'View admins and roles'),
  ('admins.write', 'Admin Management', 'Create, edit, suspend, and revoke admins'),
  ('admins.delete', 'Admin Management', 'Delete admin accounts with audit logging'),
  ('rbac.manage', 'Admin Management', 'Manage admin roles and permissions')
on conflict (id) do update
set category = excluded.category,
    description = excluded.description;

insert into public.admin_roles (slug, name, description, is_system)
values
  ('user-management-admin', 'User Management Admin', 'Manage users, statuses, tiers, and quotas.', true),
  ('subscription-billing-admin', 'Subscription & Billing Admin', 'Manage subscriptions, payments, and billing support.', true),
  ('ai-usage-monitoring-admin', 'AI Usage Monitoring Admin', 'Monitor AI usage, failed requests, and token consumption.', true),
  ('ai-model-api-management-admin', 'AI Model/API Management Admin', 'Manage provider/model settings and API key placeholders.', true),
  ('content-website-admin', 'Content/Website Admin', 'Manage website content and settings.', true),
  ('customer-support-admin', 'Customer Support Admin', 'Manage support requests and contact forms.', true),
  ('analytics-admin', 'Analytics Admin', 'View SaaS analytics, traffic, and revenue dashboards.', true),
  ('compliance-audit-admin', 'Compliance & Audit Admin', 'View and export admin/security audit logs.', true),
  ('system-settings-admin', 'System Settings Admin', 'Manage system-level configuration.', true),
  ('super-admin', 'Super Admin', 'Full administrative control.', true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    is_system = excluded.is_system,
    updated_at = now();

with role_permission_map(role_slug, permission_id) as (
  values
    ('user-management-admin', 'users.read'),
    ('user-management-admin', 'users.write'),
    ('user-management-admin', 'users.suspend'),
    ('subscription-billing-admin', 'subscriptions.read'),
    ('subscription-billing-admin', 'subscriptions.write'),
    ('ai-usage-monitoring-admin', 'ai_usage.read'),
    ('ai-model-api-management-admin', 'ai_models.manage'),
    ('content-website-admin', 'content.manage'),
    ('customer-support-admin', 'support.manage'),
    ('analytics-admin', 'analytics.read'),
    ('compliance-audit-admin', 'audit.read'),
    ('system-settings-admin', 'settings.manage'),
    ('super-admin', 'users.read'),
    ('super-admin', 'users.write'),
    ('super-admin', 'users.suspend'),
    ('super-admin', 'subscriptions.read'),
    ('super-admin', 'subscriptions.write'),
    ('super-admin', 'ai_usage.read'),
    ('super-admin', 'ai_models.manage'),
    ('super-admin', 'content.manage'),
    ('super-admin', 'support.manage'),
    ('super-admin', 'analytics.read'),
    ('super-admin', 'audit.read'),
    ('super-admin', 'settings.manage'),
    ('super-admin', 'admins.read'),
    ('super-admin', 'admins.write'),
    ('super-admin', 'admins.delete'),
    ('super-admin', 'rbac.manage')
)
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, m.permission_id
from role_permission_map m
join public.admin_roles r on r.slug = m.role_slug
on conflict do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    user_id,
    tier,
    subscription_plan_id,
    subscription_status,
    trial_started_at,
    trial_ends_at,
    subscription_current_period_end
  )
  values (
    new.id,
    'Professional',
    'professional',
    'trialing',
    now(),
    now() + interval '14 days',
    now() + interval '14 days'
  )
  on conflict (user_id) do nothing;

  insert into public.subscription_renewal_events (
    user_id,
    plan_id,
    status,
    due_at,
    metadata
  )
  values (
    new.id,
    'professional',
    'trial_started',
    now() + interval '14 days',
    '{"source":"auth_trigger"}'::jsonb
  );

  return new;
exception when others then
  -- Never block signup if the profile insert fails.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user() from public;

create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('claude', 'deepseek', 'gemini', 'openai', 'openrouter', 'courtlistener')),
  encrypted_key text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create index if not exists idx_user_api_keys_user
  on public.user_api_keys(user_id);

alter table public.user_api_keys enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_role_assignments enable row level security;
alter table public.admin_login_events enable row level security;
alter table public.admin_activity_events enable row level security;
alter table public.admin_system_settings enable row level security;
alter table public.support_requests enable row level security;
alter table public.contact_messages enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.subscription_usage_events enable row level security;
alter table public.subscription_renewal_events enable row level security;
alter table public.subscription_payment_events enable row level security;
alter table public.subscription_admin_audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Projects and documents
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  cm_number text,
  visibility text not null default 'private',
  shared_with jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user
  on public.projects(user_id);

create index if not exists projects_shared_with_idx
  on public.projects using gin (shared_with);

create table if not exists public.project_subfolders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id text not null,
  name text not null,
  parent_folder_id uuid references public.project_subfolders(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_subfolders_project
  on public.project_subfolders(project_id);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id text not null,
  status text not null default 'pending',
  folder_id uuid references public.project_subfolders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_user_project
  on public.documents(user_id, project_id);

create index if not exists idx_documents_project_folder
  on public.documents(project_id, folder_id);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  storage_path text,
  pdf_storage_path text,
  source text not null default 'upload',
  version_number integer,
  filename text,
  file_type text,
  size_bytes integer,
  page_count integer,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  constraint document_versions_source_check
    check (source = any (array[
      'upload'::text,
      'user_upload'::text,
      'assistant_edit'::text,
      'user_accept'::text,
      'user_reject'::text,
      'generated'::text
    ]))
);

create index if not exists document_versions_document_id_idx
  on public.document_versions(document_id, created_at desc);

create index if not exists document_versions_active_document_id_idx
  on public.document_versions(document_id, created_at desc)
  where deleted_at is null;

create index if not exists document_versions_doc_vnum_idx
  on public.document_versions(document_id, version_number);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_versions_doc_version_unique'
      and conrelid = 'public.document_versions'::regclass
  ) then
    alter table public.document_versions
      add constraint document_versions_doc_version_unique
      unique (document_id, version_number);
  end if;
end;
$$;

alter table public.documents
  add column if not exists current_version_id uuid
  references public.document_versions(id) on delete set null;

create table if not exists public.document_edits (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chat_message_id uuid,
  version_id uuid not null references public.document_versions(id) on delete cascade,
  change_id text not null,
  del_w_id text,
  ins_w_id text,
  deleted_text text not null default '',
  inserted_text text not null default '',
  context_before text,
  context_after text,
  status text not null default 'pending'
    check (status = any (array[
      'pending'::text,
      'accepted'::text,
      'rejected'::text
    ])),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists document_edits_document_id_idx
  on public.document_edits(document_id, created_at desc);

create index if not exists document_edits_message_id_idx
  on public.document_edits(chat_message_id);

create index if not exists document_edits_version_id_idx
  on public.document_edits(version_id);

-- ---------------------------------------------------------------------------
-- Workflows
-- ---------------------------------------------------------------------------

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  title text not null,
  type text not null,
  prompt_md text,
  columns_config jsonb,
  practice text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflows_user
  on public.workflows(user_id);

create table if not exists public.hidden_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  workflow_id text not null,
  created_at timestamptz not null default now(),
  unique(user_id, workflow_id)
);

create index if not exists idx_hidden_workflows_user
  on public.hidden_workflows(user_id);

create table if not exists public.workflow_shares (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  shared_by_user_id text not null,
  shared_with_email text not null,
  allow_edit boolean not null default false,
  created_at timestamptz not null default now(),
  constraint workflow_shares_workflow_email_unique
    unique(workflow_id, shared_with_email)
);

create index if not exists workflow_shares_workflow_id_idx
  on public.workflow_shares(workflow_id);

create index if not exists workflow_shares_email_idx
  on public.workflow_shares(shared_with_email);

-- ---------------------------------------------------------------------------
-- Assistant chats
-- ---------------------------------------------------------------------------

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id text not null,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists idx_chats_user
  on public.chats(user_id);

create index if not exists idx_chats_project
  on public.chats(project_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null,
  content jsonb,
  files jsonb,
  annotations jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_chat
  on public.chat_messages(chat_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_edits_chat_message_id_fkey'
      and conrelid = 'public.document_edits'::regclass
  ) then
    alter table public.document_edits
      add constraint document_edits_chat_message_id_fkey
      foreign key (chat_message_id)
      references public.chat_messages(id)
      on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabular reviews
-- ---------------------------------------------------------------------------

create table if not exists public.tabular_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id text not null,
  title text,
  columns_config jsonb,
  document_ids jsonb,
  workflow_id uuid references public.workflows(id) on delete set null,
  practice text,
  shared_with jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tabular_reviews_user
  on public.tabular_reviews(user_id);

create index if not exists idx_tabular_reviews_project
  on public.tabular_reviews(project_id);

create index if not exists tabular_reviews_shared_with_idx
  on public.tabular_reviews using gin (shared_with);

create table if not exists public.tabular_cells (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.tabular_reviews(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  column_index integer not null,
  content text,
  citations jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_tabular_cells_review
  on public.tabular_cells(review_id, document_id, column_index);

create table if not exists public.tabular_review_chats (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.tabular_reviews(id) on delete cascade,
  user_id text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tabular_review_chats_review_idx
  on public.tabular_review_chats(review_id, updated_at desc);

create index if not exists tabular_review_chats_user_idx
  on public.tabular_review_chats(user_id);

create table if not exists public.tabular_review_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.tabular_review_chats(id) on delete cascade,
  role text not null,
  content jsonb,
  annotations jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tabular_review_chat_messages_chat_idx
  on public.tabular_review_chat_messages(chat_id, created_at);

-- ---------------------------------------------------------------------------
-- CourtListener bulk-data indexes
-- ---------------------------------------------------------------------------

create table if not exists public.courtlistener_citation_index (
  id bigint primary key,
  volume text not null,
  reporter text not null,
  page text not null,
  type integer,
  cluster_id bigint not null,
  date_created timestamptz,
  date_modified timestamptz
);

create index if not exists courtlistener_citation_lookup_idx
  on public.courtlistener_citation_index(volume, reporter, page);

create index if not exists courtlistener_citation_cluster_idx
  on public.courtlistener_citation_index(cluster_id);

alter table public.courtlistener_citation_index enable row level security;

create table if not exists public.courtlistener_opinion_cluster_index (
  id bigint primary key,
  case_name text,
  case_name_short text,
  case_name_full text,
  slug text,
  date_filed date,
  citation_count integer,
  precedential_status text,
  filepath_pdf_harvard text,
  filepath_json_harvard text,
  docket_id bigint
);

alter table public.courtlistener_opinion_cluster_index enable row level security;

-- ---------------------------------------------------------------------------
-- Direct client grant hardening
-- ---------------------------------------------------------------------------
--
-- The frontend uses Supabase directly only for authentication. Application
-- data access goes through the backend API with the service role after the
-- backend verifies the user's JWT. Do not grant the browser anon/authenticated
-- roles direct table privileges for backend-owned data.

revoke all on public.user_profiles from anon, authenticated;
revoke all on public.projects from anon, authenticated;
revoke all on public.project_subfolders from anon, authenticated;
revoke all on public.documents from anon, authenticated;
revoke all on public.document_versions from anon, authenticated;
revoke all on public.document_edits from anon, authenticated;
revoke all on public.workflows from anon, authenticated;
revoke all on public.hidden_workflows from anon, authenticated;
revoke all on public.workflow_shares from anon, authenticated;
revoke all on public.chats from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.tabular_reviews from anon, authenticated;
revoke all on public.tabular_cells from anon, authenticated;
revoke all on public.tabular_review_chats from anon, authenticated;
revoke all on public.tabular_review_chat_messages from anon, authenticated;
revoke all on public.user_api_keys from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.admin_permissions from anon, authenticated;
revoke all on public.admin_roles from anon, authenticated;
revoke all on public.admin_role_permissions from anon, authenticated;
revoke all on public.admin_role_assignments from anon, authenticated;
revoke all on public.admin_login_events from anon, authenticated;
revoke all on public.admin_activity_events from anon, authenticated;
revoke all on public.admin_system_settings from anon, authenticated;
revoke all on public.support_requests from anon, authenticated;
revoke all on public.contact_messages from anon, authenticated;
revoke all on public.ai_usage_events from anon, authenticated;
revoke all on public.subscription_usage_events from anon, authenticated;
revoke all on public.subscription_renewal_events from anon, authenticated;
revoke all on public.subscription_payment_events from anon, authenticated;
revoke all on public.subscription_admin_audit_logs from anon, authenticated;
revoke all on public.courtlistener_citation_index from anon, authenticated;
revoke all on public.courtlistener_opinion_cluster_index from anon, authenticated;

grant all privileges on public.admin_permissions to service_role;
grant all privileges on public.admin_roles to service_role;
grant all privileges on public.admin_role_permissions to service_role;
grant all privileges on public.admin_role_assignments to service_role;
grant all privileges on public.admin_login_events to service_role;
grant all privileges on public.admin_activity_events to service_role;
grant all privileges on public.admin_system_settings to service_role;
grant all privileges on public.support_requests to service_role;
grant all privileges on public.contact_messages to service_role;
grant all privileges on public.ai_usage_events to service_role;
grant all privileges on public.subscription_usage_events to service_role;
grant all privileges on public.subscription_renewal_events to service_role;
grant all privileges on public.subscription_payment_events to service_role;
grant all privileges on public.subscription_admin_audit_logs to service_role;
