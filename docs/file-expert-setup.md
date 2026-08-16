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

The base File Expert schema must exist before the integrated hardening
migrations are applied:

```sql
-- scripts/add-file-expert.sql
-- supabase/migrations/20260816002443_financial_authority_hardening.sql
-- supabase/migrations/20260816002444_security_state_hardening.sql
```

The migration creates:

- `file_expert_jobs`
- `file_expert_feedback`
- `known_file_patterns`
- `file_expert_binary_fingerprints`
- `file-expert` storage bucket
- private Storage/RLS foundations; hardened releases expose jobs through the
  authenticated server API rather than direct customer/staff table grants

## Environment Variables

Required for the Next.js app:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPLOAD_INTEGRITY_SECRET=<random-server-only-secret-at-least-32-characters>
```

Optional:

```bash
FILE_EXPERT_ANALYZER_URL=http://localhost:8010
FILE_EXPERT_ANALYZER_TOKEN=<random-server-only-token-at-least-32-characters>
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
FILE_EXPERT_ANALYZER_TOKEN=<same-token-on-Next-and-analyzer>
FILE_EXPERT_ANALYZER_ALLOWED_HOSTS=<project-ref>.supabase.co
```

The token must never use a `NEXT_PUBLIC_*` or `VITE_*` name. Remote analyzer URLs
must use HTTPS; HTTP is accepted only for an exact loopback host. The analyzer
accepts signed URL downloads only from exact HTTPS hosts in
`FILE_EXPERT_ANALYZER_ALLOWED_HOSTS`, rejects private DNS results and redirects,
and enforces streaming size/time limits. Local paths remain disabled unless a
dedicated `FILE_EXPERT_ANALYZER_LOCAL_ROOT` is configured.

If the URL/token pair is absent or unsafe, if signed URL creation fails, or if
the external analyzer rejects the request, the app uses the TypeScript analyzer
without sending a signed URL externally.

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
