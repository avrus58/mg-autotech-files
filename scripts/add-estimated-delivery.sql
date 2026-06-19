alter table public.orders
  add column if not exists estimated_delivery_label text not null default 'usually_30_min',
  add column if not exists estimated_delivery_note text;

comment on column public.orders.estimated_delivery_label is
  'Customer-visible estimated delivery label: usually_30_min, same_day, 24h, 48h or manual_review.';

comment on column public.orders.estimated_delivery_note is
  'Optional customer-visible delivery note for project-specific timing.';
