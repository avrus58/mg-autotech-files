# Testing

Recommended local verification:

```bash
npm run lint
npm run typecheck
npm test
npm run build
node scripts/check-payment-env.js --schema-only
npm audit --omit=dev --audit-level=high
git diff --check
```

If database verification is required, use a disposable local Supabase stack only. Do not connect to production Supabase from Codex.
