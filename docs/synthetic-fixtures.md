# MG AutoTech Synthetic AI Fixtures

Synthetic fixtures are fake test binaries for AI File Intelligence development.

They are:

- deterministic
- tiny compared with real ECU files
- marked `safe_fake_binary: true`
- marked `not_flashable: true`
- never customer files
- never production uploads

They are not:

- ECU files
- TCU files
- tuning files
- checksum-corrected files
- flashable output

## What they simulate

The helper in `src/lib/aiFileIntelligence/syntheticFixtures.ts` can create:

- Stage 1-like fake torque/boost/duration changed regions
- EGR OFF-like fake changed region
- DTC OFF-like fake table region
- checksum-like fake region

Each fixture includes:

- fake ORI buffer
- fake MOD buffer
- service labels
- map definition set
- map definitions
- changed regions
- expected attribution categories

## Why they exist

They let tests verify:

- changed-region attribution
- exact/similar match helpers
- evidence trust helpers
- generation readiness gates
- customer-safe projection

without touching real customer data or creating real tuning output.

## Usage

Use in tests only:

```ts
import { buildSyntheticFixture } from "@/lib/aiFileIntelligence/syntheticFixtures";

const fixture = buildSyntheticFixture("stage1_like");
```

Never upload these fixtures to production storage as customer files. Never represent them as usable tuning files.

## Synthetic File Lab

The admin-only Synthetic File Lab is available at:

`/admin/ai-training/synthetic-lab`

It builds an in-memory benchmark from the deterministic fixtures and verifies map attribution, evidence trust and generation readiness. It is dry-run only and does not write storage or approve production learning data.
