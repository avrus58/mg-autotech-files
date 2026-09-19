# Auth refresh-scheduling hotfix release - 20 September 2026

## Authority and immutable scope

The owner answered `evet` to the direct request to publish only the prepared
clock-skew correction. Source is clean commit
`01ba96a9fe008ea164415ee1cee58408597ad1a6`; previous live source is
`e90e4362c7bad699cb765402a6fa558cbb872e1e`.

Runtime scope is exactly `src/lib/browserAuthFetch.ts` and
`src/lib/supabaseClient.ts`. Remaining changes are regression tests and incident
receipts. There is no schema, environment, dependency, server authorization,
device-verification, CAPTCHA, rate-limit, price, payment or legal change.
Signed tokens and server-side expiry/revocation enforcement are unchanged.

## Release gates and preparation

- Exact-source full suite1790/1790, standard lint, web/desktop typecheck and
  i18n pass. Fresh physical-source standard build passes prebuild37,
  280 pages and unchanged strict postbuild43 assets, protected401, PNG/PDF,
  zero external fetches. Local build ID `CmInUVcEomHxO6b4BYy2m`.
- Independent release review confirms all23 frozen hashes match both checkout
  and build snapshot, raw test/build logs corroborate the receipts and there is
  no blocking finding. No repeat full validation of unchanged source was needed.
- Read-only Production pre-smoke:39/39 PASS. Recorded app/analyzer pair e90
  healthy with zero restarts; release state matches. Both e90 images remain
  available for rollback. Main-site app, Caddy and Postgres are not targets.
- Source archive SHA256
  `ae099b6aef7c80790eecd984185a3e600fe3bad5f14cef9608bae0b6c640c311`
  is identical locally and on the VPS. Only environment-template paths are
  excluded. Windows Git archive applies CRLF to unspecified text files;
  both runtime members equal their reviewed Git blobs after CRLF normalization.
  Shell scripts and byte-checked generated catalogs retain explicit LF policy.
- Isolated release path:
  `/opt/mgautotech/file-service/releases/01ba96a9fe00`.
- Initial hash check while SCP was incomplete failed closed before any
  extraction; completed upload subsequently passed the exact hash check.
  The existing application was unchanged during preparation.

Rollback command if required:

```sh
cd /opt/mgautotech/file-service/releases/01ba96a9fe00
bash scripts/vps/rollback.sh e90e4362c7ba
```

## Deployment and verification

The unchanged `bash scripts/vps/deploy.sh 01ba96a9fe00` completed with exit0.
Fresh Linux prebuild37, Turbopack compilation, TypeScript, 282/282 pages and
strict postbuild all pass (69 assets, protected401, valid PNG/PDF, zero external
fetches). No validator or security control was skipped.

- App `mgautotech-file-service:01ba96a9fe00`, image
  `sha256:62010ce0f8626f50e1dde3e96dae77a5e9dc0b69835fb5de30a6447563f8965d`,
  started `2026-09-19T22:34:34.60955994Z`, healthy, zero restarts.
- Analyzer `mgautotech-file-expert-analyzer:01ba96a9fe00`, image
  `sha256:1ff57c65d81ae4c8e940eab77121eb033f2fe9db3cb2185740ff2cd3d96eb479`,
  started `2026-09-19T22:34:27.023411963Z`, healthy, zero restarts.
- Atomic release state records the new pair and previous e90 pair. Both e90
  rollback images remain available. Build ID `P2KSaqUDDLx3aNrcRnFhn`.
- Immediate post-smoke at `2026-09-19T22:34:52.493Z`:43/43 PASS. These cover
  12-locale initial HTML, public/auth/panel shells, readiness/no-store, redirect,
  three protected anonymous401 responses, current/previous assets and main site.
- Separate main-site app, Caddy and Postgres image IDs, start timestamps and
  zero restart counts exactly match the preflight snapshot.
- Public login HTML lists18 scripts. A direct public GET verifies the new
  adapter is served in `/_next/static/chunks/2v178cm3bgxit.js` (HTTP200), including
  token-endpoint matching, relative-lifetime scheduling and header cleanup.
- In-app browser login form reaches `Security verification complete.` and an
  enabled Login button. No form submission or OAuth action. Bounded console
  capture has four opaque Turnstile-source entries, no application-source
  errors; this is not a zero-console-error claim or authenticated-login test.
- No rollback required. No configuration/database/payment/data mutation.
- Independent post-release review corroborates the archive digest, fresh Linux
  build/packaging, healthy runtime pair, retained rollback images, unchanged
  separate services and39/43 smoke receipts; no inconsistency found. Browser
  observations are root's bounded evidence, not independently repeated.

Publication is complete. The incident stays In Progress until affected-device
fresh-login recovery is confirmed; a successful deployment is not that proof.

## Evidence limits

The September19 live31-refresh/429 sequence and clock-skew reproduction are
documented in `docs/auth-refresh-storm-2026-09-19.md`. The affected remote
computer's clock is unobserved. Successful deployment and anonymous smoke do
not prove its fresh-login recovery. This turn has no connected File Service
Chrome tab; only the in-app browser is available. No password, token, cookie,
OTP, customer data or real email is used for smoke tests.

Local ignored evidence: `.autopilot/runtime/auth-clock-release-20260920/`.
