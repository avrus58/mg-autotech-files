import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PathnameContext,
  PathParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { RootDocument } from "../src/components/RootDocument";
import { fixedPresentationLocaleBySegment } from "../src/lib/fixedPresentationLocale";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { customerWorkflowSharedSourceManifest } from "../src/lib/i18n/customer-workflow-surface-manifest";
import { hreflangByLocale } from "../src/lib/seo";
import { useActiveLocale, useInitialLocale } from "../src/lib/useActiveLocale";

function LocaleProbe() {
  return createElement("main", {
    "data-initial-locale": useInitialLocale(),
    "data-active-locale": useActiveLocale(),
    "data-document-child": "preserved",
  });
}

function renderDocument(
  params: Record<string, string | string[] | undefined> | null,
  pathname: string | null,
) {
  return renderToStaticMarkup(
    createElement(
      PathParamsContext.Provider,
      { value: params },
      createElement(
        PathnameContext.Provider,
        { value: pathname },
        createElement(
          RootDocument,
          { className: "synthetic-font h-full antialiased" } as Parameters<
            typeof RootDocument
          >[0],
          createElement(LocaleProbe),
        ),
      ),
    ),
  );
}

function assertDocumentLocale(html: string, locale: LocaleCode) {
  assert.match(
    html,
    new RegExp(`^<html lang="${hreflangByLocale[locale]}"`, "u"),
  );
  assert.match(html, new RegExp(`data-initial-locale="${locale}"`, "u"));
  assert.match(html, new RegExp(`data-active-locale="${locale}"`, "u"));
  assert.equal((html.match(/<html\b/gu) ?? []).length, 1);
  assert.equal((html.match(/<body\b/gu) ?? []).length, 1);
  assert.match(html, /class="synthetic-font h-full antialiased"/u);
  assert.match(html, /<body class="min-h-full flex flex-col">/u);
  assert.match(html, /data-document-child="preserved"/u);
  assert.doesNotMatch(html, /<script\b|document\.documentElement/u);
}

test("the opening HTML tag and child locale provider render every supported route locale without JavaScript", () => {
  for (const { code } of supportedLocales) {
    for (const suffix of ["", "/file-service", "/services/stage-1"]) {
      assertDocumentLocale(
        renderDocument({ locale: code }, `/${code}${suffix}`),
        code,
      );
    }
  }
});

test("only a validated scalar locale param can select a localized root document", () => {
  const invalidParams = [
    null,
    {},
    { locale: undefined },
    { locale: "unknown" },
    { locale: "DE" },
    { locale: "de-DE" },
    { locale: "" },
    { locale: [] },
    { locale: ["de"] },
    { locale: ["de", "tr"] },
    { locale: 'de" onload="alert(1)' },
  ];
  for (const params of invalidParams) {
    assertDocumentLocale(renderDocument(params, "/de"), "en");
  }
});

test("fixed-authored routes preserve their existing presentation language in raw HTML", () => {
  for (const [segment, locale] of Object.entries(
    fixedPresentationLocaleBySegment,
  )) {
    for (const suffix of ["", "/"]) {
      assertDocumentLocale(renderDocument({}, `/${segment}${suffix}`), locale);
    }
  }
  assertDocumentLocale(
    renderDocument({ locale: ["tr"] }, "/datenschutz"),
    "de",
  );
  assertDocumentLocale(renderDocument({}, "/datenschutz-extra"), "en");
});

test("canonical and prefixless request routes retain the honest English shell fallback", () => {
  for (const pathname of [
    null,
    "/",
    "/login",
    "/register",
    "/dashboard",
    "/widget",
  ]) {
    assertDocumentLocale(renderDocument(null, pathname), "en");
  }
  const source = readFileSync("src/components/RootDocument.tsx", "utf8");
  assert.doesNotMatch(
    source,
    /next\/headers|cookies\(|headers\(|localStorage|navigator\.|document\./u,
  );
});

test("the shared root document remains in the normal audited inventory", () => {
  assert.ok(
    customerWorkflowSharedSourceManifest["portal-common"].sourceFiles.includes(
      "src/components/RootDocument.tsx",
    ),
  );
  const source = readFileSync("src/components/RootDocument.tsx", "utf8");
  assert.doesNotMatch(source, /data-no-translate|translate="no"/u);
});
