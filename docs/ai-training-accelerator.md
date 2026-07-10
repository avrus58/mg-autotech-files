# MG AutoTech AI Training Accelerator and Synthetic File Lab

The AI Training Accelerator gives MG AutoTech a safe way to test File Intelligence logic without real customer files.

It is designed for:

- deterministic fake ORI/MOD fixtures
- map attribution tests
- evidence trust tests
- generation readiness tests
- future golden dataset workflows

It is not designed for:

- real ECU file generation
- customer delivery
- checksum-corrected output
- flashable files
- production storage writes

## Synthetic File Lab

Admin page:

`/admin/ai-training/synthetic-lab`

Admin API:

`/api/admin/ai-training/synthetic-lab`

The API is admin-only through `ai_training.manage`.

The lab produces an in-memory benchmark from deterministic fake fixtures:

- Stage 1-like fake changes
- EGR OFF-like fake changes
- DTC OFF-like fake changes
- checksum-like fake changes

Every fixture is marked:

- `safe_fake_binary: true`
- `not_flashable: true`

## What the benchmark measures

For each fake fixture the benchmark reports:

- changed region count
- expected map categories
- map attribution status
- average attribution confidence
- evidence trust level
- learning usability
- generation readiness
- blocked reasons
- export allowed status

`export_allowed` must remain false.

## Safety model

The Synthetic File Lab:

- does not write production storage
- does not create customer files
- does not create trusted real production evidence
- does not approve learning automatically
- does not produce byte patches
- does not create MOD files

It is a development and admin verification tool only.

## Relation to Level 3

Level 3 adds the Map Definition Layer and generation readiness gates. Synthetic fixtures exercise those gates with fake binaries so the team can test attribution and safety without touching real ECU data.

## Relation to future dataset importer

The future Bulk ORI/MOD Dataset Importer can reuse the same concepts:

- service label suggestions
- pair quality scoring
- evidence trust
- learning usefulness
- map attribution
- generation readiness

But real provider/customer files must enter through a staged, human-reviewed import queue. Synthetic fixtures must stay separate from trusted real evidence unless explicitly configured for a dev/test environment.

## Manual smoke

1. Open `/admin/ai-training`.
2. Click `Synthetic lab`.
3. Confirm 4 synthetic cases are shown.
4. Confirm `Export allowed` is 0.
5. Confirm every case says not flashable/export locked.
6. Confirm anonymous `/api/admin/ai-training/synthetic-lab` returns 401/403.
