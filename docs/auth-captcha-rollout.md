# Supabase Auth CAPTCHA rollout

## Current release state

Supabase Auth CAPTCHA must remain **disabled** in Production until the web
release and CAPTCHA-capable Windows uploader `0.2.1` have both been published,
the server minimum desktop version is enforced at `0.2.1`, the Cloudflare
hostname is verified, and the release readiness gate passes. This repository
change does not enable or configure the remote Supabase toggle.

With `NEXT_PUBLIC_AUTH_CAPTCHA_MODE` and `VITE_AUTH_CAPTCHA_MODE` absent or set
to `off`, existing password flows keep their previous behavior. An explicit
`required` mode with missing/invalid configuration fails closed instead of
sending an auth request that cannot satisfy the project-wide CAPTCHA policy.

## Active Auth flow inventory

| Client and flow | Supabase call | CAPTCHA behavior |
| --- | --- | --- |
| Web password login | `signInWithPassword` | Cloudflare token is passed in `options.captchaToken` |
| Web e-mail registration | `signUp` | Cloudflare token is passed; token is consumed after the attempt |
| Web verification resend | `resend` | Requires a newly solved token; the signup token is never reused |
| Web recovery request | `resetPasswordForEmail` | Cloudflare token protects reset-link issuance |
| Web password update | `updateUser({ password })` | Uses the authenticated recovery session; no unsupported CAPTCHA option is added |
| Web Google OAuth login/register | `signInWithOAuth` | Not changed; the SDK OAuth options do not use this password-flow token |
| Windows uploader password login | `signInWithPassword` | Gets a fresh token from the hosted HTTPS challenge, then passes it in `options.captchaToken` |

The shared web password login uses Cloudflare Managed Turnstile with
`appearance: interaction-only`. The challenge runs for every protected fresh
password attempt, but most legitimate visitors do not see a widget. Cloudflare
can surface an interactive challenge whenever its risk checks require one.

As an additional user-experience escalation, the web client keeps only a
PII-free count and timestamp in same-origin browser storage. Five consecutive
`invalid_credentials` results inside fifteen minutes switch the widget to
`appearance: always`; a successful login or an expired window clears the
count. Network, provider and unconfirmed-email errors do not increment it.
This counter is intentionally not described as the security boundary: clearing
browser storage or changing clients can bypass it, while the project-wide
Supabase token validation still applies to every protected password attempt.

Supabase documents CAPTCHA protection as project-wide for sign-in, sign-up and
password reset. Refresh-token grants are exempt, so existing web sessions can
refresh normally. The uploader intentionally does not persist sessions, which
is why every new desktop login must be CAPTCHA-capable before the remote toggle
is enabled.

## Electron security contract

Cloudflare Turnstile does not support `file://`. The uploader therefore opens
`https://file.mgautotech.de/desktop-auth/turnstile` in a separate sandboxed
Electron `BrowserWindow` with a narrow preload.

- The main process accepts a challenge request only from the exact primary
  renderer and its main frame.
- Production challenge origin and path are exact; alternate hosts, ports,
  credentials, queries and initial fragments are rejected.
- A random 32-byte state is placed in the URL fragment. The token is never put
  in a URL, storage, history or log.
- Completion must come from the exact challenge `webContents`, main frame,
  origin/path and one-use state.
- Tokens are trimmed, limited to 2,048 characters and accepted once. The
  challenge expires after 270 seconds, below Turnstile's five-minute token
  lifetime.
- Top-level navigation, new windows and Electron permission requests are
  denied. Requester/navigation listeners are removed when a challenge settles.
- The token goes directly to Supabase Auth. It is not pre-validated with
  Siteverify because Turnstile tokens are single-use and Supabase is the server
  validator when its CAPTCHA protection is enabled.

## Public configuration

Web deployment:

```text
NEXT_PUBLIC_AUTH_CAPTCHA_MODE=off|required
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<public Cloudflare site key>
```

Preview may explicitly set
`NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY=true` with an official Cloudflare test
site key. Production readiness rejects both that allowance and all known test
site keys.

Desktop build:

```text
VITE_APP_VERSION=0.2.1
VITE_AUTH_CAPTCHA_MODE=off|required
VITE_AUTH_CAPTCHA_CHALLENGE_URL=https://file.mgautotech.de/desktop-auth/turnstile
```

Only the public site key is client-visible. The Turnstile secret belongs in
Cloudflare/Supabase provider configuration and must never be placed in a
`NEXT_PUBLIC_*`, `VITE_*`, repository or desktop value.

## Mandatory activation sequence

1. Create/configure the Turnstile widget for the exact
   `file.mgautotech.de` hostname. Use official test keys only in isolated
   Preview/staging.
2. Validate web login, signup, verification resend and password recovery with
   `required` client mode while Production Supabase CAPTCHA remains off.
3. Build, sign, publish and clean-install uploader `0.2.1`; validate its hosted
   challenge and fresh password login. Older `0.2.0` binaries do not contain the
   CAPTCHA bridge.
4. Set the server latest version to `0.2.1`, verify the update URL, then set the
   minimum version to `0.2.1`. Confirm `0.2.0` receives `update_required` before
   login and `0.2.1` remains allowed.
5. Complete isolated staging end-to-end validation with Supabase CAPTCHA on.
   Confirm valid tokens succeed, missing/reused/expired tokens fail, and web
   plus desktop each obtain a new token per attempt.
6. Record the four release receipts and run:

   ```bash
   npm run check:auth-captcha:release
   ```

   The gate also requires web/desktop `required` modes, the non-test site key,
   exact desktop URL, uploader/server version `0.2.1`, and the source contracts.
7. Only after a separately authorized Production action, enable Supabase Auth
   CAPTCHA. Immediately smoke-test fresh web and desktop password login. If
   either fails, turn the remote CAPTCHA toggle off first.

For a no-secret contract report, run
`node scripts/check-auth-captcha-readiness.mjs --schema-only`. It does not read
`.env` files.

## Adaptive five-failure experience and hosted rate-limit boundary

Supabase's hosted password token endpoint currently uses an IP-based limit of
1,800 requests per hour with a burst allowance up to 30, and that password
limit is not customizable. The dashboard's `10 per 5 minutes` Auth setting is
still useful for signup, resend, magic-link and OTP traffic, but it does not
turn password guessing into a strict ten-attempt limit. A browser/session
browser/session-only counter would also be easy to clear or bypass by calling the public
Supabase endpoint directly, so no fake password security limit was added.

Turnstile materially reduces automated guessing because every protected fresh
attempt needs a valid, short-lived, single-use challenge token. The visible
widget is forced after five consecutive credential failures in the same
browser, but that local escalation is not a global five-attempt lock. A strict
server-enforced limit of exactly five would require moving password exchange
behind an owned, non-bypassable auth gateway/proxy and is a separate
architecture/security review.

## Official references

- [Supabase CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Cloudflare Turnstile explicit rendering and token lifetime](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
- [Cloudflare Turnstile appearance modes](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/)
- [Cloudflare hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)
- [Cloudflare test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
