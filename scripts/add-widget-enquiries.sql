-- MG AutoTech widget enquiry channels and lead storage.
-- Run once in Supabase SQL Editor. Safe to run again.

begin;

alter table public.widget_clients
  add column if not exists email_enquiries_enabled boolean not null default true;

alter table public.widget_clients
  add column if not exists whatsapp_enquiries_enabled boolean not null default false;

update public.widget_clients
set whatsapp_enquiries_enabled = true
where nullif(trim(whatsapp_number), '') is not null
  and whatsapp_enquiries_enabled = false;

create table if not exists public.widget_enquiries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.widget_clients(id) on delete cascade,
  vehicle_id text not null,
  vehicle_name text not null,
  stage text not null check (stage in ('Stage 1', 'Stage 2')),
  selected_services jsonb not null default '[]'::jsonb,
  performance_data jsonb not null default '{}'::jsonb,
  visitor_name text not null,
  visitor_email text not null,
  visitor_phone text,
  visitor_location text,
  vehicle_registration text,
  message text,
  request_domain text,
  ip_hash text,
  status text not null default 'new' check (status in ('new', 'delivered', 'delivery_failed')),
  created_at timestamptz not null default now()
);

create index if not exists widget_enquiries_client_date_idx
  on public.widget_enquiries(client_id, created_at desc);

create index if not exists widget_enquiries_ip_date_idx
  on public.widget_enquiries(client_id, ip_hash, created_at desc);

alter table public.widget_enquiries enable row level security;

revoke all on public.widget_enquiries from anon, authenticated;
grant all on public.widget_enquiries to service_role;

commit;
