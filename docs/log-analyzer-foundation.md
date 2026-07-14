# AI Log Analyzer Foundation

Roadmap task: `RMAP-FILE-AI-LOG-ANALYZER-M1-FOUNDATION`

This foundation defines the local Log Analyzer contract before any live provider, upload endpoint, customer UI integration or production rollout. The current implementation is deterministic non-AI summary logic for RPM and torque log rows.

## Local Contract

- Contract version: `log-analyzer-v1`
- Default provider state: `unconfigured_log_analyzer_provider` with deterministic fallback
- Fallback provider: `deterministic_rules`
- Fallback states: provider-unavailable fallback, provider-error fallback and invalid-input fallback are explicit
- Human review: always required
- Customer projection: omits provider id, model, prompt version, fallback internals, raw CSV rows, file names, storage paths, signed URLs, hashes, customer identifiers and admin-only notes
- Expert projection: exposes provider status, fallback reason, normalized counts, evidence gaps, risk flags, required human checks and blocked production actions

## Safe Coverage

The deterministic fallback summarizes:

- valid and rejected row counts;
- RPM range;
- torque range;
- estimated peak torque and peak power from torque and RPM;
- average torque;
- confidence and readiness semantics for expert review.

This is not a dyno system, calibration engine or file generator. It only turns already parsed RPM/Nm log data into a bounded summary with uncertainty, evidence gaps and review gates.

## Blocked Production Actions

Autonomous Codex must not perform or imply:

- live provider routing or provider credential setup
- production log storage
- customer-ready MOD export
- checksum approval
- flash-safety approval
- exact gain claims
- automatic delivery

Operator approval is required before any live provider rollout, customer-facing release, production data use, provider credential configuration, upload endpoint, database migration, deploy, MOD export, checksum workflow or delivery automation.

## Privacy Boundaries

The contract is designed to avoid customer/private leakage:

- no raw CSV rows in customer projection;
- no raw binary or hex data;
- no storage paths or signed URLs;
- no hashes, sample IDs or customer identifiers;
- no file names in the customer-safe output;
- no provider prompt/model internals in the customer-safe output.

Future integrations must keep public/customer output as summary and review guidance only.

## Safe Local Validation

Run these local checks when changing this foundation:

```powershell
.\node_modules\.bin\tsx.cmd --test tests\ecu-intelligence.test.ts
.\node_modules\.bin\tsx.cmd --test tests\ui-ux-safety.test.ts
npm run lint
npm run typecheck
npm test
git diff --check
```

`npm run build` is not required for this local contract slice when the no-env/no-network boundary applies; this repository build may load local Next env files and request Google Fonts.
