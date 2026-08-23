# MG AutoTech AI File Expert Setup

## What Was Added

- Customer page: `/dashboard/file-expert`
- Customer report page: `/dashboard/file-expert/[id]`
- Admin page: `/admin/file-expert`
- Upload/list/detail/analyze API routes
- Direct-to-Supabase private uploads so ECU files do not pass through Vercel request bodies
- Admin feedback API route
- Supabase SQL migration: `scripts/add-file-expert.sql`
- Isolated FastAPI analyzer: `file-expert-analyzer/` (required in production)
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

Optional for local development, required in production:

```bash
FILE_EXPERT_ANALYZER_URL=http://localhost:8010
FILE_EXPERT_ANALYZER_TOKEN=<random-server-only-token-at-least-32-characters>
FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED=true
FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY=1
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
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

## Isolated Python Analyzer

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

Local development and tests may use the TypeScript fallback when the URL/token
pair is absent or unsafe. Production never runs the binary analyzer inside the
Next.js request. It returns a retryable `503` unless the external analyzer and
the token-bound Upstash/KV admission lease are both healthy. The lease uses the
existing server-only REST credentials, expires automatically, and admits at
one job across all Next.js instances. The current code hard-caps
`FILE_EXPERT_ANALYZER_GLOBAL_CONCURRENCY` at `1`; increasing it requires a
reviewed production-like load test and a code change. Lease expiry is computed
inside Lua from Redis `TIME`, so skewed Next.js clocks cannot expire capacity
early. The Upstash/KV connection, headers, response stream (maximum 8 KiB), and
JSON parse share one 1.2-second deadline; an unknown acquire is never followed
by analyzer work and is left to the Redis TTL.

Deploy `file-expert-analyzer/` as its own Vercel project with that directory as
the project Root Directory. `main.py`, `.python-version`, and `vercel.json` pin
the FastAPI entrypoint, Python 3.12, and a 35-second worker duration. Configure
the analyzer project with only `FILE_EXPERT_ANALYZER_TOKEN`,
`FILE_EXPERT_ANALYZER_ALLOWED_HOSTS`, and the documented analyzer limits; it
does not receive Supabase or Upstash credentials. Configure the HTTPS deployment
URL plus the same token and the distributed admission variables on the Next.js
project. The analyzer health endpoint must return 200 before smoke testing.

The analyzer gives both signed-source downloads one shared 20-second deadline
and downloads an ORI/MOD pair concurrently. The Next caller waits at most 40
seconds, its token-bound global lease expires after 80 seconds, and both File
Expert API functions have a 60-second duration. The lease invariant is the
40-second caller window plus the worker's 35-second hard cap plus a five-second
safety margin, so delayed dispatch cannot expose a second CPU job while the
first worker may still be active. Each route starts a 48-second
operation budget before authentication and leaves eight seconds after the
analyzer phase for bounded similarity/report/completion work. External AI gets
at most 3.5 seconds and degrades to the deterministic report before atomic
completion. Once the initial claim response is acquired, a failure then has an
abortable eight-second token-CAS cleanup window, ending at least four seconds
before the route hard cap. A lost response to the claim write uses the existing
ten-minute token-bound stale recovery path. A lost or
timed-out analyzer response deliberately leaves the lease to expire instead of
releasing capacity while the remote worker may still be consuming CPU.

## V2 Detection Coverage

- ECU/TCU supplier, family and variant signatures
- HW/SW numbers, calibration IDs, VIN-format values and common engine-code markers
- Processor markers such as Tricore, MPC, SPC, RH850 and SH705x
- Raw binary, Intel HEX, Motorola S-record, FRF and ZIP/container classification
- Full/partial/calibration/virtual-read estimation
- Vehicle application candidates from the local MG AutoTech vehicle database
- Human-readable ORI/MOD change and integrity findings

Existing V1 jobs can be upgraded with the **Re-analyze** action. If a completed
job's re-analysis fails, the last completed result remains available and the
request returns a retryable error; it is not downgraded to `failed`.

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
