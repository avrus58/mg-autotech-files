# Production Smoke Tests

Status: owner-run, post-deploy, non-mutating checklist. Codex did not run these checks against production.

## Safety rules

- Use the Git-linked production deployment created from the approved release artifact.
- Use an owner-approved staff account only for staff views. Do not record tokens, cookies, customer identifiers, storage paths, or response bodies containing private data.
- Do not upload or download a real customer file, create a production fixture, open firmware content, run File Expert against a real file, initiate payment, complete delivery, approve a candidate, run backfill, or call a mutating DTC endpoint.
- Record only status codes, boolean feature states, aggregate counts, engine versions, warning codes, and pass/fail results.
- Stop on the first security-boundary or feature-flag failure.

## Identity and deployment

| Check | Expected |
| --- | --- |
| Vercel project | `avrus58s-projects/mg-autotech-files` |
| Deployment target | `production` |
| Deployment status | `Ready` |
| Git source | Approved release SHA, not a promoted Preview or unlinked CLI build |
| Production Supabase ref | `jujaeyvyaeesmipihrrw` |
| Production/staging refs | Different |

## Anonymous and public checks

| Request | Expected |
| --- | --- |
| `GET /` | `200` |
| `GET /api/vehicles?type=brands` | `200` and existing public response shape |
| `GET /api/learning-authorization/config` | `200`, `available=false`, `termsVersion=null`, `termsUrl=null`, `defaultChoice=null`, `choiceRequiredForPurchase=false` |
| `GET /api/admin/ecu-intelligence/overview` | `401` |
| `GET /api/admin/ai/learning-corpus` | `401` |
| `GET /api/admin/dtc/foundation` | `401` |

Fail if an admin endpoint returns data to an anonymous request or if learning authorization is available.

## Staff read-only checks

Open these routes in an authenticated staff browser session with the existing `ai_training.manage` permission:

- `/admin/ecu-intelligence`
- `/admin/ecu-intelligence/clusters`
- `/admin/ecu-intelligence/services`
- `/admin/ecu-intelligence/patterns`
- `/admin/ecu-intelligence/similarity`
- `/admin/ecu-intelligence/review`
- `/admin/ecu-intelligence/insights`
- `/admin/ai-training/corpus`
- `/admin/dtc`

Expected:

- pages load without exposing secrets, storage paths, binary content, raw firmware, or cross-customer data;
- empty/new candidate state is distinct from an API error;
- deterministic engine version and source warnings are visible to staff;
- review controls do not represent a pending candidate as approved;
- no MOD generation, Stage generation, DTC mutation, checksum adapter, A3/A4/A5, patch, or customer-delivery action is offered by this release.
- when a naturally existing cluster is available, its cluster detail/graph view loads; do not create a production fixture merely to exercise the graph.

Read-only API state:

| Endpoint | Expected state |
| --- | --- |
| `GET /api/admin/ecu-intelligence/overview` | `200`; center, graph, insights, and refresh enabled; every real-processing/delivery capability false |
| `GET /api/admin/ai/learning-corpus` | `200`; file/pair capture true; approval false; backfill false; authorization not granted/pending states preserved |
| `GET /api/admin/dtc/foundation` | `200`; read-only enabled; global kill switch true; production automation false; real rules/adapters false; A3/A4/A5 false; DTC customer delivery false |

Do not call the backfill POST route merely to prove that it is disabled. Verify the returned configuration instead.

## Authorization and review gates

Verify in web and desktop UI without submitting a request:

- authorization controls are absent/unavailable while capture is false;
- no authorization choice is preselected;
- core service submission does not require a learning choice;
- admin candidate state defaults to `not_granted`/pending;
- approval is visibly unavailable and cannot create a training sample;
- historical items are not silently marked granted.

## Existing workflow regression checks

Perform read-only navigation only:

- login and session refresh still work;
- customer dashboard, request archive, and request detail load for the operator's approved test account;
- admin request control center and work-order views load;
- payment configuration status remains unchanged and no payment is initiated;
- existing email/delivery configuration status remains unchanged and no delivery is completed;
- desktop bootstrap remains compatible with public Supabase values and contains no service-role secret.

Candidate ingestion is intentionally not proven by manufacturing production data. After the first naturally occurring, owner-authorized request following release, the monitoring owner may confirm aggregate-only signals: one idempotent file candidate per source, at most one pair candidate per request/hash identity, `not_granted`, pending review, zero automatic training samples, and no effect on request finalization or delivery. Do not inspect the binary or place private fields in the release record.

## Pass criteria

The smoke passes only when every listed check passes and:

- no anonymous or cross-tenant access is observed;
- no release flag differs from `PRODUCTION_ENV_MATRIX.md`;
- candidate capture remains separate from learning authorization and approval;
- no real processing or automatic customer delivery capability is enabled;
- existing upload/request/payment/email/delivery reads show no regression;
- no new release-specific advisor `WARN` or `ERROR` appears.

On failure, stop new rollout activity and follow `PRODUCTION_ROLLBACK.md`.
