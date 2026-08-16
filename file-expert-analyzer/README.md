# MG AutoTech File Expert Analyzer

FastAPI worker service for the `MG AutoTech AI File Expert` module.

The Next.js app keeps a TypeScript fallback for local development and tests.
Production requires this worker and fails closed when it is missing or
unavailable so a large binary cannot run synchronously on the web request event
loop. The worker runs CPU-bound inspection in a separate thread and bounds
concurrent jobs.

## Local Run

```bash
cd file-expert-analyzer
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8010
```

Configure the analyzer and the Next.js server with the same random, server-only
token (at least 32 characters). Never expose it through a `NEXT_PUBLIC_*` or
`VITE_*` variable. URL downloads are disabled unless their exact HTTPS host is
allowlisted.

```bash
FILE_EXPERT_ANALYZER_URL=http://localhost:8010
FILE_EXPERT_ANALYZER_TOKEN=<random-server-only-token-at-least-32-characters>
FILE_EXPERT_ANALYZER_ALLOWED_HOSTS=<project-ref>.supabase.co
```

Optional analyzer-only limits:

```bash
# Hard-capped by the service at 33554432 bytes per source.
FILE_EXPERT_ANALYZER_MAX_SOURCE_BYTES=33554432
FILE_EXPERT_ANALYZER_TIMEOUT_SECONDS=20
FILE_EXPERT_ANALYZER_MAX_CONCURRENT=1

# Local paths are disabled when unset. If enabled, every resolved path must
# remain below this dedicated directory (including after symlink resolution).
FILE_EXPERT_ANALYZER_LOCAL_ROOT=
```

`FILE_EXPERT_ANALYZER_URL` may use plain HTTP only for an exact loopback host
(`localhost`, `127.0.0.1`, or `::1`). Remote analyzer endpoints must use HTTPS.
If the URL or token is missing/unsafe, local development and tests use the
built-in TypeScript analyzer. Production returns a retryable service-unavailable
response instead of running that synchronous fallback.

## Vercel Deployment

Create a separate Vercel project whose Root Directory is
`file-expert-analyzer`. The checked-in `main.py` is the FastAPI entrypoint,
`.python-version` pins Python 3.12, and `vercel.json` caps the function at 35
seconds. API documentation endpoints are disabled; `/health` returns 200 only
when an ASCII token and at least one source host are configured.

This is a commercial production workload. Vercel Hobby is limited to
non-commercial use; obtain an owner-approved Pro/Enterprise plan (or choose an
approved non-Vercel worker host with an equivalent hard 35-second request cap)
before production deployment. Vercel Services
can colocate Next.js and FastAPI under one project, but it is currently Private
Beta and must not be assumed available. The existing Next.js project also owns
many `/api` routes, so a catch-all Python route is not an approved fallback.

Configure only these server-side variables on the analyzer project:

```bash
FILE_EXPERT_ANALYZER_TOKEN=<same-random-token-as-the-Next-project>
FILE_EXPERT_ANALYZER_ALLOWED_HOSTS=<exact-staging-or-production-project-ref>.supabase.co
FILE_EXPERT_ANALYZER_MAX_SOURCE_BYTES=33554432
FILE_EXPERT_ANALYZER_TIMEOUT_SECONDS=20
FILE_EXPERT_ANALYZER_MAX_CONCURRENT=1
```

Keep `FILE_EXPERT_ANALYZER_LOCAL_ROOT` unset on Vercel. The analyzer does not
need Supabase, Upstash, model-provider, or application credentials. On the
Next.js project, set the analyzer's HTTPS base URL, the shared token,
`FILE_EXPERT_ANALYZER_DISTRIBUTED_ADMISSION_ENABLED=true`, and the existing
server-only Upstash/KV REST connection. The Next layer admits exactly one job
globally and the service semaphore is also hard-capped at one. Raising either
limit requires a reviewed production-like load test and a code change.

The two signed sources are downloaded concurrently under one 20-second overall
deadline. The Next caller's 40-second timeout is longer than the worker's
35-second Vercel cap; its token-bound lease expires after 80 seconds using
Redis server time. That TTL equals the 40-second caller window plus the
35-second worker hard cap plus a five-second safety margin, covering delayed
dispatch and an unknown response. The Next route has a 48-second operation budget inside its
60-second hard cap, so report fallback, atomic completion, and token-CAS cleanup
run before platform termination. If the caller loses the response, it does not
release the lease early because the worker may still be consuming CPU.

## Input

`POST /analyze`

```json
{
  "job_id": "uuid",
  "ori_file_url": "optional-signed-url",
  "mod_file_url": "optional-signed-url",
  "metadata": {
    "brand": "BMW",
    "model": "320d",
    "engine": "N47",
    "ecu_type": "EDC17",
    "read_method": "Bench"
  }
}
```

Send `Authorization: Bearer <FILE_EXPERT_ANALYZER_TOKEN>` and a bounded
`Content-Length` with every `/analyze` request. The Next.js caller sends only
short-lived signed URLs; it does not send Storage paths. URLs must use HTTPS,
match `FILE_EXPERT_ANALYZER_ALLOWED_HOSTS`, resolve only to public addresses,
and may not redirect. Responses are streamed with byte limits and the pair
shares one wall-clock download deadline.

The service does not need Supabase keys. Local file inputs are off by default;
when `FILE_EXPERT_ANALYZER_LOCAL_ROOT` is configured they are limited to that
resolved directory.

## Important

This service only produces technical analysis JSON. It does not tune files,
does not generate ready-to-write files, and does not guarantee safety.
