# Production Environment Matrix

Status: proposed Production configuration. No Production value was read or changed while preparing this matrix.

## Inventory method

`vercel env ls production` was used only to inspect variable names, encryption markers, and scopes. Values were not requested, printed, persisted, or compared. A present name therefore means **name/scope present**, not **value verified**.

## Existing Production names

These names already include Production scope and are outside the ECU Intelligence change set.

| Domain | Names | Current scope observation | Release action |
| --- | --- | --- | --- |
| Supabase/site | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` | Preview + Production | Verify privately; do not change |
| Email | `EMAIL_DRY_RUN`, `ADMIN_NOTIFICATION_EMAIL`, `SUPPORT_EMAIL` | Production | Verify privately; do not change |
| Email transport | `EMAIL_FROM`, `RESEND_API_KEY` | Preview + Production | Verify privately; do not change |
| Stripe | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Production | Verify privately; do not change |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE` | Preview + Production | Verify privately; do not change |
| Bank transfer | `NEXT_PUBLIC_BANK_ACCOUNT_NAME`, `NEXT_PUBLIC_BANK_NAME`, `NEXT_PUBLIC_BANK_IBAN`, `NEXT_PUBLIC_BANK_BIC` | Preview + Production | Verify privately; do not change |
| Widget | `WIDGET_IP_HASH_SALT`, `WIDGET_SESSION_SECRET` | Production | Verify privately; do not change |

`EMAIL_DRY_RUN` is an existing business-operational control, not a Learning Flywheel or DTC delivery flag. This release must not change its current Production behavior without a separate owner decision.

## Required release controls

None of the following names existed in Production at dry-run time. Add them with **Production-only** scope during the approved change window.

### ECU Intelligence Center

| Variable | Proposed value | Reason |
| --- | --- | --- |
| `ECU_INTELLIGENCE_CENTER_ENABLED` | `true` | Enable staff-only center |
| `ECU_INTELLIGENCE_GRAPH_ENABLED` | `true` | Enable deterministic knowledge graph |
| `ECU_INTELLIGENCE_INSIGHTS_ENABLED` | `true` | Enable deterministic insights |
| `ECU_INTELLIGENCE_REFRESH_ENABLED` | `true` | Enable the reviewed staff refresh/no-op boundary |

### Learning Flywheel

| Variable | Proposed value | Reason |
| --- | --- | --- |
| `LEARNING_FLYWHEEL_FILE_CANDIDATES_ENABLED` | `true` | Allow private metadata-only file candidates |
| `LEARNING_FLYWHEEL_PAIR_CANDIDATES_ENABLED` | `true` | Allow private metadata-only pair candidates |
| `LEARNING_FLYWHEEL_APPROVAL_ENABLED` | `false` | No learning approval in the initial release |
| `LEARNING_FLYWHEEL_BACKFILL_ENABLED` | `false` | No automatic or manual historical backfill in the initial release |

File and pair capture are independent. Both are fail-closed unless the server value is exactly `true`. Candidate capture does not grant learning use: default authorization remains `not_granted` and approval remains blocked.

### Learning authorization

| Variable | Proposed state | Reason |
| --- | --- | --- |
| `LEARNING_AUTHORIZATION_CAPTURE_ENABLED` | Present with `false` | Keep web/desktop capture unavailable |
| `LEARNING_AUTHORIZATION_TERMS_VERSION` | Absent | Owner/legal version not approved |
| `LEARNING_AUTHORIZATION_TERMS_URL` | Absent | Owner/legal HTTPS URL not approved |

Do not insert an authorization terms row for this release. Capture becomes available only when all three controls are valid; a false capture flag with absent terms is the intended initial state.

### Read-only DTC

| Variable | Proposed value | Reason |
| --- | --- | --- |
| `DTC_READ_ONLY_FOUNDATION` | `true` | Enable status/policy/readiness only |
| `DTC_INTERNAL_TEST_PROCESSING` | `false` | No processing in Production |
| `DTC_SYNTHETIC_FIXTURES` | `false` | No synthetic processing in Production |
| `DTC_AUTHORIZED_LAB_FIRMWARE` | `false` | No firmware processing |
| `DTC_REAL_ECU_RULES` | `false` | No real rules |
| `DTC_REAL_INTEGRITY_ADAPTERS` | `false` | No checksum/integrity adapters |
| `DTC_A3_PRODUCTION_PROCESSING` | `false` | No A3 |
| `DTC_A4_AUTOMATION` | `false` | No A4 |
| `DTC_A5_AUTOMATION` | `false` | No A5 |
| `DTC_CUSTOMER_DELIVERY` | `false` | No DTC automatic customer delivery |
| `DTC_INSTRUCTION_PATCH_OPERATIONS` | `false` | No patch operations |
| `DTC_GLOBAL_KILL_SWITCH_ENGAGED` | `true` | Mandatory production hard veto |

## Scope and exposure rules

- All 21 release controls are server-only. Never prefix them with `NEXT_PUBLIC_`.
- `SUPABASE_SERVICE_ROLE_KEY` remains server-only and must never enter the browser or desktop application.
- The desktop uploader continues to use only public `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` or their public Next.js fallbacks. No desktop environment change is required for this release.
- Environment changes take effect only in a new deployment. Verify the deployment's Production environment snapshot after the Git-linked build.
- Never use the staging Supabase URL/key in Production and never use the production Supabase URL/key in branch-scoped Preview.

## Owner verification

Before deployment, two operators must confirm without exposing values:

- all existing Production names remain present and unchanged;
- exactly 21 release control names have Production-only scope;
- four ECU Intelligence controls are true;
- file/pair capture are true;
- approval, backfill, and authorization capture are false;
- terms version and terms URL are absent;
- read-only DTC is true;
- all ten DTC processing/rule/adapter/automation/delivery/patch controls are false;
- global DTC kill switch is true;
- no release control is available to the browser or desktop bundle.
