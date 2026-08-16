# MG AutoTech File Expert Analyzer

FastAPI worker service for the `MG AutoTech AI File Expert` module.

The Next.js app keeps a TypeScript fallback for local development and tests.
Production fails closed when this worker is missing or unavailable so a large
binary cannot run synchronously on the web request event loop. The worker runs
the CPU-bound inspection in a separate thread and bounds concurrent jobs.

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
FILE_EXPERT_ANALYZER_MAX_CONCURRENT=2

# Local paths are disabled when unset. If enabled, every resolved path must
# remain below this dedicated directory (including after symlink resolution).
FILE_EXPERT_ANALYZER_LOCAL_ROOT=
```

`FILE_EXPERT_ANALYZER_URL` may use plain HTTP only for an exact loopback host
(`localhost`, `127.0.0.1`, or `::1`). Remote analyzer endpoints must use HTTPS.
If the URL or token is missing/unsafe, local development and tests use the
built-in TypeScript analyzer. Production returns a retryable service-unavailable
response instead of running that synchronous fallback.

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
and may not redirect. Responses are streamed with byte and time limits.

The service does not need Supabase keys. Local file inputs are off by default;
when `FILE_EXPERT_ANALYZER_LOCAL_ROOT` is configured they are limited to that
resolved directory.

## Important

This service only produces technical analysis JSON. It does not tune files,
does not generate ready-to-write files, and does not guarantee safety.
