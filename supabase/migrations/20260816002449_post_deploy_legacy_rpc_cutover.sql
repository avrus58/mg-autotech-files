-- Post-deploy legacy RPC cutover.
-- Apply only after migrations 02443-02448 and the matching application have
-- been deployed. The new wrappers continue to call the hardened order core as
-- postgres; this migration removes only its direct Data API entry point.

begin;

create or replace function public.staff_adjust_customer_credits(
  p_customer_id uuid,
  p_amount numeric,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '0A000',
    message = 'The legacy credit adjustment RPC is disabled; an idempotency key is required.';
end;
$$;

create or replace function public.add_credits_from_stripe(
  p_user_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent text,
  p_customer_email text,
  p_package_id text,
  p_credits numeric,
  p_amount_total numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '0A000',
    message = 'The legacy Stripe credit RPC is disabled; a processing claim is required.';
end;
$$;

create or replace function public.admin_apply_payment_refund(
  p_actor_user_id uuid,
  p_payment_record_id uuid,
  p_provider_refund_id text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '0A000',
    message = 'The legacy refund RPC is disabled; a durable refund claim is required.';
end;
$$;

alter function public.staff_adjust_customer_credits(uuid, numeric, text)
  owner to postgres;
alter function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) owner to postgres;
alter function public.admin_apply_payment_refund(uuid, uuid, text, text)
  owner to postgres;
alter function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) owner to postgres;

revoke all privileges on function public.staff_adjust_customer_credits(
  uuid, numeric, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.admin_apply_payment_refund(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

comment on function public.staff_adjust_customer_credits(
  uuid, numeric, text
) is
  'Disabled post-deploy compatibility overload; use the caller-idempotent four-argument RPC.';
comment on function public.add_credits_from_stripe(
  uuid, text, text, text, text, numeric, numeric, text
) is
  'Disabled post-deploy compatibility overload; use the durable claim-bound nine-argument RPC.';
comment on function public.admin_apply_payment_refund(
  uuid, uuid, text, text
) is
  'Disabled post-deploy compatibility overload; use the durable claim-bound five-argument RPC.';
comment on function public.create_order_with_credit_deduction(
  text, text, text, text, text, text, integer, text, text,
  text, text, text, text, text, text, text, text
) is
  'Private hardened order core. Direct Data API execution was removed after wrapper deployment.';

-- The deployed application now mints exact-path signed uploads through the
-- service role. Remove the temporary owner-prefix INSERT policies retained for
-- the previous browser clients, while preserving the reviewed staff delivery
-- path for customer-files. Direct file-expert INSERT becomes impossible for an
-- authenticated Data API caller.
drop policy if exists "MG customer files legacy owner insert" on storage.objects;
drop policy if exists "MG file expert legacy owner insert" on storage.objects;
drop policy if exists "MG protected buckets insert boundary" on storage.objects;

create policy "MG protected buckets insert boundary"
on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id not in ('customer-files', 'file-expert')
  or (
    bucket_id = 'customer-files'
    and public.has_staff_permission('files.upload')
  )
);

commit;
