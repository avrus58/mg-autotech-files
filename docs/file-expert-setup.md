# MG AutoTech AI File Expert Setup

## What Was Added

- Customer page: `/dashboard/file-expert`
- Customer report page: `/dashboard/file-expert/[id]`
- Admin page: `/admin/file-expert`
- Upload/list/detail/analyze API routes
- Direct-to-Supabase private uploads so ECU files do not pass through Vercel request bodies
- Admin feedback API route
- Supabase SQL migration: `scripts/add-file-expert.sql`
- Optional FastAPI analyzer: `file-expert-analyzer/`
- V2 TypeScript identity and comparison analyzer inside Next.js

## Required Supabase Step

Run this SQL in Supabase SQL Editor:

```sql
-- scripts/add-file-expert.sql
```

The migration creates:

- `file_expert_jobs`
- `file_expert_feedback`
- `known_file_patterns`
- `file_expert_binary_fingerprints`
- `file-expert` storage bucket
- RLS policies for customers and admins

## Environment Variables

Required for the Next.js app:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional:

```bash
FILE_EXPERT_ANALYZER_URL=http://localhost:8010
OPENAI_API_KEY=
AI_PROVIDER_API_KEY=
```

The V2 report generator is deterministic and uses binary evidence plus submitted metadata. No LLM key is required.

## Local Test Flow

1. Run the SQL migration in Supabase.
2. Start the app:

```bash
npm run dev
```

3. Login as a verified customer.
4. Open `/dashboard/file-expert`.
5. Upload an ORI file, a MOD file, or only one file.
6. Open the generated report.
7. Login as admin.
8. Open `/admin/file-expert`.
9. Review the JSON/report and save feedback.

## Optional Python Analyzer

```bash
cd file-expert-analyzer
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8010
```

Then set:

```bash
FILE_EXPERT_ANALYZER_URL=http://localhost:8010
```

If the external analyzer is unavailable or returns an error, the app falls back to the TypeScript analyzer.

## V2 Detection Coverage

- ECU/TCU supplier, family and variant signatures
- HW/SW numbers, calibration IDs, VIN-format values and common engine-code markers
- Processor markers such as Tricore, MPC, SPC, RH850 and SH705x
- Raw binary, Intel HEX, Motorola S-record, FRF and ZIP/container classification
- Full/partial/calibration/virtual-read estimation
- Vehicle application candidates from the local MG AutoTech vehicle database
- Human-readable ORI/MOD change and integrity findings

Existing V1 jobs can be upgraded with the **Re-analyze** action.

Files up to 32 MB are uploaded directly from the authenticated browser to the private
`file-expert` bucket. The finalize endpoint then downloads the private objects server-side,
calculates hashes and runs the analyzer. This avoids Vercel's 4.5 MB Function payload limit.

## Known Limitations

- Exact vehicle and engine identification requires identifying evidence inside the file or a unique verified database match.
- ECU family compatibility alone is never treated as proof of the exact vehicle.
- It does not identify exact map names without ECU-specific definitions or confirmed patterns.
- It does not generate tuning files.
- It does not guarantee file safety.
- It does not correct checksums.
- Operation labels remain heuristic unless matched to tuner-confirmed pattern data.

## Future Learning Engine Notes

The feedback loop is ready:

- Completed analysis stores fingerprints and changed block signatures.
- Admin feedback stores actual features and quality/safety judgment.
- Confirmed features create records in `known_file_patterns`.

Future V2 can add:

- Similarity search against `known_file_patterns`
- ECU-family specific heuristics
- WinOLS/Damos-assisted map naming where legally available
- Embeddings/vector search for binary signatures
- Better checksum family detection
