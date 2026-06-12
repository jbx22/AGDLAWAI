-- Production SaaS subscriptions, usage metering, and renewal monitoring.
-- Tables remain backend-owned: browser clients authenticate with Supabase Auth,
-- then the Express API enforces authorization and quotas with the service role.

alter table public.user_profiles
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'grace_period', 'suspended', 'canceled', 'free')),
  add column if not exists subscription_plan_id text not null default 'professional',
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_grace_until timestamptz,
  add column if not exists subscription_auto_renew boolean not null default true;

alter table public.user_profiles
  alter column trial_started_at set default now(),
  alter column trial_ends_at set default (now() + interval '14 days'),
  alter column subscription_current_period_end set default (now() + interval '14 days'),
  alter column subscription_plan_id set default 'professional',
  alter column subscription_status set default 'trialing';

update public.user_profiles
set
  trial_started_at = coalesce(trial_started_at, created_at, now()),
  trial_ends_at = coalesce(trial_ends_at, created_at + interval '14 days', now() + interval '14 days'),
  subscription_current_period_end = coalesce(subscription_current_period_end, created_at + interval '14 days', now() + interval '14 days'),
  subscription_plan_id = coalesce(nullif(subscription_plan_id, ''), 'professional'),
  subscription_status = case
    when subscription_status is null then 'trialing'
    else subscription_status
  end
where trial_started_at is null
   or trial_ends_at is null
   or subscription_current_period_end is null;

alter table public.subscriptions
  add column if not exists billing_interval text not null default 'month',
  add column if not exists auto_renew boolean not null default true,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists grace_until timestamptz,
  add column if not exists failed_payment_count integer not null default 0,
  add column if not exists last_payment_status text,
  add column if not exists suspended_at timestamptz;

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

alter table public.subscription_usage_events enable row level security;
alter table public.subscription_renewal_events enable row level security;
alter table public.subscription_payment_events enable row level security;
alter table public.subscription_admin_audit_logs enable row level security;

revoke all on public.subscription_usage_events from anon, authenticated;
revoke all on public.subscription_renewal_events from anon, authenticated;
revoke all on public.subscription_payment_events from anon, authenticated;
revoke all on public.subscription_admin_audit_logs from anon, authenticated;

grant all privileges on public.subscription_usage_events to service_role;
grant all privileges on public.subscription_renewal_events to service_role;
grant all privileges on public.subscription_payment_events to service_role;
grant all privileges on public.subscription_admin_audit_logs to service_role;

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
  return new;
end;
$$;
