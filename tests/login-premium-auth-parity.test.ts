import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { resolveGoogleIdentityConfig } from "../src/lib/googleIdentity";

const loginPage = readFileSync(
  resolve(process.cwd(), "src", "app", "login", "page.tsx"),
  "utf8"
);
const registerPage = readFileSync(
  resolve(process.cwd(), "src", "app", "register", "page.tsx"),
  "utf8"
);
const authCaptcha = readFileSync(
  resolve(process.cwd(), "src", "lib", "authCaptcha.ts"),
  "utf8"
);
const googleIdentity = readFileSync(
  resolve(process.cwd(), "src", "lib", "googleIdentity.ts"),
  "utf8"
);
const googleIdentityButton = readFileSync(
  resolve(
    process.cwd(),
    "src",
    "components",
    "auth",
    "GoogleIdentityButton.tsx"
  ),
  "utf8"
);
const turnstileChallenge = readFileSync(
  resolve(
    process.cwd(),
    "src",
    "components",
    "auth",
    "TurnstileChallenge.tsx"
  ),
  "utf8"
);

test("login uses one focused premium card instead of a marketing split screen", () => {
  assert.match(loginPage, /overflow-x-hidden/);
  assert.doesNotMatch(loginPage, /<main className="[^"]*overflow-hidden[^"]*"/);
  assert.match(loginPage, /max-w-\[560px\]/);
  assert.match(loginPage, /max-w-\[440px\]/);
  assert.equal(loginPage.match(/<h1\b/g)?.length, 1);
  assert.match(loginPage, /<h1[^>]*>Login<\/h1>/);
  assert.match(loginPage, /<header[^>]*>[\s\S]*?Secure customer access[\s\S]*?<\/header>/);

  assert.doesNotMatch(loginPage, /lg:grid-cols-\[1\.1fr_0\.9fr\]/);
  assert.doesNotMatch(loginPage, /min-h-\[620px\]/);
  assert.doesNotMatch(loginPage, /Professional ECU file service starts here/);
  assert.doesNotMatch(loginPage, /Vehicle Intelligence/);
  assert.doesNotMatch(loginPage, /Fast File Workflow/);
  assert.doesNotMatch(loginPage, /\bCpu\b|\bZap\b/);
});

test("premium login keeps accessible account entry controls", () => {
  assert.match(loginPage, /id="login-email"[\s\S]*?name="email"[\s\S]*?autoComplete="email"/);
  assert.match(loginPage, /id="login-password"[\s\S]*?name="password"[\s\S]*?autoComplete="current-password"/);
  assert.match(loginPage, /type="submit"[\s\S]*?Logging in\.\.\./);
  assert.match(loginPage, /h-12 w-full rounded-xl/);
  assert.match(loginPage, /href="\/forgot-password"/);
  assert.match(
    loginPage,
    /href=\{buildAuthEntryPath\("\/register", requestedRedirectPath\)\}/
  );
  assert.match(loginPage, /role=\{messageIsSuccess \? "status" : "alert"\}/);
  assert.match(loginPage, /aria-live=\{messageIsSuccess \? "polite" : "assertive"\}/);
  assert.match(loginPage, /focus-visible:ring/);
});

test("login redesign preserves adaptive Turnstile and request locking", () => {
  assert.match(loginPage, /if \(loading \|\| authRequestInFlightRef\.current\) return/);
  assert.match(loginPage, /getAuthCaptchaToken\([\s\S]*?authCaptchaConfig,[\s\S]*?captchaToken/);
  assert.match(loginPage, /signInWithPassword\([\s\S]*?captchaToken: requestCaptchaToken/);
  assert.match(loginPage, /setCaptchaToken\(null\)/);
  assert.match(loginPage, /setCaptchaResetKey\(\(value\) => value \+ 1\)/);
  assert.match(loginPage, /recordAuthLoginFailure/);
  assert.match(loginPage, /clearAuthLoginFailures/);
  assert.match(loginPage, /visibleCaptchaRequired/);
  assert.match(loginPage, /action="auth_login"/);
  assert.match(
    loginPage,
    /appearance=\{visibleCaptchaRequired \? "always" : "interaction-only"\}/
  );
  assert.match(loginPage, /authCaptchaBlocksSubmission\(authCaptchaConfig, captchaToken\)/);
  assert.match(loginPage, /captchaEscalationNoticeRef[\s\S]*?role="alert"[\s\S]*?tabIndex=\{-1\}/);
});

test("Google login and registration use locked CAPTCHA-backed ID-token flows", () => {
  const loginGoogleHandler = loginPage.match(
    /const handleGoogleLogin = async \(credential: string, nonce: string\) => \{[\s\S]*?\n  \};/
  )?.[0];
  const registerGoogleHandler = registerPage.match(
    /const handleGoogleRegister = async \(credential: string, nonce: string\) => \{[\s\S]*?\n  \};/
  )?.[0];

  assert.ok(loginGoogleHandler);
  assert.ok(registerGoogleHandler);
  assert.match(loginGoogleHandler, /authRequestInFlightRef\.current = true/);
  assert.match(registerGoogleHandler, /authRequestInFlightRef\.current = true/);
  assert.match(loginGoogleHandler, /\.catch\(\(\) => null\)/);
  assert.match(registerGoogleHandler, /\.catch\(\(\) => null\)/);
  assert.match(
    registerGoogleHandler,
    /Promise\.resolve\(\)[\s\S]*?\.then\(\(\) => \{[\s\S]*?sessionStorage\.setItem[\s\S]*?signInWithIdToken/
  );
  assert.match(loginGoogleHandler, /signInWithIdToken/);
  assert.match(loginGoogleHandler, /token: credential/);
  assert.match(loginGoogleHandler, /nonce/);
  assert.match(loginGoogleHandler, /options: \{ captchaToken: requestCaptchaToken \}/);
  assert.match(registerGoogleHandler, /token: credential/);
  assert.match(registerGoogleHandler, /nonce/);
  assert.match(registerGoogleHandler, /options: \{ captchaToken: requestCaptchaToken \}/);
  assert.doesNotMatch(registerGoogleHandler, /signInWithOAuth/);
  assert.doesNotMatch(loginGoogleHandler, /signInWithOAuth/);
  assert.doesNotMatch(loginPage, /signInWithOAuth/);
  assert.doesNotMatch(registerPage, /signInWithOAuth/);
  assert.match(loginGoogleHandler, /authRequestInFlightRef\.current = false/);
  assert.match(registerGoogleHandler, /authRequestInFlightRef\.current = false/);
  for (const page of [loginPage, registerPage]) {
    assert.match(
      page,
      /onReady=\{\(\) =>[\s\S]*?current\.startsWith\(\s*"Google sign-in could not be loaded"\s*\)[\s\S]*?\? ""[\s\S]*?: current/
    );
    assert.doesNotMatch(page, /onReady=\{\(\) => setGoogleMessage\(""\)\}/);
  }
});

test("registration stays fail-closed behind separate managed challenges", () => {
  const registerChallenges = [
    ...registerPage.matchAll(/<TurnstileChallenge[\s\S]*?\/>/g),
  ].map((match) => match[0]);
  const googleChallenge = registerChallenges.find((challenge) =>
    challenge.includes('action="auth_register_google"')
  );
  const emailChallenge = registerChallenges.find((challenge) =>
    challenge.includes('action="auth_register"')
  );

  assert.ok(googleChallenge);
  assert.ok(emailChallenge);
  for (const challenge of [googleChallenge, emailChallenge]) {
    assert.match(challenge, /siteKey=\{authCaptchaConfig\.siteKey\}/);
    assert.match(challenge, /resetKey=\{captchaResetKey\}/);
    assert.match(challenge, /onToken=\{setCaptchaToken\}/);
    assert.match(challenge, /appearance="interaction-only"/);
    assert.doesNotMatch(challenge, /auth_login/);
  }

  assert.match(registerPage, /getAuthCaptchaToken\([\s\S]*?signUp\(/);
  assert.match(registerPage, /signUp\([\s\S]*?captchaToken: requestCaptchaToken/);
  assert.match(registerPage, /getAuthCaptchaToken\([\s\S]*?resend\(/);
  assert.match(registerPage, /resend\([\s\S]*?captchaToken: requestCaptchaToken/);
  assert.ok(
    (registerPage.match(/authCaptchaBlocksSubmission\(/g)?.length ?? 0) >= 2
  );
  assert.ok((registerPage.match(/setCaptchaToken\(null\)/g)?.length ?? 0) >= 2);
  assert.ok(
    (registerPage.match(/setCaptchaResetKey\(\(value\) => value \+ 1\)/g)
      ?.length ?? 0) >= 2
  );
  assert.match(
    registerPage,
    /authCaptchaConfig\.status === "misconfigured"[\s\S]*?role="alert"[\s\S]*?authCaptchaConfig\.message/
  );
  assert.match(registerPage, /authRequestInFlightRef/);
});

test("Google Identity registration uses an official nonce-bound button", () => {
  const productionMissing = resolveGoogleIdentityConfig({
    nodeEnv: "production",
  });
  const productionInvalid = resolveGoogleIdentityConfig({
    clientId: "not-a-google-client",
    nodeEnv: "production",
  });
  const productionReady = resolveGoogleIdentityConfig({
    clientId:
      "123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com",
    nodeEnv: "production",
  });

  assert.equal(productionMissing.status, "misconfigured");
  assert.equal(productionInvalid.status, "misconfigured");
  assert.equal(productionReady.status, "ready");
  assert.match(
    googleIdentity,
    /Google sign-in is temporarily unavailable\. You can continue with e-mail\./
  );
  assert.match(googleIdentity, /NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
  assert.match(googleIdentityButton, /accounts\.google\.com\/gsi\/client/);
  assert.match(googleIdentityButton, /crypto\.getRandomValues/);
  assert.match(googleIdentityButton, /crypto\.subtle\.digest/);
  assert.match(googleIdentityButton, /nonce: hashedNonce/);
  assert.match(googleIdentityButton, /renderButton/);
  assert.match(googleIdentityButton, /let renderedWidth: number \| null = null/);
  assert.match(googleIdentityButton, /if \(!force && width === renderedWidth\) return/);
  assert.match(googleIdentityButton, /if \(getButtonWidth\(\) === renderedWidth\) return/);
  assert.match(googleIdentityButton, /resizeObserver\.observe\(wrapper\)/);
  assert.doesNotMatch(googleIdentityButton, /resizeObserver\.observe\(container\)/);
  assert.match(googleIdentityButton, /className="relative flex h-12 w-full/);
  assert.match(googleIdentityButton, /flex h-10 w-full justify-center/);
  assert.match(googleIdentityButton, /googleIdentityScriptPromise/);
  assert.match(googleIdentityButton, /script\?\.remove\(\)/);
  assert.match(googleIdentityButton, /window\.setTimeout\(fail, 10_000\)/);
  assert.match(googleIdentityButton, /if \(!active\) return/);
  assert.match(googleIdentityButton, /role="status"/);
  assert.match(googleIdentityButton, /aria-busy/);
  assert.match(googleIdentityButton, /Retry Google sign-in/);
  assert.match(googleIdentityButton, /focusAfterRetryRef/);
  assert.match(googleIdentityButton, /querySelector<HTMLIFrameElement>\("iframe"\)/);
  assert.doesNotMatch(googleIdentityButton, /dangerouslySetInnerHTML/);
});

test("Turnstile uses responsive official sizes without clipping narrow screens", () => {
  assert.match(turnstileChallenge, /type TurnstileSize = "compact" \| "flexible"/);
  assert.match(
    turnstileChallenge,
    /getBoundingClientRect\(\)\.width < 324[\s\S]*?"compact"[\s\S]*?"flexible"/
  );
  assert.match(turnstileChallenge, /size: widgetSize/);
  assert.match(turnstileChallenge, /new ResizeObserver\(updateSize\)/);
  assert.match(turnstileChallenge, /w-full min-w-0/);
  assert.doesNotMatch(
    turnstileChallenge,
    /showChallengeChrome \? "min-h-\[65px\] overflow-hidden"/
  );
});

test("Production cannot disable CAPTCHA or opt into public test keys", () => {
  assert.match(authCaptcha, /const production = environment\.nodeEnv === "production"/);
  assert.match(authCaptcha, /if \(!mode \|\| mode === "off"\)[\s\S]*?if \(production\)[\s\S]*?status: "misconfigured"/);
  assert.match(authCaptcha, /if \(production && isTurnstileTestSiteKey\(siteKey\)\)/);
  assert.doesNotMatch(authCaptcha, /AUTH_CAPTCHA_ALLOW_TEST_KEY|allowTestKey/);
});
