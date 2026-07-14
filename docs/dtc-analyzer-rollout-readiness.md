# DTC Analyzer Rollout Readiness

This runbook covers `RMAP-FILE-DTC-M5-ROLLOUT-READINESS` for the File Platform AI DTC Analyzer epic.

The current milestone is ready for operator review, not autonomous production rollout. The analyzer still uses a deterministic non-AI fallback when no live provider is configured, and human review remains required before any customer file action.

## Local Readiness Contract

The local readiness contract lives in `src/lib/dtcAnalyzer/rolloutReadiness.ts`.

It reports:

- regression scenarios required before rollout review;
- sanitized audit metadata fields that may be aggregated from local fixture metadata;
- current provider, fallback and usage-limit boundaries;
- safe validation commands for this repository;
- operator-only production rollout checks;
- blocked production actions that autonomous Codex must not perform.

The report status is `ready_for_operator_review`. It does not mean production deployment, live provider enablement or customer-data rollout is approved.

## Regression Suite

Run these local checks when this DTC milestone is touched:

```powershell
.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts
.\node_modules\.bin\tsx.cmd --test tests\admin-work-orders.test.ts
.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts
npm run lint
npm run typecheck
npm test
git diff --check
```

The regression contract covers:

- provider-unavailable fallback;
- provider-error fallback;
- invalid, missing or no-code input;
- customer/admin projection boundaries;
- usage-limit rejection before analysis and audit generation;
- sanitized internal-only audit metadata;
- customer/admin UI loading, error, empty, retry and no-leak assumptions.

`npm run build` is not part of the autonomous default gate for this repository because the Next build can read local Next env files and request Google Fonts. Run it only in an operator-approved local build environment.

## Analytics Boundary

Use `projectDtcRolloutAnalyticsSnapshot()` only with local fixture metadata or an already approved sanitized export. It does not query Supabase, read `.env*`, call a provider, open customer files or access production services.

Allowed audit metadata keys are:

- `source`
- `contract_version`
- `status`
- `state`
- `is_ai_generated`
- `confidence`
- `detected_code_count`
- `detected_codes`
- `rejected_code_like_token_count`
- `input_was_truncated`
- `provider_kind`
- `provider_status`
- `fallback_used`
- `provider_unavailable`
- `provider_error`
- `analysis_success`
- `evidence_count`
- `risk_flag_count`
- `recommendation_count`
- `missing_information_count`
- `human_review_required`

The readiness snapshot aggregates counts and enums only. It ignores non-allow-listed keys such as storage paths, signed URLs, hashes, raw binary fields, sample IDs, private notes, customer identifiers, tokens or provider secrets.

## Operator-Only Production Checks

Before any real rollout, an operator must manually verify:

- provider configuration through approved secret management;
- production rate-limit persistence, monitoring and alerting;
- sanitized aggregate analytics using approved production access only;
- deployment, smoke and rollback process outside autonomous Codex;
- customer copy and admin runbook language after technical owner review.

## Blocked In Autonomous Runs

Autonomous Codex must not perform these actions:

- production deployment or Vercel state changes;
- live Supabase, Stripe, Resend, OpenAI or other production service calls;
- SQL migration execution or production database queries;
- package installation or new production dependency work;
- `.env`, `.env.local`, secret, token or provider-key reads;
- live provider enablement;
- DTC-off approval, final diagnosis, checksum completion, byte patch approval or customer-ready MOD generation.

## Remaining Limitations

- The current provider status is intentionally `unavailable` in local configuration.
- The fallback is deterministic and text-only; it does not evaluate live data, freeze-frame data, ECU software, binary content or vehicle-specific service documents.
- Customer-facing output must remain guidance only.
- Admin-facing details remain permissioned and must not be copied into customer payloads.
