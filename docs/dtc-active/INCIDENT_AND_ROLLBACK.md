# DTC Active Incident and Rollback

Phase A does not create processing artifacts or mutate firmware. Incident handling is therefore limited to disabling visibility or reverting code.

Future phases must use:

- append-only incident records;
- scoped kill-switch events;
- revocation records for rule/adapter/corpus digests;
- no deletion of historical evidence;
- quarantine for orphaned objects;
- no customer publication while an incident or kill switch is active.

Schema rollback must not delete immutable evidence rows or artifact records.
