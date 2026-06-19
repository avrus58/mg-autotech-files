alter table public.orders
  add column if not exists modified_files jsonb not null default '[]'::jsonb;

comment on column public.orders.modified_files is
  'Delivered modified file versions for an order. Each item stores id, label, file_name, file_path and uploaded_at.';
