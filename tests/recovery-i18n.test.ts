import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ErrorBoundary from "../src/app/error";
import GlobalError from "../src/app/global-error";
import { supportedLocales } from "../src/lib/i18nConfig";
import {
  recoveryTranslations,
  resolveRecoveryLocale,
} from "../src/lib/i18n/recovery-translations";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";

test("fatal recovery locale skips invalid stored and cookie values", () => {
  assert.equal(
    resolveRecoveryLocale({
      pathLocale: null,
      storedLocale: "xx",
      cookieLocale: "de",
      documentLocale: "en",
      browserLocale: "fr-FR",
    }),
    "de",
  );
  assert.equal(
    resolveRecoveryLocale({
      pathLocale: null,
      storedLocale: "unsupported",
      cookieLocale: "invalid",
      documentLocale: "tr",
      browserLocale: "de-DE",
    }),
    "tr",
  );
});

test("fatal recovery UI has complete standalone copy for every site locale", () => {
  assert.deepEqual(Object.keys(recoveryTranslations).sort(), supportedLocales.map(({ code }) => code).sort());
  const englishKeys = Object.keys(recoveryTranslations.en);
  for (const { code } of supportedLocales) {
    assert.deepEqual(Object.keys(recoveryTranslations[code]).sort(), [...englishKeys].sort(), code);
    for (const key of englishKeys) {
      const typedKey = key as keyof typeof recoveryTranslations.en;
      assert.ok(recoveryTranslations[code][typedKey].trim(), `${code}.${key}`);
      if (code !== "en") assert.notEqual(recoveryTranslations[code][typedKey], recoveryTranslations.en[typedKey], `${code}.${key}`);
    }
  }
});

test("fatal boundaries resolve locale without relying on the main language switcher", () => {
  const localError = readFileSync("src/app/error.tsx", "utf8");
  const globalError = readFileSync("src/app/global-error.tsx", "utf8");
  const recovery = readFileSync("src/lib/i18n/recovery-translations.ts", "utf8");
  const inventory = readFileSync("scripts/check-customer-i18n.ts", "utf8");

  assert.match(localError, /useRecoveryLocale/u);
  assert.match(globalError, /<html lang=\{locale\}>/u);
  assert.doesNotMatch(globalError, /<html lang="en">/u);
  assert.match(recovery, /readStoredLocale\(\)/u);
  assert.match(recovery, /readLocaleCookie\(\)/u);
  assert.match(inventory, /"global-error\.tsx"/u);
  assert.match(inventory, /"not-found\.tsx"/u);
  assert.match(inventory, /"loading\.tsx"/u);
});

test("segment recovery SSR uses the server locale and global recovery stays language-neutral until hydration", () => {
  const segmentMarkup = renderToStaticMarkup(
    createElement(
      ActiveLocaleProvider,
      { initialLocale: "de" } as ComponentProps<typeof ActiveLocaleProvider>,
      createElement(ErrorBoundary, {
        error: new Error("synthetic render failure"),
        reset: () => undefined,
      }),
    ),
  );
  assert.match(segmentMarkup, /Diese Ansicht muss neu geladen werden/u);
  assert.doesNotMatch(segmentMarkup, /This view needs a clean reload/u);

  const globalMarkup = renderToStaticMarkup(
    createElement(GlobalError, {
      error: new Error("synthetic root failure"),
      reset: () => undefined,
    }),
  );
  assert.match(globalMarkup, /<html lang="und">/u);
  assert.match(globalMarkup, /MG AUTOTECH/u);
  assert.doesNotMatch(globalMarkup, /This view needs a clean reload/u);
});

test("not-found UI uses the active locale and localized recovery catalog", () => {
  const notFound = readFileSync("src/app/not-found.tsx", "utf8");
  assert.match(notFound, /useActiveLocale\(\)/u);
  assert.match(notFound, /recoveryTranslations\[locale\]/u);
  assert.match(notFound, /copy\.notFoundTitle/u);
  assert.match(notFound, /getLocalizedPublicHref\("\/", locale\)/u);
  assert.match(notFound, /getLocalizedPublicHref\("\/services", locale\)/u);
  assert.doesNotMatch(notFound, /This page could not be found/u);
});

test("embedded widget declares the product-owned language on both outcomes", () => {
  const embed = readFileSync("src/app/embed/vehicle-selector/page.tsx", "utf8");
  assert.match(embed, /data-widget-embed lang=\{language\}/u);
  assert.match(embed, /data-widget-embed lang=\{result\.language\}/u);
});
