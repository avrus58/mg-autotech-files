# Production Rollback

Status: owner-run incident procedure. No rollback action was executed while preparing this package.

## Principles

1. Feature flags are the first containment control.
2. Preserve existing customer service behavior while disabling candidate/intelligence features independently.
3. Keep approval, backfill, and authorization capture false throughout incident response.
4. Keep the DTC global kill switch true.
5. Do not drop release tables, delete candidate/authorization/audit/job records, rewrite migration history, or remove existing customer records.
6. Database recovery is forward-fix unless the owner approves a separately reviewed data-preserving migration.

## Decision tree

```text
Issue before database apply?
  -> Abort. No rollback required.

Database applied, environment not changed?
  -> Leave additive schema dormant. Re-run catalog verification. Do not drop objects.

Environment changed, app not deployed?
  -> Restore the prior values-hidden environment snapshot or set every new capability false.
     Keep DTC kill switch true. Do not deploy until review is complete.

App deployed and candidate ingestion is unhealthy?
  -> Set file and pair candidate flags false, approval/backfill/capture false, redeploy.
     Existing upload/request/payment/email/delivery behavior must continue.

ECU Intelligence read views are unhealthy?
  -> Set center, graph, insights, and refresh false, redeploy.
     Candidate flags may remain off until root cause is understood.

DTC read projection is unhealthy or access is ambiguous?
  -> Set read-only foundation false and global kill switch true, redeploy.
     Keep every processing/rule/adapter/A3/A4/A5/delivery/patch flag false.

Broad application regression or security boundary failure?
  -> Disable all new release flags, keep kill switch true, and roll the app back to the
     previous known-good Git-linked production deployment. Retain additive schema/records.
```

## Flag containment sets

### Learning containment

Set all of these to `false`, then create a new Production deployment:

- `LEARNING_FLYWHEEL_FILE_CANDIDATES_ENABLED`
- `LEARNING_FLYWHEEL_PAIR_CANDIDATES_ENABLED`
- `LEARNING_FLYWHEEL_APPROVAL_ENABLED`
- `LEARNING_FLYWHEEL_BACKFILL_ENABLED`
- `LEARNING_AUTHORIZATION_CAPTURE_ENABLED`

Do not add terms version or URL during containment. Pending jobs and candidates remain durable for later review; do not delete them.

### Intelligence-center containment

Set all of these to `false`, then create a new Production deployment:

- `ECU_INTELLIGENCE_CENTER_ENABLED`
- `ECU_INTELLIGENCE_GRAPH_ENABLED`
- `ECU_INTELLIGENCE_INSIGHTS_ENABLED`
- `ECU_INTELLIGENCE_REFRESH_ENABLED`

### DTC containment

Set `DTC_READ_ONLY_FOUNDATION=false` only when the read projection itself must be withdrawn. Always keep:

- `DTC_GLOBAL_KILL_SWITCH_ENGAGED=true`;
- every internal-test, synthetic, firmware, real-rule, real-adapter, A3/A4/A5, customer-delivery, and patch flag `false`.

## Application rollback

1. Identify the previous known-good Git-linked Production deployment and verify its commit, target, and project.
2. Confirm all new release flags are contained before traffic reaches the rollback deployment.
3. Use the owner-approved Vercel rollback/redeploy process. Do not promote the staging Preview.
4. Verify root, auth boundaries, existing request reads, payment status reads, and delivery status reads.
5. Keep the new schema in place. The prior application must tolerate unused additive tables.

## Database rollback limits

The selected migrations create private metadata tables, indexes, RLS policies, grants, and one DTC status projection. There is no reviewed destructive down migration.

- Before any candidate exists, dropping tables is still unnecessary and is not the approved rollback.
- After any candidate, job, review, or authorization record exists, dropping tables would destroy audit/history and is prohibited.
- Migration history must remain truthful. Do not mark migrations reverted while their objects remain, and do not delete history entries.
- If a schema defect exists, prepare an additive/data-preserving forward migration, repeat isolated staging verification, and obtain owner approval.

## Rollback verification

After containment or app rollback, confirm:

- anonymous admin requests return `401`;
- file/pair capture, approval, backfill, and authorization capture resolve false;
- ECU Intelligence routes are unavailable or safely disabled when their controls are false;
- DTC global kill switch is true and all mutation/delivery states are false;
- existing upload/request/payment/email/delivery behavior remains available;
- no record was deleted and no migration history was rewritten;
- ingestion error rate stops increasing and pending jobs remain observable;
- incident notes contain only aggregate/sanitized evidence.

Re-enable one capability group at a time only after a new owner go/no-go review.
