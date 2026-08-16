-- Read-only verification for the prepared File Expert atomic completion RPC.

with target as (
  select
    procedure.oid,
    procedure.prosecdef,
    procedure.proconfig,
    owner_role.rolname as owner_name,
    pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid)) as definition
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_roles as owner_role on owner_role.oid = procedure.proowner
  where procedure.oid = pg_catalog.to_regprocedure(
    'public.complete_file_expert_analysis_atomic(uuid,uuid,jsonb,jsonb,jsonb)'
  )
)
select
  'atomic function exists' as check_name,
  pg_catalog.count(*) = 1 as ok
from target

union all

select
  'service role is the only API executor',
  not pg_catalog.has_function_privilege('anon', target.oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('authenticated', target.oid, 'EXECUTE')
    and pg_catalog.has_function_privilege('service_role', target.oid, 'EXECUTE')
from target

union all

select
  'security definer has an empty fixed search path',
  target.prosecdef
    and target.owner_name = 'postgres'
    and exists (
      select 1
      from pg_catalog.unnest(target.proconfig) as config(value)
      where config.value in ('search_path=', 'search_path=""')
    )
from target

union all

select
  'claim row lock and lease checks are present',
  target.definition like '%for update%'
    and target.definition like '%analysis_claim_token is distinct from p_claim_token%'
    and target.definition like '%analysis_started_at < clock_timestamp()%'
from target

union all

select
  'derived rows and completion share the function transaction',
  target.definition like '%delete from public.file_expert_binary_fingerprints%'
    and target.definition like '%insert into public.file_expert_binary_fingerprints%'
    and target.definition like '%delete from public.ai_similarity_results%'
    and target.definition like '%status = ''completed''%'
from target;
