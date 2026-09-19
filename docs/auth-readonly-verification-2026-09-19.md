# Fresh-login session deletion: read-only verification hotfix

## Publication update

The owner's subsequent `evet` explicitly approved this new correction.
`e90e4362c7bad699cb765402a6fa558cbb872e1e` is now live after a successful standard
Linux build, unchanged strict postbuild and healthy release switch. Pre 39/39
and post 43/43 read-only smoke checks passed. The following implementation notes
retain their pre-publication approval boundary as history. Current receipt:
`docs/production-release-2026-09-19-readonly-auth.md`. The affected remote
computer's fresh login has not been observed, so the incident is not marked Done.

## Current incident and scope

After release `031923f40a98`, the owner explicitly reports that a fresh admin
login still returns within seconds to **Please log in to access the admin
workspace**. The prior existing-session Chrome checks did not establish recovery
on the affected computer. The incident remains In Progress.

This follow-up changes only browser user verification and its three consumers:
login bootstrap, customer onboarding and the datalog loader. It does not change
server authorization, device verification requirements, session lifetimes,
security configuration, localization, schema, dependencies or lockfiles.
Fresh Production approval for this new correction has been requested separately;
the earlier approval and release are not reused as authority.

## Reproduced failure mechanism

The installed `@supabase/auth-js` 2.110.0 client is lockless by default. Its
`getUser` implementation handles `AuthSessionMissingError` by unconditionally
removing its stored session and emitting `SIGNED_OUT`. That mutation occurs
inside the SDK, before an application's late-response guard receives the error.

An actual-SDK synthetic regression reproduces this sequence:

1. Verification of an old persisted session starts.
2. A subsequent successful login saves and primes a fresh session.
3. The old `/user` response arrives as HTTP 401 `session_not_found`.
4. The shared SDK deletes the fresh session and emits `SIGNED_OUT`.
5. Actual application guards and `BrowserAuthBoundary` render the exact reported
   admin login warning.

Passing an explicit old JWT to the **shared** SDK does not prevent its deletion
behavior. The tested HTTP 401 `bad_jwt` response and successful old read do not
cause that SDK mutation; the regression distinguishes those controls.

This proves a concrete application failure mechanism, not that the remote
computer has been observed producing that exact response. Bounded read-only
server review found no evidence attributing this incident to device revocation,
cookie loss, email delivery or automatic staff logout. No claim of confirmed
remote recovery is made.

## Correction and security boundaries

`verifyBrowserAccessToken` uses a separate Auth client with private in-memory
storage, no persistence, refresh, URL session detection or cross-tab broadcast.
It requires an explicit nonempty token and never falls back to the shared
session. The SDK can reject that read without deleting the sign-in session.

`getStableUser` captures the current stable session, checks identity and exact
access-token currency before and after verification, and rejects a mismatched
returned user. An account replacement or same-session token rotation discards
the stale result. Failures do not promote a cached user to server-verified data.
The three browser callers use this wrapper instead of shared-client `getUser`.

Current invalid tokens still return user-null and an error. Genuine absent and
revoked sessions remain denied; authoritative revocation still signs out the
current browser locally. Server API guards are unchanged. There is no grace
access, CAPTCHA/device bypass, global logout, customer-data change or real
verification email in these tests.

## Executable evidence

- `tests/sdk-user-verification-race.test.ts`: 15 passing actual-SDK cases,
  including six executing the production verifier source. Covers same/different
  account replacement, shared implicit/explicit-token hazard controls, isolated
  rejection, valid/invalid responses and empty-token refusal. An in-memory
  negative mutation that reintroduces shared-client verification produces three
  expected preservation failures; unchanged production source passes again.
- `tests/admin-fresh-login-regression.test.ts`: eight passing cases executing
  actual SDK and application source with deterministic hooks/timers (not a
  DOM/browser E2E run). Asserts the exact `AuthRequired` warning title and covers
  preserved fresh login through 30 simulated seconds, absent/revoked denial,
  late successful old-account data, same-session token rotation, genuine
  server-verified user and current invalid user denial without cached fallback.
- Existing auth/device, onboarding and datalog targeted suite: 51/51 pass.
- All transports, users, passwords and tokens in these tests are synthetic.
  No live provider request or user record is created.

## Final validation and release state

Standard lint, full web/desktop typecheck and localization checks pass. The
localization gate retains 12 locales, 2471 reviewed source rows, zero clean
English fallback and 37 compact-bundle tests. The complete `npm test` suite
passes **1765/1765**, with zero failures, skips or cancellations. Independent
frozen-source review found no blocking issue and confirmed identical installed
SDK module resolution and unchanged server authorization/dependencies.
Fresh physical-source `npm run build -- --webpack` passes with exit 0,
including unchanged standard prebuild and strict postbuild. Build ID:
`OxoJE3X7HZ4tn5MP0ZqVt`; 280/280 generated pages. The emitted route listing
matches the prior local build. The checker verifies 43 assets, protected-route
401, valid synthetic PNG/PDF and zero external fetches. All frozen runtime,
test, lockfile and validation-source hashes still match the checkout.
No dotenv files, old build output or dependency junctions were copied, and no
packages were installed. The snapshot contains 1257 source files and 36695
physically copied/hash-matched dependency files. Receipt:
`C:/Users/gokka/Documents/Codex/auth-incident-artifacts-20260919/readonly-user-build-20260919/fresh-build-receipt.json`.

No UI strings, JSX layout, styling or translation catalogs changed. Existing
localized loading/error/denied states remain intact; the new deterministic
boundary regressions check state transitions, not browser visual screenshots.
This is a verified local implementation/build, not a Production release receipt.

Production remains `031923f40a98`. No new push, deployment, configuration or
database mutation has been performed for this correction. The affected remote
computer's fresh login remains unobserved; do not mark the incident Done.
