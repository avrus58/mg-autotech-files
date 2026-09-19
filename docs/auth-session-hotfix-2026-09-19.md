# Browser session recovery hotfix - 2026-09-19

## Scope and evidence

The owner reports Chrome showing the admin workspace briefly and then returning
to "Please log in to access the admin workspace" on other computers. This is an
urgent, scoped auth correction, not a redesign or a change to authorization.

The feature checkout starts at `1a9f0d13ba23035cddfe7b4dba79cde2163ac48a`.
Its application parent is `c08b842683bd86d977177455f3564495e66b19bd`; read-only
VPS container metadata identifies that same application image as live.
Unrelated changes in the owner's other checkouts are excluded.

Source and deterministic tests establish these defects:

- A delayed revoked response or obsolete component check could sign out a newer
  browser session or replace its UI with an unauthenticated state.
- A delayed SDK session read could resurrect an explicitly cleared session.
- Ordinary logout used Supabase's default global scope, affecting other devices.
- The installed Auth SDK allows a delayed logout response to remove a newer
  login unless the application's explicit session mutations are serialized.

The last defect has a negative control against the actual installed SDK with a
synthetic fetch implementation, followed by a passing serialized control.
Fixtures do not use real accounts, credentials or external network calls.

These are reproducible code defects, not conclusive evidence of the exact
trigger on the owner's failing computer. Once Chrome became available, the
existing connected session loaded admin and remained authenticated through a
customer-panel navigation and back. That browser did not reproduce the report.
No logout, cookie clearing, credential entry or customer mutation was performed.

The connected Chrome session also permitted read-only inspection of Production
Supabase Authentication > Sessions. Single-session enforcement is off;
time-box and inactivity timeout are both zero (never). Access-token expiry is
3600 seconds; refresh-token replay protection is enabled with a 10-second reuse
interval. No settings were changed. This rules out an enabled provider
single-session/time-box setting in the observed configuration, not every
possible refresh or client failure.

## Correction

- Correlate results with user/session identity, retaining identity across normal
  JWT rotation. Decoding here is for correlation only, never authorization.
- Fence SDK reads/refreshes with a browser-local revision; discard obsolete
  successful, revoked and verification-required responses.
- Serialize explicit password/Google/signup/code-exchange and logout operations
  through a browser queue and same-origin Web Locks where supported. Keep the
  lock until the underlying SDK operation actually settles; no early release.
- Before conditional logout, recheck persisted SDK identity inside that lock,
  including the case where another tab's auth broadcast has not yet arrived.
- Fence boundary and verification-panel lifecycle work. A new logical session
  restarts verification; token refresh does not restart its existing challenge.
- Keep verification-completion callbacks stable and revalidate authority before
  opening protected content.
- Ordinary logout is local. Successful password reset explicitly retains global
  logout. Current-session revocation, server permissions, device verification,
  CAPTCHA, email verification and all existing translated UI remain intact.

## Validation and release boundary

Targeted behavioral/legacy validation: 61/61 passed; independent source review
found no further actionable P0-P2 issue after its findings were corrected.
Final full tests passed 1703/1703, lint and web/uploader typecheck passed.
Mandatory i18n passed for all 12 locales with no clean English fallbacks, and
37/37 client-bundle tests passed. Webpack compile/typecheck and 282-page
prerender succeeded. Untracked command logs are under
`.autopilot/runtime/auth-session-hotfix-20260919/`.

One initial build ran while the follow-up queue module was still being added
and failed to resolve that not-yet-written file. It is not counted as a passing
build. The final npm command passed compilation/prerender but exited 1 when the
postbuild validator correctly detected the shared node_modules junction escaping
the standalone directory. No validator was weakened. A separate generated
artifact copy, with the same installed dependencies physically copied instead
of linked, passed the unchanged strict checker (compiled unauthenticated 401,
PNG/PDF generation, zero external fetches). The original source/dependency links
were left intact. Any publication must rebuild from source in the release
environment and pass its standard packaging gate; the in-place npm command must
not be reported as exit 0. An intermediate TypeScript generic return mismatch
and two obsolete exact-code test patterns were corrected and rechecked.

No dependency version, environment value, database schema, migration, payment,
pricing, consent, visual layout or user-facing string changes. This turn does
not push or deploy. Production needs an explicit owner release instruction;
then deploy only this scoped candidate, retain the current image for rollback,
and verify authenticated login persistence on the affected computer. Local
tests and the healthy existing browser session do not substitute for that check.
