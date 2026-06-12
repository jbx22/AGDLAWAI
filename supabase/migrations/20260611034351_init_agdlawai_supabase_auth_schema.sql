-- AGDLAWAI fresh Supabase schema.
-- Supabase Auth owns identity in auth.users. Application data is backend-owned:
-- browser clients use Supabase only for Auth, while API routes use service role.

create extension if not exists "pgcrypto";

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- User profiles and account administration
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
  message_credits_used integer not null default 0,
  credits_reset_date timestamptz not null default (now() + interval '30 days'),
  tabular_model text not null default 'deepseek-v4-flash',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_user
  on public.user_profiles(user_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (user_id) do nothing;
  return new;
exception when others then
  -- Never block signup if profile creation fails.
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.handle_new_user() from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

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

create index if not exists admin_audit_entity_idx
  on public.admin_audit_logs(entity_type, entity_id);

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

create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null
    check (provider in ('deepseek', 'claude', 'gemini', 'openai')),
  encrypted_key text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_api_keys_user_provider_unique unique(user_id, provider)
);

create index if not exists idx_user_api_keys_user
  on public.user_api_keys(user_id);

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
  on public.projects using gin(shared_with);

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
  filename text not null,
  file_type text,
  size_bytes integer not null default 0,
  page_count integer,
  structure_tree jsonb,
  status text not null default 'pending',
  folder_id uuid references public.project_subfolders(id) on delete set null,
  current_version_id uuid,
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
  storage_path text not null,
  pdf_storage_path text,
  source text not null default 'upload',
  version_number integer,
  display_name text,
  created_at timestamptz not null default now(),
  constraint document_versions_source_check
    check (source in (
      'upload',
      'user_upload',
      'assistant_edit',
      'user_accept',
      'user_reject',
      'generated'
    ))
);

create index if not exists document_versions_document_id_idx
  on public.document_versions(document_id, created_at);

create index if not exists document_versions_doc_vnum_idx
  on public.document_versions(document_id, version_number);

alter table public.documents
  add constraint documents_current_version_id_fkey
  foreign key (current_version_id)
  references public.document_versions(id)
  on delete set null;

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
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists document_edits_document_id_idx
  on public.document_edits(document_id, created_at);

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
  constraint hidden_workflows_user_workflow_unique unique(user_id, workflow_id)
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

alter table public.document_edits
  add constraint document_edits_chat_message_id_fkey
  foreign key (chat_message_id)
  references public.chat_messages(id)
  on delete set null;

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
  on public.tabular_reviews using gin(shared_with);

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
  on public.tabular_review_chats(review_id, updated_at);

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
-- RLS and API grants
-- ---------------------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_api_keys enable row level security;
alter table public.projects enable row level security;
alter table public.project_subfolders enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_edits enable row level security;
alter table public.workflows enable row level security;
alter table public.hidden_workflows enable row level security;
alter table public.workflow_shares enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.tabular_reviews enable row level security;
alter table public.tabular_cells enable row level security;
alter table public.tabular_review_chats enable row level security;
alter table public.tabular_review_chat_messages enable row level security;

revoke all on table public.user_profiles from anon, authenticated;
revoke all on table public.admin_audit_logs from anon, authenticated;
revoke all on table public.subscriptions from anon, authenticated;
revoke all on table public.user_api_keys from anon, authenticated;
revoke all on table public.projects from anon, authenticated;
revoke all on table public.project_subfolders from anon, authenticated;
revoke all on table public.documents from anon, authenticated;
revoke all on table public.document_versions from anon, authenticated;
revoke all on table public.document_edits from anon, authenticated;
revoke all on table public.workflows from anon, authenticated;
revoke all on table public.hidden_workflows from anon, authenticated;
revoke all on table public.workflow_shares from anon, authenticated;
revoke all on table public.chats from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;
revoke all on table public.tabular_reviews from anon, authenticated;
revoke all on table public.tabular_cells from anon, authenticated;
revoke all on table public.tabular_review_chats from anon, authenticated;
revoke all on table public.tabular_review_chat_messages from anon, authenticated;

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
