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
import PaymentSuccessPage from "../src/app/payment/success/page";
import { AuthRequired } from "../src/components/auth/AuthRequired";
import { BrowserAuthBoundary } from "../src/components/auth/BrowserAuthBoundary";
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
    for (const source of ["E-mail & password", "Invoice & address"]) {
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
  const sources = ["Confirming your payment...", "Confirming payment"] as const;

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;
    const html = renderWithLocale(locale, createElement(PaymentSuccessPage));

    for (const source of sources) {
      const localized = paymentFirstPaintT(locale, source);
      assert.notEqual(localized, source, `${locale}: ${source}`);
      assert.ok(
        html.includes(escapeRenderedText(localized)),
        `${locale} SSR omitted: ${localized}`,
      );
      assert.ok(!html.includes(`>${source}<`), `${locale} SSR leaked: ${source}`);
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
