# AI Explain Layer Foundation

Roadmap task: `RMAP-FILE-AI-EXPLAIN-LAYER-M1-FOUNDATION`

This foundation defines a local AI Explain and Recommendation Layer before any live provider rollout, UI/API integration, analytics persistence or production deployment. It gives DTC Analyzer, Tune Advisor, Log Analyzer and File Expert style outputs a shared contract for source labels and unavailable states.

## Local Contract

- Contract version: `ai-explain-layer-v1`
- Default provider state: `unconfigured_ai_explain_provider` with deterministic fallback
- Fallback provider: `deterministic_rules`
- Source label kinds: evidence, recommendation, risk flag, human review gate, provider state and fallback state
- Unavailable states: provider unavailable, provider-unavailable fallback, provider-error fallback and invalid input are explicit
- Human review: always required before critical file-service action
- Customer projection: omits provider id, provider kind, model name, prompt version, fallback internals, raw binary/hex/CSV, hashes, signed URLs, storage paths, filenames, customer identifiers, sample ids and admin-only notes
- Expert projection: exposes provider status, fallback reason, source labels, required human checks and blocked production actions

## Source Labels

Source labels explain why a recommendation is shown without exposing private internals. The foundation supports customer-safe labels from:

- customer input;
- vehicle metadata;
- request service metadata;
- diagnostic evidence;
- log summary;
- file analysis summary;
- provider state;
- deterministic rules;
- human review;
- safety boundary;
- unavailable state.

Provider-unavailable and provider-error labels must never be rendered as successful AI output. They exist so customer and expert surfaces can say that AI output is unavailable while still showing deterministic, non-AI explanation labels when safe.

## Blocked Production Actions

Autonomous Codex must not perform or imply:

- live provider rollout or provider credential setup
- customer-ready MOD export
- checksum approval
- flash-safety approval
- automatic delivery
- production analytics persistence
- database migration or deploy for this layer

Operator approval is required before any live provider routing, UI/API integration, analytics persistence, migration, deploy, MOD export, checksum workflow, delivery automation or customer-facing release copy.

## Privacy Boundaries

Customer-facing projection must remain summary-only:

- no provider id, provider kind, model name or prompt version;
- no fallback internals;
- no raw CSV rows, binary data, hex previews, offsets or checksums;
- no storage paths, signed URLs, hashes, filenames, sample ids or customer identifiers;
- no admin-only notes or private provider metadata.

Expert/admin projection may expose provider status and fallback reason for review, but should still avoid raw customer data unless a future owner-approved integration explicitly requires it and has its own privacy gate.

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
