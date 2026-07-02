-- MG AutoTech training-data integrity and commercial policy controls.
-- Safe, additive and idempotent. Run in the Supabase SQL editor before deploying this release.

begin;

alter table if exists public.ai_training_samples
  add column if not exists requested_service_labels jsonb,
  add column if not exists performed_service_labels jsonb,
  add column if not exists change_type_classification text,
  add column if not exists learning_use_status text not null default 'pending',
  add column if not exists revision_number integer not null default 1,
  add column if not exists source_type text;

update public.ai_training_samples
set requested_service_labels = service_labels
where requested_service_labels is null and service_labels is not null;

update public.ai_training_samples
set source_type = case
  when coalesce((source_metadata ->> 'demo')::boolean, false) then 'demo_fixture'
  when request_id is not null then 'completed_request'
  else 'manual_capture'
end
where source_type is null;

update public.ai_training_samples
set change_type_classification = diff_json #>> '{change_profile,classification}'
where change_type_classification is null
  and diff_json #>> '{change_profile,classification}' is not null;

-- Legacy signatures were created from requested services. Remove this derived data
-- until a human confirms the actually performed services and approves learning use.
delete from public.ai_pattern_signatures signature
using public.ai_training_samples sample
where signature.training_sample_id = sample.id
  and sample.learning_use_status <> 'approved_for_learning';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_training_samples_learning_use_status_check'
      and conrelid = 'public.ai_training_samples'::regclass
  ) then
    alter table public.ai_training_samples
      add constraint ai_training_samples_learning_use_status_check
      check (learning_use_status in ('pending', 'approved_for_learning', 'excluded'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_training_samples_revision_number_check'
      and conrelid = 'public.ai_training_samples'::regclass
  ) then
    alter table public.ai_training_samples
      add constraint ai_training_samples_revision_number_check
      check (revision_number >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_training_samples_change_type_check'
      and conrelid = 'public.ai_training_samples'::regclass
  ) then
    alter table public.ai_training_samples
      add constraint ai_training_samples_change_type_check
      check (
        change_type_classification is null or change_type_classification in (
          'identical', 'focused_calibration', 'distributed_calibration',
          'broad_rework', 'structural_mismatch', 'single_file', 'unknown'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_training_samples_source_type_check'
      and conrelid = 'public.ai_training_samples'::regclass
  ) then
    alter table public.ai_training_samples
      add constraint ai_training_samples_source_type_check
      check (
        source_type is null or source_type in (
          'completed_request', 'demo_fixture', 'manual_capture', 'file_expert'
        )
      );
  end if;
end;
$$;

create index if not exists ai_training_samples_learning_use_idx
  on public.ai_training_samples(learning_use_status, human_verification_status, created_at desc);

comment on column public.ai_training_samples.requested_service_labels is
  'Services requested by the customer. Never treated as proof that the work was performed.';
comment on column public.ai_training_samples.performed_service_labels is
  'Services confirmed by a human as actually present in the delivered MOD file.';
comment on column public.ai_training_samples.learning_use_status is
  'Explicit human gate controlling whether the sample may influence ECU knowledge profiles.';

create table if not exists public.commerce_settings (
  id text primary key default 'default' check (id = 'default'),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  default_custom_credit_price_eur numeric(10,4) not null default 5.0000
    check (default_custom_credit_price_eur > 0),
  global_adjustment_type text not null default 'percentage'
    check (global_adjustment_type in ('none', 'percentage', 'fixed')),
  global_adjustment_value numeric(10,4) not null default 20.0000
    check (global_adjustment_value between -1000 and 1000),
  promotion_label text,
  payment_sumup_enabled boolean not null default true,
  payment_paypal_enabled boolean not null default true,
  payment_bank_enabled boolean not null default true,
  payment_stripe_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.commerce_settings (
  id, promotion_label, global_adjustment_type, global_adjustment_value
)
values ('default', 'Limited time -20% on all credit purchases', 'percentage', 20)
on conflict (id) do nothing;

create table if not exists public.customer_commercial_policies (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credit_price_override_eur numeric(10,4)
    check (credit_price_override_eur is null or credit_price_override_eur > 0),
  adjustment_type text not null default 'none'
    check (adjustment_type in ('none', 'percentage', 'fixed')),
  adjustment_value numeric(10,4) not null default 0
    check (adjustment_value between -1000 and 1000),
  payment_sumup_enabled boolean,
  payment_paypal_enabled boolean,
  payment_bank_enabled boolean,
  payment_stripe_enabled boolean,
  internal_note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_policy_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'customer')),
  customer_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists commerce_policy_events_customer_idx
  on public.commerce_policy_events(customer_id, created_at desc);

create or replace function public.set_commerce_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_commerce_settings_updated_at on public.commerce_settings;
create trigger set_commerce_settings_updated_at
before update on public.commerce_settings
for each row execute function public.set_commerce_updated_at();

drop trigger if exists set_customer_commercial_policies_updated_at on public.customer_commercial_policies;
create trigger set_customer_commercial_policies_updated_at
before update on public.customer_commercial_policies
for each row execute function public.set_commerce_updated_at();

alter table public.commerce_settings enable row level security;
alter table public.customer_commercial_policies enable row level security;
alter table public.commerce_policy_events enable row level security;

drop policy if exists "Staff can manage global commerce settings" on public.commerce_settings;
create policy "Staff can manage global commerce settings"
on public.commerce_settings for all to authenticated
using (public.has_staff_permission('credits.manage'))
with check (public.has_staff_permission('credits.manage'));

drop policy if exists "Staff can manage customer commerce policies" on public.customer_commercial_policies;
create policy "Staff can manage customer commerce policies"
on public.customer_commercial_policies for all to authenticated
using (public.has_staff_permission('credits.manage'))
with check (public.has_staff_permission('credits.manage'));

drop policy if exists "Staff can read commerce policy events" on public.commerce_policy_events;
create policy "Staff can read commerce policy events"
on public.commerce_policy_events for select to authenticated
using (public.has_staff_permission('credits.manage'));

commit;

-- Verification:
-- select id, global_adjustment_type, global_adjustment_value from public.commerce_settings;
-- select column_name from information_schema.columns where table_name = 'ai_training_samples' order by ordinal_position;
