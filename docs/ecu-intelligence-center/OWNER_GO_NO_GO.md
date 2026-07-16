# Owner Go/No-Go Package

Status: awaiting explicit owner approval. A recommendation of YES below is not approval and does not authorize a production action.

## Authorization package

### Configuration fields

Future authorization capture requires all of the following runtime controls, none of which is approved or configured for the initial release:

- `LEARNING_AUTHORIZATION_CAPTURE_ENABLED=true`;
- owner/legal-approved `LEARNING_AUTHORIZATION_TERMS_VERSION` matching `[A-Za-z0-9][A-Za-z0-9._-]{0,79}`;
- owner/legal-approved HTTPS `LEARNING_AUTHORIZATION_TERMS_URL`;
- an owner decision on the `ai_learning_authorization_terms` record with controlled `terms_key`, version, title, optional body, active state, author, and timestamps.

This package intentionally supplies no legal wording, version, URL, title, or body.

Current runtime availability is derived from the three environment controls; it does not query the terms table's `active` field. Authorization capture must not be enabled until the owner has either approved that behavior explicitly or a separately reviewed change makes the database terms record authoritative.

### Database behavior

- File and pair candidate rows default to `learning_authorization_status='not_granted'`.
- Candidate capture stores private metadata/provenance for staff review; it does not store firmware bytes and does not imply permission for learning use.
- Versioned authorization evidence records request, customer, actor, `granted`/`denied`/`revoked` status, terms version, HTTPS terms URL, capture source, optional source hash, and capture timestamp.
- A current grant updates matching candidates to `granted`; denial maps candidates to `not_granted`; revocation maps them to `revoked`.
- A missing, denied, revoked, or stale-version record blocks approval. A newer terms version does not re-authorize an older record.
- Approval also requires the independent approval flag. The initial release keeps that flag false.

### Web UX

- The new-request flow fetches public authorization configuration.
- When capture is unavailable, no learning choice is required and the purchased service continues normally.
- When a future approved configuration is available, grant/deny is optional, not preselected, separate from purchase, and captured after the request exists.
- Authorization capture failure must not fail the core request.

### Desktop UX

- Desktop receives the same public configuration from bootstrap.
- Grant/deny is optional and unselected by default.
- Desktop sends only the selected choice through the authenticated request flow and never receives a service-role key.
- The initial release presents no active authorization capture because the server configuration is unavailable.

### Admin behavior

- Staff with `ai_training.manage` can inspect candidate, authorization, retry, duplicate, pending-age, and blocked-approval states.
- Human review may classify or quarantine candidates, but automatic learning approval is disabled.
- No candidate may become a training sample while approval is false or current authorization is absent.
- Backfill is a separate disabled gate and must not be called during initial release smoke.

### Revocation behavior

- The schema and approval resolver support a versioned `revoked` evidence state without deleting prior evidence.
- The latest current-terms state controls approval eligibility; a revoked state blocks approval.
- The released web/desktop route accepts only `grant` or `deny`. No customer self-service or admin revocation endpoint is implemented in this release.
- A future revocation path must append evidence, update matching candidate state to `revoked`, and preserve records/audit events. Owner/legal process approval and a separately reviewed implementation are required before authorization capture is enabled.

### Historical behavior

- Existing and historical files remain `not_granted`.
- No authorization is inferred from prior purchase, upload, delivery, or account activity.
- Historical backfill remains disabled and no retroactive authorization row is created.
- The initial release may capture new private candidates as **allowed but not granted**; they remain pending review and ineligible for learning approval.

### Authorization blockers

Authorization capture or learning approval is a NO-GO until the owner/legal team approves:

- exact customer-facing wording and translations;
- version identifier and HTTPS terms URL;
- retention, withdrawal/revocation, and support process;
- whether and how a terms record is activated;
- whether the terms table becomes runtime-authoritative;
- an implemented and tested revocation path;
- production enablement of capture;
- a separate approval release and monitoring plan.

These blockers do not block the initial `not_granted` candidate-capture release because capture and approval remain false.

## Go/no-go table

| Gate | Evidence/status | Decision |
| --- | --- | --- |
| Fixed artifact identity | Branch, SHA, Preview id/URL, production ref, and staging ref fixed | GO |
| Isolated staging | Healthy, exact-empty 97-relation audit, no temporary policies | GO |
| Local/repository validation | Lint, typecheck, 447 tests, 267-page build, payment schema, 0-vulnerability production audit | GO |
| Staging smoke | 29/29, 31/31, 13/13, and 8/8 evidence passed | GO |
| Production schema comparison | Base digest exact; all 20 release tables absent in production; dependencies present | GO |
| Production migration allowlist | Exactly three pending additive files with fixed hashes/order | GO, owner apply required |
| Baseline/fake/Phase C exclusion | Explicitly blocked from production | GO |
| Production env inventory | Existing names recorded values-free; 21 release controls currently absent | GO, owner change-window action required |
| Candidate capture | File/pair true proposed; database state remains `not_granted`/pending | GO |
| Approval/backfill | Both false | GO |
| Authorization capture | False; terms version/URL absent | GO for initial release only |
| DTC boundary | Read-only true; kill switch true; all mutation/delivery controls false | GO |
| Real processing/automation | No real ECU/MOD/Stage/DTC/checksum/adapter/A3/A4/A5/patch/customer auto-delivery | GO |
| Advisor delta | No release-specific `WARN`/`ERROR`; informational debt documented | GO with owner acknowledgement |
| Existing project advisories | Inherited warnings plus production leaked-password-protection warning remain | Owner acknowledgement required |
| Rollback | Flags-first, app rollback, no destructive database rollback | GO |
| Owner approval | Not yet granted | PENDING |
| Production migration/env/merge/deploy | Not executed | PENDING |

## Owner checklist

- [ ] I confirm production ref `jujaeyvyaeesmipihrrw` and Vercel project `avrus58s-projects/mg-autotech-files`.
- [ ] I approve release artifact `04b899df85f4ef5bb279cb11083974c70b82a8c8` and the owner-package documentation.
- [ ] I approve only the three migration files and hashes in `PRODUCTION_MIGRATION_PLAN.md`.
- [ ] I confirm the staging baseline, managed overlays, local fake baseline, Phase C, and Phase C.1 will not be applied to production.
- [ ] I approve a maintenance window and named database/Vercel/monitoring/rollback operators.
- [ ] I approve the exact Production-only environment matrix and confirm no existing payment/email/site/widget/Supabase value is changed by this release.
- [ ] I confirm file/pair candidates may be captured only as private `not_granted` review candidates.
- [ ] I confirm learning approval, historical backfill, and authorization capture remain false.
- [ ] I confirm no authorization wording/version/URL is approved by this release.
- [ ] I confirm read-only DTC only, global kill switch true, and every processing/delivery flag false.
- [ ] I acknowledge the documented inherited Supabase advisories and informational index/FK debt.
- [ ] I approve the non-mutating smoke checklist and 60-minute plus 24-hour monitoring plan.
- [ ] I approve flags-first rollback, preservation of all records, and no destructive database rollback.
- [ ] I understand that checking these boxes and issuing a separate explicit production instruction is required before any production action.

Owner name: ____________________

Decision: `GO` / `NO-GO`

Approved change window: ____________________

Approval reference: ____________________

PRODUCTION_GO_RECOMMENDATION: YES
