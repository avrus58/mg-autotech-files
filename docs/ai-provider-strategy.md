# AI Provider Strategy

## Goals

MG AutoTech must be able to use a hosted model today without locking analyzer data, prompts or reports to one provider. The application talks to a small server-side `AiReportProvider` interface and sends only structured analyzer evidence.

## Providers

- `rule_based`: deterministic local fallback and default when no AI provider is configured.
- `openai`: OpenAI Responses API adapter, enabled only when `OPENAI_API_KEY` exists.
- `ollama`: local/self-hosted Ollama chat endpoint.
- `vllm`: vLLM or another OpenAI-compatible self-hosted endpoint.

`AI_PROVIDER`, model/base URL and server-only API credentials select the runtime. The OpenAI adapter uses the Responses API with a strict JSON schema; OpenAI-compatible self-hosted adapters use chat completions. Provider errors never fail the binary analysis; the deterministic report is returned and the failed run is audited.

## Prompt Contract

The versioned prompt requires the model to:

- use only the supplied analyzer JSON;
- separate facts, probable matches and unknowns;
- avoid generating calibration data or exact power claims;
- avoid flash-safety or legal guarantees;
- include checksum, human tuner and logging/dyno recommendations;
- return structured JSON with an executive summary and report.

Before a model call, customer notes, original filenames, printable-string dumps, VIN values, first/last hex previews and changed-block byte arrays are removed. The provider receives only the structured technical result needed for reporting, never raw binaries or customer-identifying fields.

Every attempted report run is written to `ai_model_runs` with provider, model, prompt version, latency, sanitized input metadata, output or error. Audit insertion is best effort so an audit outage cannot break a customer report. Provider failures create a failed run and a second `rule_based` fallback run.

If `AI_PROVIDER=openai` has no API key, or a configured provider is missing its required base URL, the application selects `rule_based` instead of crashing. Ollama and vLLM remain optional future/self-hosted configurations.

## Self-Hosted Future

The provider interface supports an MG AutoTech fine-tuned model behind Ollama, vLLM or an OpenAI-compatible gateway. Training datasets remain provider-neutral JSON. Model runs store provider/model/prompt metadata so outputs can be evaluated before a provider switch.

Fine-tuning and embeddings are future phases. They must use human-confirmed, quality-filtered examples and separate train/evaluation sets. No self-hosted model receives automatic delivery authority.

## Environment Variables

All variables are server-only unless an existing application variable is already public.

```bash
# Default: rule_based
AI_PROVIDER=rule_based

# Server-only demo control. Keep false in Production.
ENABLE_AI_TRAINING_DEMO=false

# Optional OpenAI Responses API
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=https://api.openai.com/v1

# Optional Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gpt-oss:20b

# Optional vLLM / OpenAI-compatible self-hosted endpoint
VLLM_BASE_URL=
VLLM_MODEL=mg-autotech-ecu
VLLM_API_KEY=

# Optional generic local OpenAI-compatible endpoint
LOCAL_AI_BASE_URL=
LOCAL_AI_MODEL=mg-autotech-ecu
LOCAL_AI_API_KEY=

# Optional external binary analyzer
FILE_EXPERT_ANALYZER_URL=
FILE_EXPERT_ANALYZER_TOKEN=
# Configure on the analyzer process for exact signed-URL source hosts:
FILE_EXPERT_ANALYZER_ALLOWED_HOSTS=
```

`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` remain required by the existing server data layer. Never prefix AI keys, analyzer tokens, upload-integrity secrets, or the Supabase service-role key with `NEXT_PUBLIC_`.
