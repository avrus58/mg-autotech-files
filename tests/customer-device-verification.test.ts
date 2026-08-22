import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  CUSTOMER_DEVICE_CODE_LENGTH,
  CUSTOMER_DEVICE_COOKIE_NAME,
  CUSTOMER_DEVICE_MAX_ATTEMPTS,
  CUSTOMER_DEVICE_RESEND_SECONDS,
  CUSTOMER_DEVICE_TRUST_DAYS,
  CustomerDeviceSecurityUnavailableError,
  customerDeviceHashesEqual,
  describeCustomerDevice,
  extractSessionIdFromAccessToken,
  generateCustomerDeviceCode,
  generateCustomerDeviceToken,
  getCustomerDeviceCookieOptions,
  getCustomerDeviceCookieDeletionOptions,
  hashCustomerDeviceCode,
  hashCustomerDeviceToken,
  maskCustomerEmail,
  readCustomerDeviceCookie,
} from "../src/lib/customerDeviceSecurity";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

const hmacEnvironment = {
  CUSTOMER_DEVICE_HMAC_SECRET: "test-only-customer-device-secret-32-bytes-minimum",
};

test("trusted-device tokens and codes are random, domain-separated HMAC values", () => {
  const token = generateCustomerDeviceToken();
  const otherToken = generateCustomerDeviceToken();
  assert.notEqual(token, otherToken);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);

  const tokenHash = hashCustomerDeviceToken(token, hmacEnvironment);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(tokenHash.includes(token), false);
  assert.equal(customerDeviceHashesEqual(tokenHash, tokenHash), true);
  assert.equal(
    customerDeviceHashesEqual(tokenHash, hashCustomerDeviceToken(otherToken, hmacEnvironment)),
    false
  );

  const userId = "9c5f9e43-049c-43c5-839a-63144c119a2a";
  const sessionId = "6d43cc5a-6eb0-4a15-94fa-31abdbf41f4c";
  const challengeId = "25f16558-33b7-401e-ad2f-8b3ee257ae90";
  const codeHash = hashCustomerDeviceCode(
    userId,
    sessionId,
    challengeId,
    "123456",
    hmacEnvironment
  );
  assert.match(codeHash, /^[a-f0-9]{64}$/);
  assert.notEqual(codeHash, hashCustomerDeviceToken("123456", hmacEnvironment));
  assert.notEqual(
    codeHash,
    hashCustomerDeviceCode(userId, sessionId, challengeId, "123457", hmacEnvironment)
  );

  for (let index = 0; index < 50; index += 1) {
    assert.match(generateCustomerDeviceCode(), /^\d{6}$/);
  }
  assert.equal(CUSTOMER_DEVICE_CODE_LENGTH, 6);
  assert.equal(CUSTOMER_DEVICE_MAX_ATTEMPTS, 5);
  assert.equal(CUSTOMER_DEVICE_RESEND_SECONDS, 60);
  assert.equal(CUSTOMER_DEVICE_TRUST_DAYS, 30);
  assert.throws(
    () => hashCustomerDeviceToken("valid_but_unkeyed_token", {}),
    CustomerDeviceSecurityUnavailableError
  );
  assert.throws(
    () => hashCustomerDeviceToken("valid_but_weakly_keyed_token", {
      CUSTOMER_DEVICE_HMAC_SECRET: "too-short",
    }),
    CustomerDeviceSecurityUnavailableError
  );
});

test("trusted-device cookie is host-only, secure and never browser-readable", () => {
  const verifyRoute = readProjectFile(
    "src",
    "app",
    "api",
    "auth",
    "device-verification",
    "verify",
    "route.ts"
  );
  assert.equal(CUSTOMER_DEVICE_COOKIE_NAME.startsWith("__Host-"), true);
  assert.deepEqual(getCustomerDeviceCookieOptions(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  assert.deepEqual(getCustomerDeviceCookieDeletionOptions(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  assert.equal(
    readCustomerDeviceCookie(`a=b; ${CUSTOMER_DEVICE_COOKIE_NAME}=valid_token-value_12345678901234567890`),
    "valid_token-value_12345678901234567890"
  );
  assert.equal(
    readCustomerDeviceCookie(`${CUSTOMER_DEVICE_COOKIE_NAME}=unsafe value`),
    null
  );
  assert.match(verifyRoute, /const \{ trustedDeviceToken, \.\.\.publicResult \} = result/);
  assert.match(verifyRoute, /NextResponse\.json\(publicResult/);
  assert.doesNotMatch(verifyRoute, /NextResponse\.json\(result/);
});

test("session and display helpers expose only bounded, coarse information", () => {
  const sessionId = "6d43cc5a-6eb0-4a15-94fa-31abdbf41f4c";
  const payload = Buffer.from(JSON.stringify({ session_id: sessionId })).toString("base64url");
  assert.equal(extractSessionIdFromAccessToken(`header.${payload}.signature`), sessionId);
  assert.equal(extractSessionIdFromAccessToken("not-a-jwt"), null);
  assert.equal(maskCustomerEmail("customer@example.com"), "cu******@example.com");
  assert.equal(maskCustomerEmail(null), "your registered e-mail");
  assert.equal(
    describeCustomerDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/140.0"),
    "Chrome on Windows"
  );
});

test("database migration installs a shadow-first, server-enforced assurance boundary", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260823000000_customer_device_verification.sql"
  );

  assert.match(migration, /mode text not null default 'shadow'/);
  assert.match(migration, /values \(true, 'shadow'\)/);
  assert.match(migration, /create or replace function app_private\.current_customer_session_assured\(\)/);
  assert.match(migration, /stable\s+security definer\s+set search_path = ''/);
  assert.match(migration, /auth\.jwt\(\) ->> 'session_id'/);
  assert.match(migration, /from auth\.sessions as session/);
  assert.match(migration, /session\.id = v_session_id\s+and session\.user_id = v_user_id/);
  assert.match(migration, /mode = 'enforced'/);
  assert.match(migration, /p_legacy_grace_hours integer default 24/);
  assert.match(migration, /p_legacy_grace_hours not between 0 and 48/);
  assert.match(migration, /perform app_private\.assert_customer_device_assurance_ready\(\)/);
  assert.match(migration, /if v_mode = 'enforced' then[\s\S]*'unchanged', true/);
  assert.match(migration, /force_email_verification boolean not null default false/);

  const helper = migration.slice(
    migration.indexOf("create or replace function app_private.current_customer_session_assured"),
    migration.indexOf("create or replace function public.get_customer_session_assurance_state")
  );
  assert.ok(
    helper.indexOf("v_state = 'revoked'") < helper.indexOf("v_mode = 'shadow'"),
    "explicit revocation must win over shadow fallback"
  );
  assert.ok(
    (helper.match(/v_state = 'pending'[\s\S]{0,20}coalesce\(v_force_email_verification, false\)/g) ?? [])
      .length >= 2 &&
      helper.lastIndexOf("v_state = 'pending' and coalesce(v_force_email_verification, false)") <
        helper.lastIndexOf("v_legacy_grace_until is not null"),
    "forced password verification must win over both shadow fallback and legacy-session grace"
  );

  const stateRpc = migration.slice(
    migration.indexOf("create or replace function public.get_customer_session_assurance_state"),
    migration.indexOf("create or replace function public.prepare_customer_password_change_verification")
  );
  assert.ok(
    (stateRpc.match(/v_state = 'pending'[\s\S]{0,20}coalesce\(v_force_email_verification, false\)/g) ?? [])
      .length >= 2 &&
      stateRpc.lastIndexOf("v_state = 'pending' and coalesce(v_force_email_verification, false)") <
        stateRpc.lastIndexOf("v_legacy_grace_until is not null"),
    "the state RPC must report forced password verification before legacy-session grace"
  );

  for (const table of [
    "customer_auth_assurance_config",
    "customer_trusted_devices",
    "customer_session_assurance",
    "customer_device_email_challenges",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all privileges on table public\\.${table}`));
  }
  assert.match(migration, /as restrictive for select to authenticated/);
  assert.match(migration, /as restrictive for update to authenticated/);
  assert.match(migration, /on storage\.objects as restrictive for select to authenticated/);
  assert.match(migration, /bucket_id not in \('customer-files', 'file-expert'\)/);
});

test("challenge lifecycle is single-use, rate-limited and preserves an old code until replacement delivery", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260823000000_customer_device_verification.sql"
  );
  const reserveStart = migration.indexOf("create or replace function public.reserve_customer_device_challenge");
  const markStart = migration.indexOf("create or replace function public.mark_customer_device_challenge_sent");
  const consumeStart = migration.indexOf("create or replace function public.consume_customer_device_challenge");
  const revokeStart = migration.indexOf("create or replace function public.revoke_customer_trusted_device");
  const reserve = migration.slice(reserveStart, markStart);
  const markSent = migration.slice(markStart, consumeStart);
  const consume = migration.slice(consumeStart, revokeStart);

  assert.match(migration, /max_attempts smallint not null default 5 check \(max_attempts = 5\)/);
  assert.match(reserve, /60 - pg_catalog\.floor/);
  assert.match(reserve, /v_now \+ interval '10 minutes'/);
  assert.match(reserve, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(reserve, /v_recent_count >= 3/);
  assert.match(reserve, /v_daily_count >= 12/);
  assert.doesNotMatch(reserve, /invalidated_reason = 'resend'/);
  assert.match(markSent, /invalidated_reason = 'resend_replaced'/);
  assert.match(markSent, /delivery_state = 'sent'/);
  assert.match(consume, /v_challenge\.delivery_state <> 'sent'/);
  assert.match(consume, /attempt_count = v_attempts/);
  assert.match(consume, /set consumed_at = v_now/);
  assert.match(consume, /v_now \+ interval '30 days'/);
  assert.match(migration, /customer_device_challenge_one_prepared_session_idx/);
  assert.match(migration, /customer_device_challenge_one_sent_session_idx/);
  assert.ok((migration.match(/pg_advisory_xact_lock/g) ?? []).length >= 7);
  assert.match(consume, /pg_advisory_xact_lock[\s\S]*insert into public\.customer_trusted_devices/);
});

test("service RPCs, Data API, Storage and order RPCs cannot bypass pending assurance", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260823000000_customer_device_verification.sql"
  );
  assert.match(migration, /revoke all privileges on function %s from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function %s to service_role/);
  assert.match(migration, /rename to create_order_with_credit_deduction_without_assurance/);
  assert.match(migration, /rename to create_web_order_with_credit_deduction_without_assurance/);
  assert.match(migration, /rename to create_desktop_order_with_credit_deduction_without_assurance/);
  assert.equal((migration.match(/Device verification is required\./g) ?? []).length, 3);
  assert.doesNotMatch(migration, /\b(?:ip_address|raw_ip|user_agent|fingerprint)\b/i);
  assert.doesNotMatch(migration, /\baal2\b/i);
});

test("application guards separate bootstrap identity from verified customer access", () => {
  const apiAuth = readProjectFile("src", "lib", "apiAuth.ts");
  const authGuards = readProjectFile("src", "lib", "authGuards.ts");
  const fileExpert = readProjectFile("src", "lib", "fileExpert", "server.ts");

  assert.match(apiAuth, /export async function requireBaseApiUser/);
  assert.match(apiAuth, /export async function requireApiUser/);
  assert.match(apiAuth, /if \(!auth\.ok \|\| isStaffMember\(auth\.access\)\) return auth/);
  assert.match(apiAuth, /status: 428/);
  assert.match(apiAuth, /CUSTOMER_DEVICE_VERIFICATION_REQUIRED_CODE/);
  assert.match(authGuards, /if \(response\.status === 428\)/);
  assert.match(authGuards, /notifyDeviceVerificationRequired\(\)/);
  assert.match(fileExpert, /requireFileExpertUser\(request: Request\)[\s\S]*requireApiUser\(request\)/);

  for (const route of [
    ["src", "app", "api", "auth", "device-verification", "start", "route.ts"],
    ["src", "app", "api", "auth", "device-verification", "verify", "route.ts"],
    ["src", "app", "api", "auth", "device-verification", "resend", "route.ts"],
  ]) {
    assert.match(readProjectFile(...route), /requireBaseApiUser\(request\)/);
  }
});

test("login, OAuth bootstrap and protected layouts all stop at device verification", () => {
  const login = readProjectFile("src", "app", "login", "page.tsx");
  const callback = readProjectFile("src", "app", "auth", "callback", "page.tsx");
  const boundary = readProjectFile("src", "components", "auth", "BrowserAuthBoundary.tsx");
  const panel = readProjectFile("src", "components", "auth", "DeviceVerificationPanel.tsx");

  assert.match(login, /<DeviceVerificationPanel[\s\S]*nextPath=\{deviceVerificationNextPath\}/);
  assert.match(callback, /await startDeviceVerification\(\)/);
  assert.match(callback, /startPasswordChangeVerification\(\)/);
  assert.ok(
    callback.indexOf('/api/auth/oauth-registration/finalize') <
      callback.indexOf("await startDeviceVerification()"),
    "the allowlisted OAuth bootstrap must finish before the assurance gate"
  );
  assert.match(
    callback,
    /supabase\.auth\.updateUser\(\{[\s\S]*buildPendingRegistrationCountryMetadata/
  );
  assert.doesNotMatch(callback, /\.from\("profiles"\)[\s\S]*\.update/);
  assert.match(boundary, /assurance\.status === "required"/);
  assert.match(boundary, /authState === "verification_required"/);
  assert.match(panel, /useState\(false\)/);
  assert.match(panel, /allowRememberDevice && rememberDevice/);
  assert.match(panel, /autoComplete="one-time-code"/);
  assert.match(panel, /Trust this device for 30 days/);
  assert.match(panel, /Use a different account/);
  assert.match(panel, /aria-live="polite"/);
});

test("device e-mail must be actually accepted by Resend and never logs the code", () => {
  const security = readProjectFile("src", "lib", "customerDeviceSecurity.ts");
  assert.match(security, /delivery\.status === "sent" &&\s*delivery\.provider === "resend" &&\s*Boolean\(delivery\.messageId\?\.trim\(\)\)/);
  assert.match(security, /code_logged: false/);
  assert.match(security, /device_token_logged: false/);
  assert.doesNotMatch(security, /metadata:\s*\{[\s\S]{0,300}verificationCode/);
});

test("password changes require assurance, enforce strong passwords and revoke device trust", () => {
  const resetPage = readProjectFile("src", "app", "reset-password", "page.tsx");
  const passwordRoute = readProjectFile(
    "src",
    "app",
    "api",
    "account",
    "security",
    "password",
    "route.ts"
  );
  const adminPasswordRoute = readProjectFile(
    "src",
    "app",
    "api",
    "admin",
    "customers",
    "[id]",
    "password",
    "route.ts"
  );

  assert.match(resetPage, /validateCustomerReplacementPassword\(password\)/);
  assert.match(resetPage, /\/api\/account\/security\/password/);
  assert.doesNotMatch(resetPage, /supabase\.auth\.updateUser\(\{ password/);
  assert.match(passwordRoute, /requireApiUser\(request\)/);
  assert.match(passwordRoute, /hasRecentCustomerPasswordChangeVerification/);
  assert.match(passwordRoute, /validateCustomerReplacementPassword/);
  assert.ok(
    passwordRoute.indexOf("revokeAllCustomerDeviceTrust") <
      passwordRoute.indexOf("admin.auth.admin.updateUserById"),
    "trust must be revoked before the credential mutation"
  );
  assert.match(adminPasswordRoute, /revokeAllCustomerDeviceTrust/);

  const passwordStartRoute = readProjectFile(
    "src",
    "app",
    "api",
    "auth",
    "device-verification",
    "password-change",
    "start",
    "route.ts"
  );
  assert.match(passwordStartRoute, /prepareCustomerPasswordChangeVerification/);
  assert.match(passwordStartRoute, /cookieToken: null/);
  assert.match(passwordStartRoute, /status: preparation/);
});

test("legacy desktop clients fail closed when the web device gate is active", () => {
  const desktopApi = readProjectFile("apps", "customer-uploader", "src", "api.ts");
  assert.match(desktopApi, /response\.status === 428/);
  assert.match(desktopApi, /cannot complete the required new-device verification/);
  assert.match(desktopApi, /if \(!response\.ok\) throw desktopApiError\(response, data\)/);
});

test("rollout documentation states the Supabase Auth-layer boundary", () => {
  const runbook = readProjectFile("docs", "customer-device-verification-rollout.md");
  assert.match(runbook, /not Supabase native MFA/);
  assert.match(runbook, /does not raise the JWT to AAL2/);
  assert.match(runbook, /Secure Password Change/);
  assert.match(runbook, /apply[\s\S]{0,30}the migration[\s\S]*Only then[\s\S]*deploy the matching application/);
  assert.ok(
    runbook.indexOf("still `shadow`") <
      runbook.indexOf("activate_customer_device_assurance(0)") &&
      runbook.indexOf("activate_customer_device_assurance(0)") <
        runbook.indexOf("fresh post-activation password"),
    "staging must prove shadow compatibility before activation and test new-device behavior only after activation"
  );
  assert.match(runbook, /rollback application must be the immediately prior[\s\S]*755decc/);
  assert.match(runbook, /Never roll back[\s\S]*legacy base RPC/);
});
