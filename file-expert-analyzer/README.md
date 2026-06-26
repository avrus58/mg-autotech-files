# MG AutoTech File Expert Analyzer

Optional FastAPI microservice for the `MG AutoTech AI File Expert` module.

The Next.js app already includes a TypeScript fallback analyzer, so this service
is not required for the MVP to run. Use it later when you want the binary
analysis to run outside Vercel or add heavier ECU/TCU analysis logic.

## Local Run

```bash
cd file-expert-analyzer
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8010
```

Then set the web app environment variable:

```bash
FILE_EXPERT_ANALYZER_URL=http://localhost:8010
```

## Input

`POST /analyze`

```json
{
  "job_id": "uuid",
  "ori_file_path": "optional-local-path",
  "mod_file_path": "optional-local-path",
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

For production, prefer signed URLs. The service does not need Supabase keys.

## Important

This service only produces technical analysis JSON. It does not tune files,
does not generate ready-to-write files, and does not guarantee safety.
