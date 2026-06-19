alter table public.profiles
  add column if not exists customer_tags text[] not null default '{}'::text[];

comment on column public.profiles.customer_tags is
  'Internal admin customer labels such as workshop, reseller, vip, blocked and negative_credit.';
