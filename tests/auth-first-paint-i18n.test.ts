import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import LoginPage from "../src/app/login/page";
import RegisterPage from "../src/app/register/page";
import ForgotPasswordPage from "../src/app/forgot-password/page";
import ResetPasswordPage from "../src/app/reset-password/page";
import CompleteProfilePage from "../src/app/auth/complete-profile/page";
import PaymentCancelPage from "../src/app/payment/cancel/page";
import PaymentSuccessPage from "../src/app/payment/success/page";
import { AuthRequired } from "../src/components/auth/AuthRequired";
import { BrowserAuthBoundary } from "../src/components/auth/BrowserAuthBoundary";
import { RegistrationCountryBoundary } from "../src/components/auth/RegistrationCountryBoundary";
import { NewRequestAccessFallback } from "../src/components/auth/NewRequestAccessFallback";
import { LogAnalysisStudioLoader } from "../src/components/dashboard/LogAnalysisStudioLoader";
import { authPageFirstPaintT } from "../src/lib/i18n/auth-page-first-paint";
import { customerWorkflowExactT as paymentFirstPaintT } from "../src/lib/i18n/customer-workflow-credits-translations";
import { customerPortalFirstPaintT } from "../src/lib/i18n/customer-portal-first-paint";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";

const router: AppRouterInstance = {
  back: () => undefined,
  forward: () => undefined,
  refresh: () => undefined,
  push: () => undefined,
  replace: () => undefined,
  prefetch: () => undefined,
};

function renderWithLocale(locale: LocaleCode, child: ReactNode) {
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: router },
      createElement(
        ActiveLocaleProvider,
        { initialLocale: locale } as ComponentProps<typeof ActiveLocaleProvider>,
        child,
      ),
    ),
  );
}

function escapeRenderedText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

test("login first server-rendered HTML is localized in German and Turkish", () => {
  for (const locale of ["de", "tr"] as const) {
    const html = renderWithLocale(locale, createElement(LoginPage));

    for (const source of [
      "Customer Login",
      "Secure customer access",
      "Welcome back",
      "Access your file service dashboard and continue your ECU tuning requests.",
      "Forgot password?",
      "No account yet?",
    ]) {
      const localized = authPageFirstPaintT(locale, source);
      assert.notEqual(localized, source, `${locale}: ${source}`);
      assert.ok(html.includes(localized), `${locale} SSR omitted: ${localized}`);
      assert.ok(!html.includes(`>${source}<`), `${locale} SSR leaked: ${source}`);
    }
  }
});

test("register bootstrap SSR localizes its accessible status and noscript fallback", () => {
  for (const locale of ["de", "tr"] as const) {
    const html = renderWithLocale(locale, createElement(RegisterPage));
    const status = authPageFirstPaintT(locale, "Checking account");
    const noscript = authPageFirstPaintT(
      locale,
      "JavaScript is required for secure account registration. Enable JavaScript and reload this page.",
    );

    assert.notEqual(status, "Checking account");
    assert.notEqual(noscript, "JavaScript is required for secure account registration. Enable JavaScript and reload this page.");
    assert.match(html, new RegExp(`aria-label="${status}"`, "u"));
    assert.ok(html.includes(escapeRenderedText(noscript)));
    assert.doesNotMatch(html, /aria-label="Checking account"/u);
    assert.ok(
      !html.includes(
        "JavaScript is required for secure account registration. Enable JavaScript and reload this page.",
      ),
    );
  }
});

test("registration progress supporting labels are translated in every non-English locale", () => {
  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;
    for (const source of [
      "E-mail & password",
      "Invoice & address",
      "Password updated successfully. You can login now.",
    ]) {
      assert.notEqual(
        authPageFirstPaintT(locale, source),
        source,
        `${locale}: ${source}`,
      );
    }
  }
});

test("password recovery first paint is localized in every non-English locale", () => {
  const visibleSources = [
    "Password Recovery",
    "Secure reset",
    "Forgot password?",
    "Enter your account e-mail and we will send a secure password reset link.",
    "Send reset link",
    "Back to login",
  ] as const;
  const conditionalSources = ["Sending link..."] as const;

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;
    const html = renderWithLocale(locale, createElement(ForgotPasswordPage));

    for (const source of visibleSources) {
      const localized = authPageFirstPaintT(locale, source);
      assert.notEqual(localized, source, `${locale}: ${source}`);
      assert.ok(
        html.includes(escapeRenderedText(localized)),
        `${locale} SSR omitted: ${localized}`,
      );
      assert.ok(!html.includes(`>${source}<`), `${locale} SSR leaked: ${source}`);
    }
    for (const source of conditionalSources) {
      assert.notEqual(authPageFirstPaintT(locale, source), source, `${locale}: ${source}`);
      assert.ok(!html.includes(`>${source}<`), `${locale} SSR leaked: ${source}`);
    }
  }
});

test("password reset session first paint is localized in every non-English locale", () => {
  const source = "Checking reset session...";

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;
    const localized = authPageFirstPaintT(locale, source);
    const html = renderWithLocale(locale, createElement(ResetPasswordPage));

    assert.notEqual(localized, source, locale);
    assert.ok(html.includes(escapeRenderedText(localized)), locale);
    assert.ok(!html.includes(`>${source}<`), `${locale} SSR leaked reset copy`);
  }
});

test("payment confirmation first paint is localized in every non-English locale", () => {
  const sources = [
    "Confirming your payment...",
    "Confirming payment",
    "Payment needs review",
    "Added credits",
    "Buy More Credits",
  ] as const;

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;
    const html = renderWithLocale(locale, createElement(PaymentSuccessPage));

    for (const source of sources) {
      const localized = paymentFirstPaintT(locale, source);
      assert.notEqual(localized, source, `${locale}: ${source}`);
      if (source === "Confirming your payment..." || source === "Confirming payment") {
        assert.ok(
          html.includes(escapeRenderedText(localized)),
          `${locale} SSR omitted: ${localized}`,
        );
      }
      assert.ok(!html.includes(`>${source}<`), `${locale} SSR leaked: ${source}`);
    }
  }
});

test("payment cancellation first paint is localized in every non-English locale", () => {
  const sources = [
    "Payment cancelled",
    "The payment was cancelled. No credits were added and you were not charged by MG AutoTech through this checkout flow.",
    "Try Again",
    "Dashboard",
  ] as const;

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;
    const html = renderWithLocale(locale, createElement(PaymentCancelPage));

    for (const source of sources) {
      const localized = paymentFirstPaintT(locale, source);
      assert.notEqual(localized, source, `${locale}: ${source}`);
      assert.ok(
        html.includes(escapeRenderedText(localized)),
        `${locale} SSR omitted: ${localized}`,
      );
      assert.ok(!html.includes(`>${source}<`), `${locale} SSR leaked: ${source}`);
    }
    assert.match(html, /role="status"/u);
    assert.match(html, /aria-live="polite"/u);
  }
});

test("profile completion first paint and source contract cover every non-English locale", () => {
  const directFirstPaintSources = [
    "Checking account",
    "Customer Account",
    "Confirm your country",
    "Your country is required to finish creating your customer account.",
    "Saving country...",
    "Finish account setup",
  ] as const;
  const directRuntimeSources = [
    "Detecting your country...",
    "Country selected automatically. You can change it.",
    "Select the country used for your customer profile.",
  ] as const;
  const feedbackSources = [
    "Please select your country.",
    "Your country could not be saved. Please try again.",
    "Your session could not be verified. Please log in again.",
    "Your updated account could not be verified. Please log in again.",
  ] as const;
  const completeProfileSource = readFileSync(
    new URL("../src/app/auth/complete-profile/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(completeProfileSource, /const locale = useActiveLocale\(\)/u);
  assert.match(
    completeProfileSource,
    /const firstPaintT = \(source: string\) => authPageFirstPaintT\(locale, source\)/u,
  );
  assert.match(
    completeProfileSource,
    /\{customerWorkflowExactT\(locale, message\)\}/u,
  );
  for (const source of directFirstPaintSources) {
    assert.match(
      completeProfileSource,
      new RegExp(`firstPaintT\\(\\s*"${escapeRegExp(source)}"\\s*\\)`, "u"),
      `first-paint copy is not translated directly: ${source}`,
    );
  }
  for (const source of directRuntimeSources) {
    assert.match(
      completeProfileSource,
      new RegExp(
        `customerWorkflowExactT\\(\\s*locale\\s*,\\s*"${escapeRegExp(source)}"\\s*\\)`,
        "u",
      ),
      `runtime copy is not translated directly: ${source}`,
    );
  }
  assert.match(completeProfileSource, /role="alert"/u);
  assert.match(completeProfileSource, /aria-live="assertive"/u);

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;
    const html = renderWithLocale(locale, createElement(CompleteProfilePage));
    const checking = authPageFirstPaintT(locale, "Checking account");

    assert.notEqual(checking, "Checking account", locale);
    assert.match(html, new RegExp(`aria-label="${escapeRenderedText(checking)}"`, "u"));
    assert.doesNotMatch(html, /aria-label="Checking account"/u);
    assert.match(html, /role="status"/u);
    assert.match(html, /aria-live="polite"/u);

    for (const source of [
      ...directFirstPaintSources,
      ...directRuntimeSources,
      ...feedbackSources,
    ]) {
      assert.notEqual(
        authPageFirstPaintT(locale, source),
        source,
        `${locale}: ${source}`,
      );
    }
  }
});

test("recovery feedback uses live regions for assistive technology", () => {
  const forgotSource = readFileSync(
    new URL("../src/app/forgot-password/page.tsx", import.meta.url),
    "utf8",
  );
  const resetSource = readFileSync(
    new URL("../src/app/reset-password/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(forgotSource, /role=\{success \? "status" : "alert"\}/u);
  assert.match(
    forgotSource,
    /aria-live=\{success \? "polite" : "assertive"\}/u,
  );
  assert.match(resetSource, /role="alert"/u);
  assert.match(resetSource, /aria-live="assertive"/u);
});

test("protected customer routes localize checking and signed-out SSR states", () => {
  const title = "Please log in to access your customer dashboard";
  const description =
    "Your file requests, credits, messages and completed files are protected inside your MG AutoTech account.";

  for (const locale of ["de", "tr"] as const) {
    const checkingHtml = renderWithLocale(
      locale,
      createElement(
        BrowserAuthBoundary,
        {
          title,
          description,
        } as ComponentProps<typeof BrowserAuthBoundary>,
        createElement("p", null, "Authenticated content"),
      ),
    );
    const checking = customerPortalFirstPaintT(
      locale,
      "Checking secure session...",
    );
    assert.notEqual(checking, "Checking secure session...");
    assert.ok(checkingHtml.includes(checking));
    assert.ok(!checkingHtml.includes(">Checking secure session...<"));

    const profileCheckingHtml = renderWithLocale(
      locale,
      createElement(
        RegistrationCountryBoundary,
        null,
        createElement("p", null, "Completed customer profile"),
      ),
    );
    const profileChecking = customerPortalFirstPaintT(
      locale,
      "Checking customer profile...",
    );
    assert.notEqual(profileChecking, "Checking customer profile...");
    assert.ok(profileCheckingHtml.includes(profileChecking));
    assert.ok(!profileCheckingHtml.includes(">Checking customer profile...<"));

    const signedOutHtml = renderWithLocale(
      locale,
      createElement(AuthRequired, {
        locale,
        title,
        description,
        nextPath: "/dashboard",
      }),
    );
    for (const source of [
      title,
      description,
      "Secure customer access",
      "Log in securely",
      "Create account",
      "Return to homepage",
    ]) {
      const localized = customerPortalFirstPaintT(locale, source);
      assert.notEqual(localized, source, `${locale}: ${source}`);
      assert.ok(signedOutHtml.includes(localized));
      assert.ok(!signedOutHtml.includes(`>${source}<`));
    }
  }
});

test("registration country gate translates its first server-rendered status directly", () => {
  const boundarySource = readFileSync(
    new URL("../src/components/auth/RegistrationCountryBoundary.tsx", import.meta.url),
    "utf8",
  );

  assert.match(boundarySource, /const locale = useActiveLocale\(\)/u);
  assert.match(
    boundarySource,
    /customerPortalFirstPaintT\(locale, "Checking customer profile\.\.\."\)/u,
  );
});

test("Datalog Studio access check is localized in every non-English first paint", () => {
  const source = "Verifying customer access...";

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;
    const localized = customerPortalFirstPaintT(locale, source);
    const html = renderWithLocale(
      locale,
      createElement(LogAnalysisStudioLoader),
    );

    assert.notEqual(localized, source, `${locale}: missing Studio access copy`);
    assert.ok(
      html.includes(escapeRenderedText(localized)),
      `${locale}: Studio access SSR omitted localized copy`,
    );
    assert.ok(!html.includes(`>${source}<`), `${locale}: Studio access leaked English`);
  }
});

test("new-request Suspense fallback is localized before access checks resolve", () => {
  const source = "Secure customer access";

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;
    const localized = customerPortalFirstPaintT(locale, source);
    const html = renderToStaticMarkup(
      createElement(NewRequestAccessFallback, { locale }),
    );

    assert.notEqual(localized, source, `${locale}: missing request fallback copy`);
    assert.ok(html.includes(escapeRenderedText(localized)), locale);
    assert.ok(!html.includes(`>${source}<`), `${locale}: request fallback leaked English`);
    assert.match(html, /role="status"/u);
    assert.match(html, /aria-live="polite"/u);
  }
});
