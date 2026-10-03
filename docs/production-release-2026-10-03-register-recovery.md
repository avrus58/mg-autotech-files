# Registration verification recovery release — 3 October 2026

## Scope and authorization

Owner approved the named registration-recovery Production release with `evet`.
This is a code-only release for `https://file.mgautotech.de` on the existing VPS.
The separate workshop site, DNS/Caddy, databases, authentication policy, consent,
pricing, payments, Ads budgets and campaign settings are outside this release.

The exact source is `61d82840aac725595bdaffb23a8e877133b720b5`, on
`codex/acquisition-recovery-20261003`. The runtime is identical to `5eb9509`;
the final commit corrects one test-only native-language assertion. Relative to
previous live `dec7f5be3197`, runtime changes are limited to:

- `src/app/register/page.tsx`: keep account-created verification recovery
  mounted after resend failure, present one active recovery challenge, unmount
  inactive signup challenges and preserve fresh-token/fail-closed checks.
- `src/lib/i18n/customer-runtime-translations.ts`: complete the existing phone
  `Code` label from reviewed master translations in all 11 non-English locales.

No schema, migration, environment, package or lockfile change is included.
The unrelated dirty owner checkout was not used for the release.

## Source and preflight evidence

- Branch push verified remotely at exact source `61d82840aac725595bdaffb23a8e877133b720b5`.
- Git archive SHA256:
  `bf0f8bdd22f6ef42731413b6e0b92771b6129405b5b0be269f7531948ecbe7ee`.
  Transfer finished before checksum verification and extraction into the fresh
  immutable `/opt/mgautotech/file-service/releases/61d82840aac7` directory.
- Extracted RegisterPage and runtime catalog match their committed LF-normalized
  SHA256 values (`61593d99...f3ae`, `89c5c2f3...1839`). The Windows archive's CRLF
  conversion is not a runtime-source difference. No `.git`, `.env` or `.env.local`
  was present in the extracted source.
- Baseline application and analyzer `dec7f5be3197` were healthy with zero
  restarts; their local image pair is retained for rollback. Release state
  agreed with actual containers before any runtime switch.
- Final Linux Docker build-only exited 0 for `61d82840aac7`, reusing the compiled
  unchanged runtime layers from `5eb9509`. That intermediate runtime build
  compiled and generated 282/282 pages; unchanged strict postbuild passed with
  69 required assets, compiled unauthenticated 401, valid synthetic PNG/PDF and
  zero external fetches. Its obsolete SSH client did not close normally and was
  stopped only after the remote build had completed; the final source build's
  explicit server exit receipt and client exit are both 0.

## Validation

Final focused tests 68/68, full tests 1813/1813, i18n bundle tests 37/37, lint and
web/desktop typecheck passed. The i18n gate covers 12 locales and 2473 reviewed
exact/invariant rows per non-English locale, with zero clean-English fallback.

Independent frozen review passed 34/34 scoped cases with no blocker. It also
executed the actual native-language assertion against five malformed in-memory
cases; all were rejected. Native `Code` is allowed to share English spelling
only in DE/NL/FR, with exact master parity and an exhaustive expected pair set;
all other source/locale pairs retain the no-English-fallback assertion.

Earlier failures are preserved, not relabelled passes: shared dependency
junctions failed strict standalone packaging; an ignored temporary browser
helper failed lint; and the original generic equality test rejected correct
native spelling. Existing physical dependencies, removal of the owned helper
and the precise test-only correction resolved these without weakening guards,
installing packages or changing runtime configuration.

Fresh final `npm run build -- --webpack` exited 0 at 15:45:34 UTC. Build ID:
`-0Dp2KWW-biIU51yrk_gz`. Its unchanged prebuild passed 37/37; compilation,
TypeScript, 282/282 pages and strict postbuild passed (43 required assets,
compiled unauthenticated 401, valid synthetic PNG/PDF, zero external fetches).
Consolidated receipt: `.autopilot/runtime/register-recovery-final-validation-receipt.json`.

The composite .NET/browser-launch command was rejected before execution and was
not repeated or re-encoded. The reviewed repository foreground `next start`
local-preview path was separately accepted, serving the fresh `.next` directly
on loopback 3185 with an OS-only environment and synthetic `.invalid` Supabase
settings. It needs no artifact copy or background .NET process; its expected
standalone-configuration server warning is distinct from browser-console errors
and from the Production standalone deployment. Anonymous registration GET is
200/noindex. Final actual hydrated browser acceptance passed: EN/DE/TR/ZH at
1366x768 and 390x844 (8 views), real language-menu transitions, TR/ZH reload
persistence, native/visible `Kod` and `代码`, one form, no horizontal overflow
and no captured browser warning/error. Root visually reviewed final TR laptop
and ZH mobile screenshots. Receipt:
`.autopilot/runtime/register-hydrated-browser-final-qa/receipt.json`.
Original EN preference and viewport were restored, the owned tab closed and
root's exact loopback preview process stopped; no listener remains on 3185.

## Production promotion

Completed. Final pre-smoke at 15:46:09 UTC passed 57/57, recording 20 selected
public hashed-asset baselines. The unchanged existing
`scripts/vps/deploy.sh 61d82840aac7` exited 0 from the checksum-verified immutable
source. Immediate post-smoke at **15:53:20 UTC** passed **58/58**:

- 12-locale public home/file-service responses retain language and HTTP behavior.
- EN/DE/TR/ZH login/register responses remain 200/noindex.
- Readiness is 200/no-store with `{"status":"ok"}`.
- Anonymous protected branding remains 401/private/no-store; report GET is
  method-denied and admin/dashboard shells remain noindex.
- All 20 sampled previous assets remain 200 and byte-hash identical, and the
  current public register client chunks contain `registration-verification`.

Application and analyzer are both `61d82840aac7`, healthy with zero restarts;
actual container image IDs match their current local tags:

- App: `sha256:b10bd9b4b8ee829739f09e3648beeb5ac9ce050858c076fb9964a0b2a4e92612`.
- Analyzer: `sha256:89d800d6bb2343448f0b26343606de638719e80ee39ad2f136e57352d948822b`.

The deployed Linux standalone Build ID is `PC2QiKnTAn4etegisf6iU` (distinct
from the local Webpack QA build). Release state records the new current pair
and previous `dec7f5be3197`; both previous images still exist. No rollback was
needed. Critical regression recovery remains
`scripts/vps/rollback.sh dec7f5be3197` from the same release source. The separate
workshop homepage returned 200; no routing or other-site configuration changed.

Ignored receipts are `production-register-pre-smoke.json` and
`production-register-post-smoke.json` under `.autopilot/runtime/`. Build and
deploy exit files/logs remain root-protected under `/var/lib/mgautotech-file-service`;
only safe phase/status fields were displayed. Later QA-documentation commits
do not change or redeploy the immutable runtime source.

## Evidence boundaries

Recovery handler and challenge tests use synthetic SDK/widget responses. Browser
acceptance is localhost-only and does not submit signup, CAPTCHA, email or
payment transactions. Production smoke is anonymous GET-only. No real customer
record or conversion was created.

The unchanged prefixless auth document returns raw `html lang="en"` before its
existing preparse language boundary sets the selected locale. Correct hydrated
first paint is not JavaScript-disabled/raw-HTML language proof; this release does
not claim to resolve that separate existing boundary.

This release is not proof of real email delivery, authenticated persistence,
Google conversion receipt or new paying customers. Historical Ads and website
cohort observations remain in `acquisition-money-audit-2026-10-03.md`; they are
not refreshed campaign results from this release turn.
