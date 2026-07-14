# AI File Expert V2 Review Gate

The File Expert V2 foundation keeps AI reports inside a local review-gate contract.

## Contract States

- `provider_generated`: a configured provider generated the report, but human review is still required.
- `deterministic_fallback`: no external provider generated the report; the local rule-based report was used.
- `provider_error_fallback`: a configured provider failed; the local rule-based report was used.

All states keep `humanReviewRequired: true` and `exportLocked: true`.

## Always Blocked Without Operator Approval

- Customer-ready MOD export.
- Checksum approval.
- Flash safety approval.
- Automatic delivery based only on the report.

The status contract is stored in existing File Expert analysis JSON. It is not a production migration and does not add a write-ready file path.

## Safe Local Validation

```powershell
.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts
.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts
npm run lint
npm run typecheck
npm test
git diff --check
```

`npm run build` may load local Next environment files and request Google Fonts in this repository. Run it only in an explicitly approved environment.

## Production Decisions

Production provider credentials, live model routing, customer-facing release copy, MOD export, checksum tooling, delivery automation, migrations and deploys remain operator-only decisions.
