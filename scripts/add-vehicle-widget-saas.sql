-- MG AutoTech Vehicle Selector Widget SaaS
-- Run once in Supabase SQL Editor. Safe to run again.

begin;

create extension if not exists pgcrypto;

create table if not exists public.widget_settings (
  id uuid primary key default gen_random_uuid(),
  widget_product_enabled boolean not null default true,
  public_signup_enabled boolean not null default true,
  checkout_enabled boolean not null default true,
  demo_enabled boolean not null default true,
  monthly_price numeric(10,2) not null default 4.99 check (monthly_price >= 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  default_language text not null default 'de',
  enabled_languages jsonb not null default '["de","en","tr","fr","es","it","nl","pl","ro","pt","ru","ar"]'::jsonb,
  require_domain_whitelist boolean not null default true,
  show_mg_branding boolean not null default true,
  usage_logging_enabled boolean not null default true,
  default_monthly_usage_limit integer not null default 5000 check (default_monthly_usage_limit >= 0),
  allow_script_embed boolean not null default true,
  allow_iframe_embed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists widget_settings_singleton_idx
  on public.widget_settings ((true));

insert into public.widget_settings (id)
select gen_random_uuid()
where not exists (select 1 from public.widget_settings);

create table if not exists public.widget_plans (
  id text primary key,
  name text not null,
  monthly_price numeric(10,2) not null,
  currency text not null default 'eur',
  included_domains integer not null default 1,
  monthly_usage_limit integer not null default 5000,
  can_hide_branding boolean not null default false,
  is_public boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.widget_plans (id, name, monthly_price, included_domains, monthly_usage_limit, can_hide_branding, is_public, sort_order)
values
  ('starter', 'Starter', 4.99, 1, 5000, false, true, 10),
  ('pro', 'Pro', 14.99, 3, 25000, true, false, 20),
  ('white_label', 'White Label', 29.99, 10, 100000, true, false, 30)
on conflict (id) do nothing;

create table if not exists public.vehicle_data_sources (
  id text primary key,
  name text not null,
  source_type text not null check (source_type in ('licensed_partner','html_import','manual_admin','internal')),
  base_url text,
  is_active boolean not null default true,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.vehicle_data_sources (id, name, source_type, priority)
values
  ('carecufile', 'Care ECU File', 'licensed_partner', 50),
  ('html_import', 'HTML Import', 'html_import', 80),
  ('manual_admin', 'Manual Admin Entry', 'manual_admin', 10),
  ('mg_internal', 'MG AutoTech Internal', 'internal', 1)
on conflict (id) do nothing;

create table if not exists public.vehicle_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.vehicle_data_sources(id),
  status text not null default 'processing' check (status in ('processing','completed','failed','rolled_back')),
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  error_rows integer not null default 0,
  source_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.vehicle_source_records (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.vehicle_data_sources(id),
  import_batch_id uuid references public.vehicle_import_batches(id) on delete set null,
  source_external_id text,
  canonical_fingerprint text not null,
  brand text not null,
  model text not null,
  generation text not null,
  engine text not null,
  payload jsonb not null default '{}'::jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vehicle_source_record_identity_idx
  on public.vehicle_source_records(source_id, canonical_fingerprint) where is_current;
create index if not exists vehicle_source_record_fingerprint_idx
  on public.vehicle_source_records(canonical_fingerprint);

create table if not exists public.vehicle_duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  canonical_fingerprint text not null,
  record_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'pending' check (status in ('pending','merged','kept_separate','ignored')),
  canonical_record_id uuid references public.vehicle_source_records(id) on delete set null,
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.widget_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  company_name text not null,
  email text not null,
  website_domain text not null,
  allowed_domain text not null,
  allow_www_alias boolean not null default true,
  allow_subdomains boolean not null default false,
  domain_verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending','active','past_due','suspended','cancelled')),
  admin_suspended boolean not null default false,
  widget_enabled boolean not null default true,
  plan text not null default 'starter',
  monthly_price numeric(10,2) not null default 4.99 check (monthly_price >= 0),
  currency text not null default 'eur',
  widget_title text not null default 'Vehicle Search',
  button_text text not null default 'Show tuning options',
  enquiry_email text,
  whatsapp_number text,
  main_color text not null default '#1473e6',
  button_text_color text not null default '#ffffff',
  difference_color text not null default '#8cc500',
  theme_mode text not null default 'auto' check (theme_mode in ('light','dark','auto')),
  default_language text not null default 'de',
  allowed_languages jsonb not null default '["de","en","tr","fr","es","it","nl","pl","ro","pt","ru","ar"]'::jsonb,
  show_branding boolean not null default true,
  allow_script_embed boolean not null default true,
  allow_iframe_embed boolean not null default true,
  can_edit_colours boolean not null default true,
  can_edit_language boolean not null default true,
  can_edit_contact boolean not null default true,
  can_hide_branding boolean not null default false,
  monthly_usage_limit integer not null default 5000 check (monthly_usage_limit >= 0),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists widget_clients_user_idx on public.widget_clients(user_id);
alter table public.widget_clients add column if not exists admin_suspended boolean not null default false;
create index if not exists widget_clients_email_idx on public.widget_clients(lower(email));
create unique index if not exists widget_clients_subscription_idx
  on public.widget_clients(stripe_subscription_id) where stripe_subscription_id is not null;

create table if not exists public.widget_api_keys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.widget_clients(id) on delete cascade,
  public_key text not null unique check (public_key like 'pk_mga_widget_%'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists widget_api_keys_client_idx on public.widget_api_keys(client_id, is_active);

create table if not exists public.widget_access_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.widget_clients(id) on delete set null,
  public_key text,
  request_domain text,
  allowed_domain text,
  path text,
  language text,
  status text not null check (status in ('allowed','blocked')),
  block_reason text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists widget_access_logs_client_date_idx
  on public.widget_access_logs(client_id, created_at desc);
create index if not exists widget_access_logs_blocked_idx
  on public.widget_access_logs(client_id, created_at desc) where status = 'blocked';

create table if not exists public.widget_domain_change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.widget_clients(id) on delete cascade,
  old_domain text,
  requested_domain text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists widget_domain_requests_client_idx
  on public.widget_domain_change_requests(client_id, created_at desc);

create table if not exists public.widget_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.widget_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  client_id uuid references public.widget_clients(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists widget_audit_logs_date_idx
  on public.widget_audit_logs(client_id, created_at desc);

create table if not exists public.widget_rate_limit_buckets (
  client_id uuid not null references public.widget_clients(id) on delete cascade,
  bucket_start timestamptz not null,
  request_count integer not null default 0,
  primary key (client_id, bucket_start)
);

create or replace function public.touch_widget_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists widget_settings_touch_updated_at on public.widget_settings;
create trigger widget_settings_touch_updated_at before update on public.widget_settings
for each row execute function public.touch_widget_updated_at();

drop trigger if exists widget_clients_touch_updated_at on public.widget_clients;
create trigger widget_clients_touch_updated_at before update on public.widget_clients
for each row execute function public.touch_widget_updated_at();

drop trigger if exists widget_plans_touch_updated_at on public.widget_plans;
create trigger widget_plans_touch_updated_at before update on public.widget_plans
for each row execute function public.touch_widget_updated_at();

create or replace function public.widget_consume_rate_limit(
  p_client_id uuid,
  p_limit integer default 120
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  insert into public.widget_rate_limit_buckets(client_id, bucket_start, request_count)
  values (p_client_id, v_bucket, 1)
  on conflict (client_id, bucket_start)
  do update set request_count = public.widget_rate_limit_buckets.request_count + 1
  returning request_count into v_count;
  return v_count <= greatest(p_limit, 1);
end;
$$;

create or replace function public.cleanup_widget_operational_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.widget_rate_limit_buckets where bucket_start < now() - interval '2 days';
  delete from public.widget_webhook_events where processed_at < now() - interval '18 months';
end;
$$;

alter table public.widget_settings enable row level security;
alter table public.widget_plans enable row level security;
alter table public.vehicle_data_sources enable row level security;
alter table public.vehicle_import_batches enable row level security;
alter table public.vehicle_source_records enable row level security;
alter table public.vehicle_duplicate_reviews enable row level security;
alter table public.widget_clients enable row level security;
alter table public.widget_api_keys enable row level security;
alter table public.widget_access_logs enable row level security;
alter table public.widget_domain_change_requests enable row level security;
alter table public.widget_webhook_events enable row level security;
alter table public.widget_audit_logs enable row level security;
alter table public.widget_rate_limit_buckets enable row level security;

drop policy if exists widget_clients_own_select on public.widget_clients;
create policy widget_clients_own_select on public.widget_clients
for select to authenticated using (user_id = auth.uid());

drop policy if exists widget_domain_requests_own_select on public.widget_domain_change_requests;
create policy widget_domain_requests_own_select on public.widget_domain_change_requests
for select to authenticated using (
  exists (select 1 from public.widget_clients c where c.id = client_id and c.user_id = auth.uid())
);

drop policy if exists widget_domain_requests_own_insert on public.widget_domain_change_requests;
create policy widget_domain_requests_own_insert on public.widget_domain_change_requests
for insert to authenticated with check (
  exists (select 1 from public.widget_clients c where c.id = client_id and c.user_id = auth.uid())
);

grant execute on function public.widget_consume_rate_limit(uuid, integer) to service_role;
revoke all on public.widget_settings, public.widget_plans, public.widget_api_keys,
  public.widget_access_logs, public.widget_webhook_events, public.widget_audit_logs,
  public.widget_rate_limit_buckets, public.vehicle_data_sources, public.vehicle_import_batches,
  public.vehicle_source_records, public.vehicle_duplicate_reviews from anon, authenticated;

commit;
