# Acquisition verification — 12 September 2026

## Scope and safety

Manual owner-requested investigation after a live Ads status review. Work is
isolated on `codex/acquisition-verification-20260912`, based on
`e31235db5f96fcfd8fb14dadf95923dfd4de685a` (documentation-only successor of the
documented `742553f7d618` Production runtime). The old dirty main checkout is
untouched. The legacy checkout has no schema-v2 Autopilot runtime: no autonomous
cycle, acceptance or deployment is claimed.

No campaign activation, budget/rule change, live database operation, real
customer upload/order/payment/email, artificial conversion, or release occurred.
Installed dependencies were reused from an existing physical local directory
only after matching root lockfile SHA-256; no package installation or lockfile
change. No environment file or secret was read.

## Current Google UI evidence

Authenticated Chrome account: **MG AutoTech File Service**. At approximately
00:15–00:25 Europe/Berlin on 12 September:

- Google Ads says none of the ads are running; campaigns remain paused.
- Last seven days shown (5–11 September): EN Search **EUR 20.07, 27 clicks,
  497 impressions, 5.43% CTR**. The Ads conversion table still shows zero for
  its four listed actions.
- Registration: No recent conversions. Verified File Request: Needs attention,
  tag inactive, last activity 31 August. Purchase: inactive/unverified.
- Google's own Request troubleshooting opened Tag Assistant. It connected to
  the public File Service page and found `G-PX085CX6M0` and `AW-18379047445`.
  The selected Ads tag displayed its on-page gtag config and Page View hits.
  Consent Default and Consent Update events were visible. Existing Analytics
  and Ads choices on the site were checked; no change to those choices was
  intended. One save click timed out and was not counted as a successful save.
- No request conversion was triggered. The connection subsequently dropped;
  the browser inventory showed Tag Assistant Not connected, then selecting the
  tab returned `Debugger unattached`. Further receipt/consent-payload diagnosis
  could not be completed. The diagnostic tabs may remain open; they were not
  falsely marked as a successful conversion test.

**This proves the base tags can load in this connected browser, not that a real
registration, request or purchase conversion was received or attributed.**
Inactive/no-recent labels alone do not establish a broken implementation.
[Google's troubleshooting guidance](https://support.google.com/google-ads/answer/10989978?hl=en-GB).

Earlier first-party aggregate registration/revenue observations are historical,
not re-queried here. Do not compare a 30-day revenue total with seven-day Ads
spend, classify all registrations as paying customers, or call historical
revenue a new September sale.

## Confirmed customer-facing defect

`src/app/new-request/page.tsx` awaited
`/api/account/request-upload/prepare` without catching transport rejection.
HTTP failure and malformed JSON already had recoverable paths, but a rejected
fetch escaped with `submitting=true` and an empty message. A customer could not
retry without reloading and potentially losing their selected file/form.

The scoped catch now releases the button and uses the existing localized
preparation error. Form, selected File and opaque idempotency metadata remain
available for retry. The existing error element is an atomic alert. CSS and
visible wording are unchanged. Successful confirmed creation remains the only
path clearing retry metadata. No automatic retry or credit-policy change.

This is a real obstacle, but no evidence ties every lost registration or
unsubmitted request to this defect.

## Verification

- Actual handler and actual credit-check AST executed with isolated doubles.
  Actual error JSX rendered with the real translation function in all 12
  locales. **8/8 focused tests pass.**
- Independent in-memory substitution of the baseline handler: **5 pass / 3
  fail**. Failures exactly cover transport rejection, retry after rejection,
  and absent error announcement. Current candidate: **8/8 pass**.
- HTTP 503, malformed JSON, incomplete upload fields and the paid-request
  credit guard retain their behavior. One successful synthetic retry uses the
  same File and idempotency key; no downstream operation occurs on rejection.
- Independent final source review found no scoped blocking issue.
- Baseline measurement/consent/onboarding suite: **131/131 pass**, using the
  clean documented release source. These use synthetic callbacks, not Google
  receipt proof.
- Final full suite: **1635/1635 pass**, zero failures/skips. Full lint and
  web/desktop typecheck pass. `check:i18n` passes for 12 locales and 2472 source
  strings, including 37/37 bundle tests; it also passed again as build preflight.
  `npm run build -- --webpack`: **pass**, 282/282 prerendered pages. Mandatory
  postbuild: 43 report assets verified, compiled unauthorized route 401,
  synthetic PNG/PDF generated, zero external fetches in that check. Build used
  a synthetic `.invalid` Supabase URL/key, no environment file or service key.
- Layout source: unchanged single column below xl, 320px summary at xl,
  full-width action and naturally wrapping error. A disposable localhost-only
  fixture rendered the actual source error JSX with candidate compiled CSS.
  EN/DE/TR/ZH first paint and language links were visually checked at 390x844
  and 1366x768: all eight cases fit without horizontal overflow; the error used
  the native locale with no English fallback. German wrapped naturally in the
  320px summary. Captured console warnings/errors: none. Test viewport reset,
  fixture tab/server closed and disposable fixture removed afterward.
  This checks the changed feedback element, not an authenticated whole-page
  E2E flow or real screen-reader announcement. Fixture headings/action framing
  were synthetic English, not new product copy.

## Remaining gates and next business step

1. Local bounded fix is complete. Publish only this reviewed fix after explicit
   owner release authorization; authenticated backend delivery remains a
   separate post-release verification, not inferred from synthetic tests.
2. Confirm the next legitimate registration/request's consented completion
   event in Google diagnostics and reconcile its aggregate first-party funnel
   evidence. Do not manufacture successful events or spend simply to make a
   diagnostic status green.
3. Only then decide an explicitly bounded EN Search restart with a verified
   stop rule and spend limit. Other campaigns stay paused unless specifically
   approved. No guaranteed cost-per-customer or acquisition claim is made.

## Subsequent owner-authorized publication

The subsequent `canliya al` instruction authorized this bounded fix. Source
`511a22b48c7e30eae5e026bf6f8512c7c84389e4` was published to the existing VPS on
12 September at 01:05 Europe/Berlin. The initial no-release statements above
describe the investigation before that instruction. Fresh release checks and
the actual Linux build passed; immediate anonymous post-smoke passed 42/42.
Both release services are healthy, and the prior pair is retained for rollback.
Details: `docs/production-release-2026-09-12-request-recovery.md`.

The publication gate in item 1 is now complete. Authenticated backend delivery
and genuine Google receipt remain separate unverified gates. No campaign was
reactivated or campaign setting changed during publication.
