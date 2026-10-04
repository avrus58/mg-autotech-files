import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  authCaptchaBlocksSubmission,
  getAuthCaptchaToken,
  type AuthCaptchaConfig,
} from "../src/lib/authCaptcha";
import { authPageFirstPaintT } from "../src/lib/i18n/auth-page-first-paint";
import { customerAuthFeedbackT } from "../src/lib/i18n/customer-auth-feedback";
import { customerRuntimeExactT } from "../src/lib/i18n/customer-runtime-translations";
import {
  customerWorkflowExactT,
  customerWorkflowT,
} from "../src/lib/i18n/customer-workflow-auth-translations";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { resolveBrowserTransactionalEmailLanguage } from "../src/lib/email/language";

type Element = { type: unknown; props: Record<string, unknown> };
type ResendReply = { error: { message: string } | null };

const source = readFileSync("src/app/register/page.tsx", "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const page = ast.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "RegisterPage");
assert.ok(page?.body);
const stateNames = page.body.statements.flatMap(node =>
  ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []
).filter(node => node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === "useState")
  .map(node => {
    assert.ok(ts.isArrayBindingPattern(node.name));
    const binding = node.name.elements[0];
    assert.ok(ts.isBindingElement(binding));
    return binding.name.getText(ast);
  });
const compiledPage = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const compiledLocalePreference = ts.transpileModule(
  readFileSync("src/lib/localePreference.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

type BrowserPreferences = {
  storedLocale?: string | null;
  cookieHeader?: string;
  browserLocale?: string;
  storageDenied?: "getter" | "getItem";
  cookieDenied?: boolean;
};

function elements(tree: unknown, includeHidden = false): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, includeHidden));
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  if (!includeHidden && element.props.hidden) return [];
  return [element, ...elements(element.props.children, includeHidden)];
}

function text(tree: unknown): string {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return "";
  const element = tree as Element;
  return element.props.hidden ? "" : text(element.props.children);
}

async function settle() {
  for (let turn = 0; turn < 30; turn++) await Promise.resolve();
}

// Execute the actual RegisterPage handlers and JSX. Every SDK, storage and
// browser dependency is isolated; no environment, network, account or email.
function harness(
  locale: LocaleCode = "en",
  captchaStatus: AuthCaptchaConfig["status"] = "ready",
  preferences: BrowserPreferences = {},
) {
  let index = 0;
  const state: unknown[] = [];
  const seeded: Record<string, unknown> = {
    checkingAuth: false, step: 3, fullName: "Synthetic Tester", companyName: "Synthetic Workshop",
    email: "synthetic@example.invalid", country: "Germany", password: "synthetic-password", confirmPassword: "synthetic-password",
    captchaToken: "synthetic-initial-challenge", requestedRedirectPath: "/new-request",
  };
  let resend: () => Promise<ResendReply> = async () => ({ error: null });
  let signupError = false;
  const signups: Record<string, unknown>[] = [];
  const resends: Record<string, unknown>[] = [];
  const config: AuthCaptchaConfig = {
    status: captchaStatus, siteKey: "1x00000000000000000000AA",
    message: captchaStatus === "misconfigured" ? "Security verification is temporarily unavailable. Please try again later." : null,
  };
  const react = {
    useState(initial: unknown) {
      const slot = index++;
      if (!(slot in state)) state[slot] = stateNames[slot] in seeded ? seeded[stateNames[slot]] : initial;
      return [state[slot], (value: unknown) => {
        state[slot] = typeof value === "function" ? (value as (previous: unknown) => unknown)(state[slot]) : value;
      }];
    },
    useRef(initial: unknown) {
      const slot = index++;
      return state[slot] ?? (state[slot] = { current: initial });
    },
    useEffect() { index++; },
  };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const empty = () => undefined;
  const browser = {
    location: { search: "?redirect=%2Fnew-request" },
    localStorage: { getItem: () => {
      if (preferences.storageDenied === "getItem") throw new Error("Synthetic storage denial");
      return preferences.storedLocale === undefined ? locale : preferences.storedLocale;
    } },
    navigator: { language: preferences.browserLocale ?? locale },
  };
  if (preferences.storageDenied === "getter") {
    Object.defineProperty(browser, "localStorage", { get() { throw new Error("Synthetic storage denial"); } });
  }
  const browserDocument = { cookie: preferences.cookieHeader ?? "" };
  if (preferences.cookieDenied) {
    Object.defineProperty(browserDocument, "cookie", { get() { throw new Error("Synthetic cookie denial"); } });
  }
  const preferenceContext = {
    exports: {}, window: browser, document: browserDocument,
    require(name: string) {
      assert.equal(name, "@/lib/seo");
      return { hreflangByLocale: {} };
    },
  };
  runInNewContext(compiledLocalePreference, preferenceContext, { timeout: 1000 });
  const imports: Record<string, unknown> = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { default: "Link" },
    "next/navigation": { useRouter: () => ({ replace: empty, refresh: empty }) },
    "lucide-react": new Proxy({}, { get: (_target, name) => String(name) }),
    "@/lib/authGuards": {
      getAuthenticatedHome: async () => "/dashboard", getAuthRedirect: (value: string) => value,
      getStableSession: async () => ({ session: null }), signOutIfEmailUnverified: async () => false,
    },
    "@/lib/authCaptcha": { authCaptchaBlocksSubmission, getAuthCaptchaToken, getPublicAuthCaptchaConfig: () => config },
    "@/lib/supabaseClient": { supabase: { auth: {
      signUp: async (input: Record<string, unknown>) => {
        signups.push(input);
        return { data: { session: null, user: { id: "synthetic-account" } }, error: signupError ? { message: "synthetic signup failure" } : null };
      },
      resend: async (input: Record<string, unknown>) => { resends.push(input); return resend(); },
    } } },
    "@/lib/browserAuthMutations": { withBrowserAuthMutation: (run: () => unknown) => Promise.resolve().then(run) },
    "@/lib/customerOnboarding": { enrollCustomerGuide: () => ({}) },
    "@/lib/googleIdentity": { getPublicGoogleIdentityConfig: () => ({ status: "off" }) },
    "@/lib/email/language": { resolveBrowserTransactionalEmailLanguage },
    "@/lib/localePreference": preferenceContext.exports,
    "@/lib/countries": { normalizeCountryName: (value: string) => value || null },
    "@/lib/phoneCountries": { formatInternationalPhone: () => null },
    "@/lib/registrationHandoffClient": {}, "@/lib/registrationConversion": {},
    "@/lib/registrationProfile": {},
    "@/lib/customerPasswordSecurity": { validateCustomerReplacementPassword: () => ({ valid: true }) },
    "@/lib/safeLocalRedirect": {
      getSafeLocalRedirectPath: (value: string | null) => value,
      buildAuthCallbackPath: (value: string) => `/auth/callback?next=${encodeURIComponent(value)}`,
      buildAuthEntryPath: (value: string) => value,
    },
    "@/lib/publicAnalytics": {}, "@/lib/useActiveLocale": { useActiveLocale: () => locale },
    "@/lib/i18n/auth-page-first-paint": { authPageFirstPaintT },
    "@/lib/i18n/customer-auth-feedback": { customerAuthFeedbackT },
    "@/lib/i18n/customer-runtime-translations": { customerRuntimeExactT },
    "@/lib/i18n/customer-workflow-auth-translations": { customerWorkflowExactT, customerWorkflowT },
  };
  for (const name of ["TurnstileChallenge", "GoogleIdentityButton", "AuthBackdrop"]) {
    imports[`@/components/auth/${name}`] = { [name]: name };
  }
  imports["@/components/CountrySelect"] = { CountrySelect: "CountrySelect" };
  imports["@/components/InternationalPhoneField"] = { InternationalPhoneField: "InternationalPhoneField" };
  const context = {
    exports: {}, URLSearchParams,
    window: browser,
    document: browserDocument,
    require(name: string) { assert.ok(name in imports, `Unexpected real dependency: ${name}`); return imports[name]; },
  };
  runInNewContext(compiledPage, context, { timeout: 1000 });
  const render = () => {
    index = 0;
    return (context.exports as { default: () => Element }).default();
  };
  render();
  const get = (name: string) => state[stateNames.indexOf(name)];
  const set = (name: string, value: unknown) => { state[stateNames.indexOf(name)] = value; };
  return {
    render, get, set, config, signups, resends,
    setResend: (run: () => Promise<ResendReply>) => { resend = run; },
    failSignup: () => { signupError = true; },
    async signup() {
      const form = elements(render()).find(element => element.type === "form");
      assert.ok(form);
      await (form.props.onSubmit as (event: object) => Promise<void>)({ preventDefault() {} });
    },
    challenge() {
      const challenges = elements(render()).filter(element => element.type === "TurnstileChallenge");
      assert.equal(challenges.length, captchaStatus === "ready" ? 1 : 0);
      return challenges[0];
    },
    async retry() {
      const button = elements(render()).find(element => element.type === "button" &&
        text(element).includes(authPageFirstPaintT(locale, "Resend verification e-mail")));
      assert.ok(button, "verification recovery must remain visible");
      (button.props.onClick as () => void)();
      await settle();
    },
  };
}

for (const { code } of supportedLocales) {
  for (const denial of ["getter", "getItem", "cookie", "both"] as const) {
    test(`optional ${denial} preference denial preserves actual ${code} signup and verification recovery`, async () => {
      const browserOnly = denial === "both";
      const h = harness(code, "ready", {
        storedLocale: code,
        cookieHeader: `other=synthetic;mg_locale=${encodeURIComponent(code)}`,
        browserLocale: `${code}-synthetic`,
        storageDenied: denial === "getter" || browserOnly ? "getter" : denial === "getItem" ? "getItem" : undefined,
        cookieDenied: denial === "cookie" || browserOnly,
      });
      await h.signup();
      assert.equal(h.signups.length, 1, "optional language storage must not stop a valid signup");
      const options = h.signups[0].options as { captchaToken: string; emailRedirectTo: string; data: { email_language: string } };
      assert.equal(options.data.email_language, code);
      assert.equal(options.emailRedirectTo, "/auth/callback?next=%2Fnew-request");
      assert.equal(options.captchaToken, "synthetic-initial-challenge");
      assert.equal(h.get("success"), true);
      assert.equal(h.get("loading"), false);
      assert.equal(elements(h.render(), true).some(element => element.type === "form"), false);
      await h.retry();
      assert.equal(h.resends.length, 0, "preference recovery must not bypass a fresh CAPTCHA");
      (h.challenge().props.onToken as (token: string) => void)("synthetic-fresh-recovery-token");
      await h.retry();
      assert.equal(h.signups.length, 1, "verification retry must not create a second account");
      assert.equal(h.resends.length, 1);
      const resendOptions = h.resends[0].options as { captchaToken: string; emailRedirectTo: string };
      assert.equal(resendOptions.captchaToken, "synthetic-fresh-recovery-token");
      assert.equal(resendOptions.emailRedirectTo, options.emailRedirectTo);
      assert.equal(h.get("success"), true);
    });
  }
}

for (const preferences of [
  { storedLocale: "tr", cookieHeader: "mg_locale=de", browserLocale: "fr-FR", expected: "tr" },
  { storedLocale: null, cookieHeader: "other=synthetic;mg_locale=de", browserLocale: "fr-FR", expected: "de" },
  { storedLocale: "unsupported", cookieHeader: "mg_locale=%7A%68", browserLocale: "tr-TR", expected: "zh" },
  { storedLocale: null, cookieHeader: "other=synthetic", browserLocale: "de-DE", expected: "de" },
  { storedLocale: null, cookieHeader: "mg_locale=%broken", browserLocale: "de-DE", expected: "en" },
]) {
  test(`actual signup retains existing email-locale precedence: ${JSON.stringify(preferences)}`, async () => {
    const h = harness("en", "ready", preferences);
    await h.signup();
    assert.equal(h.signups.length, 1);
    assert.equal((h.signups[0].options as { data: { email_language: string } }).data.email_language, preferences.expected);
    assert.equal(h.get("success"), true);
  });
}

for (const failure of ["network", "api"] as const) {
  test(`created account stays in verification recovery after a resend ${failure} error`, async () => {
    const h = harness();
    await h.signup();
    assert.equal(h.signups.length, 1);
    assert.equal(h.get("success"), true);
    assert.equal(elements(h.render(), true).some(element => element.type === "form"), false);
    assert.equal(elements(h.render(), true).filter(element => element.type === "TurnstileChallenge").length, 1);
    (h.challenge().props.onToken as (token: string) => void)("synthetic-new-challenge");
    h.setResend(failure === "network"
      ? async () => { throw new Error("synthetic network failure"); }
      : async () => ({ error: { message: "synthetic API failure" } }));
    await h.retry();
    assert.equal(h.get("success"), true);
    assert.equal(h.get("verificationPending"), true);
    assert.equal(h.get("captchaToken"), null);
    assert.equal(h.get("verificationResendFailed"), true);
    assert.ok(text(h.render()).includes("Verification e-mail could not be sent. Please try again."));
    assert.ok(elements(h.render()).some(element => element.props.role === "alert"));
    assert.equal(elements(h.render(), true).some(element => element.type === "form"), false);
    h.setResend(async () => ({ error: null }));
    (h.challenge().props.onToken as (token: string) => void)("synthetic-retry-challenge");
    await h.retry();
    assert.equal(h.signups.length, 1, "retry must never create another account");
    assert.equal(h.resends.length, 2);
    assert.equal(h.get("verificationResendFailed"), false);
    assert.ok(elements(h.render()).some(element => element.props.role === "status"));
  });
}

test("resend keeps its visible challenge and loading action mounted while pending", async () => {
  const h = harness();
  await h.signup();
  let complete!: (value: ResendReply) => void;
  h.setResend(() => new Promise(resolve => { complete = resolve; }));
  (h.challenge().props.onToken as (token: string) => void)("synthetic-pending-challenge");
  await h.retry();
  assert.equal(h.get("resendingVerification"), true);
  h.challenge();
  const action = elements(h.render()).find(element => element.type === "button");
  assert.equal(action?.props.disabled, true);
  await h.retry();
  assert.equal(h.resends.length, 1, "in-flight resend must be single-use");
  complete({ error: null });
  await settle();
  assert.equal(h.get("resendingVerification"), false);
});

test("verification recovery stays fail-closed without a fresh challenge", async () => {
  const h = harness();
  await h.signup();
  await h.retry();
  assert.equal(h.resends.length, 0);
  assert.equal(h.get("success"), true);
  assert.equal(h.get("verificationResendFailed"), true);
  assert.ok(text(h.render()).includes("Security verification failed."));
  h.challenge();
});

test("misconfigured CAPTCHA has a visible recovery error and never sends", async () => {
  const h = harness();
  await h.signup();
  h.config.status = "misconfigured";
  h.config.message = "Security verification is temporarily unavailable. Please try again later.";
  assert.equal(elements(h.render()).filter(element => element.type === "TurnstileChallenge").length, 0);
  await h.retry();
  assert.equal(h.resends.length, 0);
  assert.equal(h.get("success"), true);
  assert.ok(text(h.render()).includes(h.config.message));
});

test("failed signup still leaves the original form available", async () => {
  const h = harness();
  h.failSignup();
  await h.signup();
  assert.equal(h.get("success"), false);
  assert.equal(h.get("verificationPending"), false);
  assert.ok(elements(h.render()).some(element => element.type === "form"));
});

for (const { code } of supportedLocales) {
  test(`verification error and recovery actions retain actual ${code} translations`, async () => {
    const h = harness(code);
    await h.signup();
    (h.challenge().props.onToken as (token: string) => void)("synthetic-localized-challenge");
    h.setResend(async () => ({ error: { message: "synthetic failure" } }));
    await h.retry();
    const heading = authPageFirstPaintT(code, "Verify your e-mail to continue");
    const action = authPageFirstPaintT(code, "Resend verification e-mail");
    const feedback = customerAuthFeedbackT(code, { kind: "exact", source: "Verification e-mail could not be sent. Please try again." });
    const visible = text(h.render());
    for (const translated of [heading, action, feedback]) assert.ok(visible.includes(translated));
    if (code !== "en") {
      assert.notEqual(heading, "Verify your e-mail to continue");
      assert.notEqual(action, "Resend verification e-mail");
      assert.notEqual(feedback, "Verification e-mail could not be sent. Please try again.");
    }
  });
}
