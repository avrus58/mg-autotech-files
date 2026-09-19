# Login refresh storm investigation - 2026-09-19

## Incident status

The owner reports both admin and customer dashboard still lose the session
after release e90e4362c7ba. Prior existing-session browser checks did **not**
establish affected-device recovery. The incident remains In Progress.

## Newly observed Production evidence (read-only)

At approximately 17:46-17:53 UTC, the canonical Production project and live
e90e4362c7ba deployment were inspected without changing configuration or data.

- Supabase Dashboard gateway logs show one password-grant POST200 at
  17:43:45 UTC, followed by **31 refresh-grant POST200 responses** from
  17:43:46 through 17:43:50, then a refresh-grant POST429 at 17:43:50.
  These are actual request rows, not a synthetic test or merely an audit count.
  The dashboard displayed Europe/Berlin time (19:43). No request bodies,
  tokens, credentials or customer details are retained in this report.
- Early Auth user/profile/assurance requests in that sequence return200.
- Read-only aggregates show the recent staff sessions still exist; the current
  assurance function returns `not_required` for them. This is not proof that
  every reported failing login is one of those surviving sessions.
- The Auth sessions UI shows3600-second access-token lifetime, no single-session
  enforcement, no time-box/inactivity timeout, and10-second refresh reuse
  interval. These settings were not changed.
- `auth.audit_log_entries` is empty. Application reliability logs contain no
  matching classified auth failure; neither absence rules out the incident.

The service-side refresh storm is confirmed. The affected computer's clock
has **not** been directly observed; clock skew is a reproducible explanation
matching this sequence, not a proven remote-device fact. The owner was asked
to check the displayed date/time; no credentials or developer-console work is
requested. No connected failing File Service tab was available.

## Reproduction and bounded correction

The installed Auth SDK preserves server `expires_at`, then compares it with
browser `Date.now()`. With a browser two hours ahead, a fresh one-hour token
looks expired. Auth-notification-triggered reads repeatedly refresh it.
After an injected429, the SDK treats that error as non-retryable and removes
the apparently expired local session. A subsequent read returns null session
and null error: exactly the common BrowserAuthBoundary login-required branch.

The new `browserAuthFetch` adapter rebases **only local refresh scheduling
metadata** using `requestStart + expires_in` on successful responses from the
exact configured Auth token endpoint. It is wired only to the browser client.
Small differences (<=60 seconds) remain untouched. Network delay is subtracted,
not added to the lifetime. Malformed/error/non-token/redirected responses pass
through. Signed tokens, server expiry, validation, RLS, device verification,
revocation, CAPTCHA and rate-limit settings are unchanged. No new dependency,
schema, UI copy or translation change.

Old metadata on a clock-behind device is not magically corrected at cold load:
the normal API401/explicit-refresh path must first receive a fresh response.
Changing a computer's clock while already signed in is likewise not claimed
as an exhaustively covered case.

## Verification

- Actual SDK controls reproduce the storm and null/null boundary trigger.
- Actual adapter plus SDK: fast/slow clocks, bounded auth-event feedback,
  cold-session refresh recovery, delayed responses, invalid passwords and
  expired/revoked refresh denial pass (19 clock tests).
- Response-isolation tests preserve errors, redirects, malformed lifetimes,
  transport failures and abort signals (6 tests).
- Prior source-bound fresh-login and isolated-verifier regressions pass.
- Full suite1790/1790 passes; lint and full web/desktop typecheck pass.
- Fresh standard physical-source build passes, including the unchanged i18n
  prebuild and strict standalone postbuild. Receipt completed at18:36:26 UTC,
  exit0, build ID `CmInUVcEomHxO6b4BYy2m`; all frozen runtime/test hashes still
  match. This is a local release-candidate build, not a Production deployment.
- Independent source-bound review reports no blocking finding. Final reviewed
  runtime SHA256: browserAuthFetch
  `f16d34a048634924216a46d892b07c4476af70d31d76a578e2e4ad79c2d6ace6`,
  supabaseClient
  `e90953d28027eec9b8f450ee7d4d2c03eab54c4049fbc1a41cacf32b5ae1fa94`.

No new deployment, configuration or Production database mutation is performed
for this change. Live version remains e90e4362c7ba. Affected-device recovery and
new release approval remain outstanding; do not mark the incident resolved.

References: [Supabase session/clock-skew guidance](https://supabase.com/docs/guides/auth/sessions),
[supported custom fetch option](https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js).
