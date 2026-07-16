# MG AutoTech ECU Intelligence Production Release Policy

Policy version: 1.0

Effective status: staging hardening candidate only. This document does not authorize a production deployment or a production environment change.

## Production launch boundary

The following capabilities may be enabled only through an explicitly reviewed production configuration and release:

- customer upload and request flow;
- File Expert read-only analysis;
- Learning Flywheel file-candidate capture;
- Learning Flywheel pair-candidate capture;
- staff-only candidate review and corpus coverage;
- ECU Intelligence Center and deterministic insights;
- read-only DTC readiness.

The following capabilities remain disabled:

- Learning Flywheel approval until owner-approved authorization terms are configured;
- automatic historical backfill;
- real ECU processing or firmware modification;
- real checksum or integrity adapters;
- Stage 1 or Stage 2 generation;
- real DTC modification;
- A3, A4, and A5 automation;
- instruction or patch operations;
- automatic customer output delivery.

Production DTC launch requires `DTC_GLOBAL_KILL_SWITCH_ENGAGED=true`.

## Fail-closed configuration

All Learning Flywheel switches resolve to disabled unless their server value is exactly `true`:

- `LEARNING_FLYWHEEL_FILE_CANDIDATES_ENABLED`
- `LEARNING_FLYWHEEL_PAIR_CANDIDATES_ENABLED`
- `LEARNING_FLYWHEEL_APPROVAL_ENABLED`
- `LEARNING_FLYWHEEL_BACKFILL_ENABLED`

The file and pair switches are independent. Approval and backfill are separate staff-controlled gates. Browser payloads cannot set or override any switch.

No production value is changed by this policy. The production default for every switch is false until an owner-approved release explicitly configures it.

## Learning authorization

Authorization capture requires all of the following server-side values:

- `LEARNING_AUTHORIZATION_CAPTURE_ENABLED=true`
- a valid `LEARNING_AUTHORIZATION_TERMS_VERSION`
- an HTTPS `LEARNING_AUTHORIZATION_TERMS_URL`

**OWNER/LEGAL PLACEHOLDER:** Final authorization wording, terms version, and terms URL require explicit MG AutoTech owner/legal approval. No wording or version is supplied by this release.

Without that approval and configuration, capture is unavailable and authorization remains `not_granted`. The choice is optional, is not preselected, and is separate from the core service purchase. A new terms version never re-authorizes an older record. Denied, revoked, missing, or stale authorization blocks learning approval.

## Operational gates

Before a production launch, the release owner must verify:

1. The release commit and migration list are fixed and reviewed.
2. Production secrets and environment values are changed only in an approved production change window.
3. Schema changes are additive or explicitly approved, bootstrap-safe, and verified on isolated staging first.
4. RLS cross-tenant tests pass for anonymous, customer, staff, and service-role paths.
5. Upload, payment, request finalization, and completed delivery remain successful when candidate capture is disabled, fails, or times out.
6. Production email transport is tested with an approved sink before customer delivery is permitted.
7. Staff observability shows attempts, successes, failures, duplicate hits, pending review, authorization state, blocked approvals, recovery, oldest pending age, and engine version.
8. Approval and backfill remain disabled for the initial production release unless separately authorized.

## RLS decision record

Before hardening, `public.dtc_request_status_public` had two authenticated `SELECT` policies:

- customer: `auth.uid() = user_id`;
- staff: `public.has_staff_permission('ai_training.manage')`.

Because permissive policies are OR-combined, the intended semantics were customer ownership **or** staff permission. Policy version 1.0 preserves that behavior in one policy using `(select auth.uid())` and `(select public.has_staff_permission('ai_training.manage'))`. Anonymous access remains denied, authenticated write grants are removed, and service-role server access is retained.

## Rollback and stop rules

Feature switches are the first rollback control. Candidate ingestion may be disabled independently without disabling the purchased service. Approval and backfill must remain off during incident response.

Stop the release if target identity, migration scope, environment scope, authorization wording, mail transport, RLS semantics, or customer-data isolation is ambiguous. Never promote a Preview deployment as a substitute for the production review process.
