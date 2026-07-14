# AI Tune Advisor Foundation

Roadmap task: `RMAP-FILE-AI-TUNE-ADVISOR-M1-FOUNDATION`

This foundation defines the local Tune Advisor contract before any live provider, customer UI, file generation or production rollout. The current implementation is deterministic non-AI request guidance built from request service metadata.

## Local Contract

- Contract version: `tune-advisor-v1`
- Default provider state: `unconfigured_tune_advisor_provider` with deterministic fallback
- Fallback provider: `deterministic_rules`
- Fallback states: provider-unavailable fallback, provider-error fallback and invalid-input fallback are explicit
- Human review: always required
- Customer projection: omits provider id, model, prompt version, fallback internals, storage paths, hashes, raw binary, sample ids and admin-only notes
- Expert projection: exposes provider status, fallback reason, required human checks and blocked production actions

## Safe Coverage

The deterministic fallback handles:

- Stage 1, Stage 2 and Stage 3 request guidance
- ECO tuning request guidance
- TCU tuning request guidance
- Only Options request guidance
- original file request context
- advanced options including emissions, DTC, checksum, performance, engine-function, support and recovery contexts

This guidance is not a calibration engine. It only prepares missing-evidence lists, risk flags, expert checks and review gates.

## Blocked Production Actions

Autonomous Codex must not perform or imply:

- calibration byte patch generation
- customer-ready MOD export
- checksum approval
- flash-safety approval
- legal-suitability approval
- exact gain claims
- pricing or delivery automation

Operator approval is required before any live provider routing, customer-facing release, production data use, provider credential configuration, migration, deploy, MOD export, checksum workflow or delivery automation.

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
