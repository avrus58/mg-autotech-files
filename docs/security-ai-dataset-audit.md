# AI Dataset Security Audit

## Routes Audited

- `GET /api/admin/ai/datasets`
- `POST /api/admin/ai/datasets/dry-run`
- `POST /api/admin/ai/datasets/import`
- `GET /api/admin/ai/datasets/[id]`
- `PATCH /api/admin/ai/datasets/pairs/[pairId]`

## Access Rules

- Anonymous users must receive `401`.
- Normal customers must receive `403`.
- Staff/admin users require `ai_training.manage`.

## Data Exposure Rules

Customer/public routes must never expose:

- scanner output
- local file paths
- raw storage paths
- hashes
- duplicate groups
- provider/source private metadata
- pair candidates
- review events
- sample IDs
- raw binary
- hex previews

## Fixes / Current Controls

- Dataset APIs use `requireStaffPermission(request, "ai_training.manage")`.
- Detail API omits fingerprint, provider metadata, storage reference and raw storage path.
- Import API records metadata only and returns `raw_files_uploaded: false`.
- Pair review API returns `creates_training_sample: false` and `auto_approved_learning: false`.
- Dataset review cannot directly set `approved_for_learning`.
- Offline analyzer and evaluator write metadata-only JSON/JSONL/Markdown.

## Remaining Risks

- Persistent import writes metadata rows if used against production Supabase. Use a dev Supabase branch for full import smoke when possible.
- Scanner JSONL can contain relative paths and hashes. Treat scanner output as admin-only.
- Large real dataset scans should start with `--limit` and explicit owner approval.

## Manual Smoke Checklist

1. Generate synthetic fixture.
2. Scan fixture.
3. Analyze fixture pairs.
4. Evaluate fixture report.
5. Confirm anonymous dataset APIs return 401.
6. Confirm no `ai_training_samples` row is created by dataset import.
7. Confirm no raw/hex output exists in reports.
