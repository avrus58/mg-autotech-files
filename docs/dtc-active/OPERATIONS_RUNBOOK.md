# DTC Active Operations Runbook

Current status: Phase A read-only foundation.

## Allowed Now

- View `/admin/dtc`.
- Read `/api/admin/dtc/foundation` as staff with `ai_training.manage`.
- Read own `/api/requests/[id]/dtc-status` as the request owner.
- Review docs and migration draft.

## Forbidden Now

- Production deploy for this task.
- Production Supabase migration.
- Customer delivery.
- A3/A4/A5 automation.
- Real ECU rules.
- Checksum adapters.
- Synthetic output generation.
- Binary editing or MOD generation.

## Before Phase B

1. Install/configure Supabase CLI locally.
2. Apply foundation and Phase A draft migrations to a disposable database.
3. Run database advisors.
4. Add RLS/cross-tenant tests.
5. Review synthetic fixture provenance.
6. Keep customer publication structurally impossible.
