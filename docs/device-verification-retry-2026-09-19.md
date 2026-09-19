# Device verification retry incident - 19 September 2026

## Current continuation: independently reproduced login and transport faults

The owner asked us to investigate without further Network-tab/screenshots or
routine actions. Those requests are withdrawn; the historical evidence boundary
below does not mean the owner must collect diagnostics. No new Production
release authorization has been given.

New executable evidence:

- The actual LoginPage and authGuards reproduce a delayed unverified `getUser`
  bootstrap logging out a subsequent verified login. This occurs for the same
  account, a different account, and a logout queued behind the newer login.
  The same 10-case harness against HEAD has four failures; current code passes
  all 10, including Google login, genuine unverified rejection, no prior session,
  unmount and effect replay. Bootstrap is now generation/session-bound and uses
  the existing session-conditional local logout. No auth guard is weakened.
- The actual panel reproduces a null INITIAL_SESSION cancelling its initial
  request despite an already primed stable login. It now follows authGuards'
  stable snapshot for that event. Genuine missing sessions still cannot finish.
  Together with the prior effect-cleanup correction, the panel passes 31 tests.
- Actual transport regression tests reproduce a missing optional native timeout
  helper throwing before fetch, a deadline failing to settle pending auth
  preflight, and malformed/statusless responses being accepted. The transport
  now uses a cleared AbortController deadline across preflight/fetch/body and
  validates response fields plus HTTP/state combinations. All 15 cases pass;
  real revocation and error denial remain fail-closed. The compatibility issue
  is NOT attributed to the owner's browser: a read-only aggregate found only
  Chrome 153 among two auth sessions created in the preceding 24 hours.
- A check that has not established a sent challenge no longer instructs the
  visitor to check e-mail. The generic error describes a failed security
  request, not an asserted delivery failure. Retry uses the typed catalog;
  removed dead email-error copy is removed from its master/generated catalogs.
- Handled start errors now reach the existing privacy-preserving reliability
  reporter (allowlisted category + normalized route only, no raw errors/tokens/
  recipients/codes). Its headless exact file is included in the shared source
  manifest rather than exempted from the localization gate.

Real Chrome UI checks use a localhost-only synthetic wrapper of the actual
component and actual translations, with auth and email APIs replaced by local
fixtures. EN/DE/TR/ZH x 320px mobile/1366px laptop x loading/error/challenge:
24 checks, no horizontal overflow, correct code-form/disabled-state behavior,
translated messages and no console errors. The heading wraps on small screens.
This is not an authenticated live login or proof of mail delivery.

Cloudflare read-only inspection reached a signed-out account screen requiring
human sign-in/terms; no login, WAF, CAPTCHA, account or security settings changed.
The remote incident's exact initiating condition remains unobserved. The above
fixes address concrete reproduced defects, not a claim of proven live recovery.

Final working-source validation: `npm test` passes **1742/1742** with zero
failures/skips; standard lint and full web/desktop typecheck pass. `check:i18n`
passes for 12 locales, 2471 reviewed source rows, zero clean English fallback
and 37/37 compact-bundle tests. Clean physical-source build receipt is recorded
separately below when complete; the old junction build is not relabeled.

The fresh physical-source `npm run build -- --webpack` completed with exit 0,
including its unchanged prebuild and strict postbuild. Build ID:
`e-1b8NHHVNTBxftC7DZPn`. The checker verified 43 assets, compiled unauthenticated
401, valid synthetic PNG/PDF and zero external fetches. The snapshot has 1254
source files and 36695 physically copied/hash-matched dependency files; no
dotenv, Git metadata, junction, old build output or new package installation.
Frozen runtime/test/lockfile hashes match the checkout. Receipt:
`C:/Users/gokka/Documents/Codex/auth-incident-artifacts-20260919/new-retry-build-20260919/fresh-build-receipt.json`.
Independent final review checked the three frozen runtime hashes and found no
release-blocking issue. This is a new complete build pass, not a relabeling of
the earlier in-place junction failure. No push/deployment took place; actual
remote recovery remains unverified until an explicitly authorized live release.

## Scope and release boundary

The owner reports a new-device screen after login on another computer. Retry
is clickable and produces "The verification e-mail could not be sent."
This investigation continues the existing authentication incident. No new
Production release, configuration change, email dispatch or database mutation
is authorized or performed here. Production remains d41f336819b2.

## Established evidence

- The panel's catch spans session acquisition, request construction, HTTP,
  response handling and navigation. Its displayed email failure does not prove
  a Resend failure or even an attempted email dispatch.
- Read-only Production metadata confirms the required assurance/challenge RPCs
  and service-role execution grants exist. The configuration remains `shadow`.
  At 13:15-13:17 UTC, two sessions created within four hours both returned
  `not_required` through the inspected read-only assurance function.
- There are no challenge rows or device-verification email-event rows. This is
  EXPECTED for successful `not_required` starts: the route returns immediately
  without sending mail. Those zeros do not prove a missing request or provider
  failure. No identifiers, recipient details, tokens or verification codes were
  retrieved. No security setting was modified.
- Bounded, server-side filtered application logs contained no matching error or
  security-signal entries. This is not request-level evidence; the route catches
  failures without logging their phase.
- In the connected Chrome profile, opening the live login route with an admin
  redirect reached the admin panel using its EXISTING session. No credentials,
  logout or OTP were entered. This is not a fresh login on the affected computer.
- Synthetic checks of the actual authGuards implementation succeeded for both
  a cold persisted session and a newly primed password-login session. They do not
  establish the remote browser's result.

## Confirmed separate lifecycle defect and local correction

Effect cleanup retired the operation but retained its session marker. A locale
or callback change recreated the effect/subscription. The SDK's INITIAL_SESSION
then cancelled the replacement timer and treated the retained session marker as
active work. The original response was fenced out, leaving no current attempt.

Cleanup now clears that marker alongside the retired operation. The change is
one runtime assignment with an explanatory comment. Existing session/revocation
fences, challenge idempotency, translated copy and security requirements remain
unchanged. No dependency or schema changes.

Actual-TSX regressions reproduced four failures before the fix. Afterward:

- 28/28 panel tests pass, covering locale/callback recreation, StrictMode,
  unchanged-session events, stale revocation and `not_required` completion.
- Related auth/device suites passed 82/82 before the final three positive controls.
- Full suite passed 1711/1711 before those three test-only additions; the final
  28-test panel suite covers the additions. No combined full-suite count is claimed.
- Web and desktop typecheck pass; i18n covers 12 locales, 2472 reviewed source
  strings with no clean English fallbacks, and 37/37 bundle tests pass.
- Standard lint passes. Its first attempt scanned a previous generated standalone
  artifact and failed on generated code. That agent-created artifact was moved,
  not deleted, to `C:/Users/gokka/Documents/Codex/auth-incident-artifacts-20260919/verified-artifact`.
  The unchanged standard lint command then passed. No validator exclusion added.
- Independent review of the runtime correction found no actionable P0-P2 issue.
- `npm run build -- --webpack` passed prebuild, compilation, TypeScript and
  282/282 page generation, but exited 1 at the unchanged strict postbuild gate:
  `sharp escaped standalone dependencies.` This matches the existing Windows
  shared-node_modules-junction artifact boundary. It is not a passing build;
  clean physical-dependency packaging verification is still required before
  release. No guard was bypassed or production build executed on the VPS.
- Follow-up independent physical-copy artifact verification passed the unchanged
  checker: 43 required Windows assets, compiled unauthenticated 401, valid
  synthetic PNG/PDF and zero external fetches. All six snapshot trees matched
  source hashes, including the installed dependencies. Receipt:
  `C:/Users/gokka/Documents/Codex/auth-incident-artifacts-20260919/device-retry-artifact-20260919/verification-receipt.json`.
  The prior artifact was preserved. This does not reclassify the in-place build
  exit 1 or authorize release; publication requires a standard release-environment
  source rebuild and packaging pass.

## Remaining incident boundary

The local lifecycle correction does NOT establish or resolve the cause of the
owner's clickable Retry error. Need the affected browser's exact URL and bounded
request evidence: whether `/api/auth/device-verification/start` is sent, its HTTP
status/duration and safe status/outcome fields. Never collect Authorization,
cookies, session tokens, recipient fields or codes. A successful `not_required`
response means inspect completion/navigation, not mail dispatch. An absent
request or rejected HTTP response requires a different diagnosis.

The owner confirmed the affected address is `file.mgautotech.de`, not a local
test environment. The affected computer is not exposed by the current Chrome
connection. The next requested evidence is only the Network panel's `/start`
status after one Retry (or confirmation that no request appears), not HAR,
headers, tokens or the raw body.

The follow-up source audit confirms that handled start failures are not sent to
the global reliability monitor, and the route does not log handled failures.
The bounded live reliability-log check found no relevant entries, which is
consistent with that gap and is not proof of a successful request. Existing
logs cannot replace the affected-browser observation. Repeating the same
database/log aggregates will not narrow the cause.

Keep the incident In Progress. Do not disable verification, change the existing
mode, or claim this incident is solved.
