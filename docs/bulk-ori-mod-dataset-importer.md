# MG AutoTech Bulk ORI/MOD Dataset Importer

The Bulk ORI/MOD Dataset Importer is an internal admin workbench for growing the AI learning database from historical files, provider archives, synthetic fixtures and manually reviewed datasets.

It is evidence and review infrastructure. It is not a tuning-file generator.

## Goals

- Intake metadata for many ORI/MOD files.
- Suggest ORI/MOD pairs.
- Detect duplicates.
- Suggest service labels from names and provider metadata.
- Require human-confirmed `actual_service_labels`.
- Score pair quality.
- Build a review queue.
- Track negative examples.
- Prepare training sample creation gates.

## Safety boundaries

The importer must not:

- read production storage automatically
- mutate production data automatically
- import real production files without explicit owner approval
- approve learning automatically
- generate MOD files
- edit binary files
- create byte patches
- deliver files to customers
- expose provider/private metadata to customers

## Import modes

### Dry-run metadata import

Implemented now.

- accepts file descriptors
- does not write file contents
- does not create training samples
- suggests ORI/MOD pairs
- reports duplicates, unmatched files, warnings and quality

### Admin staged import

Future persistent mode after SQL is run.

- creates import batch
- creates file candidates
- creates pair candidates
- leaves everything in review

### Approved learning import

Future mode requiring explicit admin action.

Required:

- confirmed ORI/MOD pair
- human-confirmed actual service labels
- quality threshold
- privacy safe
- not duplicate
- not known bad
- changed regions present
- explicit admin approval

### Synthetic import

Synthetic fixtures can be used for dev/test benchmark sources only. They remain `safe_fake_binary` and `not_flashable`.

### Negative example import

Negative examples teach the system what not to trust:

- wrong service label
- bad pair
- metadata-only change
- checksum-only change
- noisy MOD
- low quality
- untrusted source
- unsafe private data
- duplicate
- unknown ECU

Negative examples never become approved positive evidence.

## Pairing logic

Current dry-run pairing uses:

- filename role guesses: ORI/original/stock/read/backup vs MOD/stage/egr/dpf/adblue/dtc/vmax/tcu
- normalized base filename
- same folder/package
- file size relation
- SW/HW metadata match
- service keywords

Pair confidence is a suggestion. It is not approval.

## Service label suggestions

The importer suggests labels from filenames and folders:

- Stage 1 / Stage 2 / Stage 3
- EGR OFF
- DPF OFF
- AdBlue OFF
- DTC OFF
- VMAX OFF
- Start/Stop OFF
- TCU
- Pops & Bangs
- Launch Control
- Custom

Suggested labels are not `actual_service_labels`.

## Quality scoring

Pair candidate quality considers:

- pair confidence
- same-size ORI/MOD relation
- SW/HW metadata match
- service label clarity
- privacy screening
- duplicate/invalid status

Recommendations include:

- approve_possible_after_review
- needs_actual_labels
- needs_ecu_metadata
- needs_map_definition
- duplicate
- reject
- exclude
- known_bad
- synthetic_only

## Admin routes

- `/admin/ai-training/datasets`
- `/api/admin/ai/datasets`
- `/api/admin/ai/datasets/dry-run`

All are admin-only through `ai_training.manage`.

## SQL

Persistent review queues require:

`scripts/add-ai-dataset-import-workbench.sql`

The migration is additive and RLS protected.

## Customer privacy

Customers cannot access dataset import batches, file candidates, pair candidates, review events, negative examples, fingerprints, provider metadata or admin notes.

## Relationship to Level 3+

The importer prepares better learning data for:

- Level 3 Map Definition Layer
- Level 4 Human Calibration Suggestion
- Level 5 AI Draft Change-Set
- Level 6 Human-Approved Draft MOD Export

It does not unlock automatic generation. Human review remains mandatory.
