import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import { supportedLocales } from "../src/lib/i18nConfig";
import { renderRootHomepage } from "../src/lib/renderRootHomepage";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";

const router: AppRouterInstance = {
  back: () => undefined,
  forward: () => undefined,
  refresh: () => undefined,
  push: () => undefined,
  replace: () => undefined,
  prefetch: () => undefined,
};

function escapeRenderedText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

test("canonical homepage first paint follows the server-resolved locale", () => {
  const criticalSources = [
    "Professional online file service platform",
    "The core workshop services, without the clutter.",
    "From original file to secure delivery in four clear steps.",
    "Ready to upload a file?",
  ] as const;

  for (const { code: locale } of supportedLocales) {
    if (locale === "en") continue;

    const catalog = buildHomepageTranslationCatalog(locale);
    assert.ok(catalog, locale);

    const html = renderToStaticMarkup(
      createElement(
        AppRouterContext.Provider,
        { value: router },
        createElement(
          PathnameContext.Provider,
          { value: "/" },
          createElement(
            ActiveLocaleProvider,
            {
              initialLocale: locale,
            } as ComponentProps<typeof ActiveLocaleProvider>,
            renderRootHomepage(locale),
          ),
        ),
      ),
    );

    assert.match(html, new RegExp(`data-unified-localized-homepage="${locale}"`, "u"));
    for (const source of criticalSources) {
      const translated = catalog.exact[source];
      assert.ok(translated, `${locale}: missing ${source}`);
      assert.notEqual(translated, source, `${locale}: untranslated ${source}`);
      assert.ok(
        html.includes(escapeRenderedText(translated)),
        `${locale}: SSR omitted ${translated}`,
      );
      assert.ok(!html.includes(`>${source}<`), `${locale}: SSR leaked ${source}`);
    }
  }
});
