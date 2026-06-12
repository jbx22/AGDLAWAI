-- Production admin / super-admin management system.
-- Backend-owned tables: anon/authenticated direct access is revoked; Express
-- APIs enforce RBAC and write audit entries with service-role access.

alter table public.user_profiles
  add column if not exists admin_access_enabled boolean not null default true,
  add column if not exists last_admin_login_at timestamptz,
  add column if not exists last_admin_login_ip text,
  add column if not exists admin_notes text;

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
