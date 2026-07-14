# DTC Active Repository Reconciliation

Status: Phase A implemented as read-only foundation.

## Repository Conventions

- Root app: Next.js App Router under `src/app`.
- Domain modules: `src/lib`.
- Admin API guard: `src/lib/apiAuth.ts`.
- Staff permissions: `src/lib/staffPermissions.ts`.
- Current DTC analyzer: `src/lib/dtcAnalyzer`, diagnostic guidance only.
- Admin work-order state: `scripts/add-admin-work-order-control-center.sql`, `src/lib/workOrders`.
- File Expert tables: `scripts/add-file-expert.sql`.
- AI training/data tables: `scripts/add-ecu-intelligence-learning.sql` and later AI migrations.
- Desktop app: `apps/customer-uploader`; not changed by Phase A.

## Spec-to-Repo Mapping

| Package spec | Phase A repository path |
|---|---|
| `src/lib/dtc/*` active contracts | `src/lib/dtcActive/*` read-only foundation |
| Admin DTC workbench | `src/app/admin/dtc/page.tsx` |
| Admin foundation status API | `src/app/api/admin/dtc/foundation/route.ts` |
| Customer DTC positive status | `src/app/api/requests/[id]/dtc-status/route.ts` |
| Migration template | `scripts/add-dtc-active-processing-phase-a.sql` |
| Implementation docs | `docs/dtc-active/*` |

## Existing Tables Reused

- `public.orders`: request/customer ownership for DTC status route.
- `public.request_work_orders`: optional future linkage in the Phase A migration draft.
- `public.request_work_order_events`: existing audit/timeline pattern for later phases.
- `public.file_expert_jobs`: existing File Expert source context, not mutated by Phase A.
- `public.profiles`: existing role/staff permission lookup through API guards.

No production database was queried. These mappings are inferred from existing migration files and repository code.

## Migration Changes Required

Created draft only:

`scripts/add-dtc-active-processing-phase-a.sql`

The draft reconciles package concepts into this repo with:

- private `dtc_private` schema;
- immutable metadata tables for policy snapshots, rules, adapters, corpus versions and attempts;
- public positive projection table `public.dtc_request_status_public`;
- RLS on all created tables;
- customer select policy only for `auth.uid() = user_id`;
- staff projection read using `public.has_staff_permission('ai_training.manage')`;
- no firmware bytes, bytea, base64, hex dumps or direct Storage paths.

Supabase CLI is not installed in this environment, so local/disposable migration application was not run.

## Role and Permission Mapping

Phase A maps admin DTC foundation visibility to existing `ai_training.manage`.

Reason: the active DTC platform is an ECU intelligence control surface, and the repository does not yet have a dedicated `dtc.manage` permission.

No customer can call admin DTC APIs. Customer DTC status is scoped to the authenticated user's own `orders.customer_id`.

## Worker and Queue Decision

Phase A does not implement a worker. The repository has no existing dedicated private Node worker layout for binary processing. Phase B should add a private Node worker or service, not Edge runtime, because the active-processing spec requires filesystem, workspace isolation, leases and adapter controls.

## Safe Defaults

- READ_ONLY foundation enabled.
- Internal test processing disabled in Phase A.
- Controlled production processing disabled.
- Customer delivery disabled.
- Real ECU rules disabled.
- Checksum/signature adapters disabled.
- A4/A5 automation disabled.
- Production-like environments default the global kill switch to engaged.

## Unresolved Items

- Supabase CLI is missing locally; migration apply/advisors/RLS tests are blocked.
- No local disposable database is configured in the repository.
- No authorized real ECU rule bundle exists in tracked source.
- No isolated adapter runner exists yet.
- No synthetic engine output is generated in Phase A by design.
