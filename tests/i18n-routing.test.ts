import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  appendSafeQuery,
  getInitialLocaleRedirect,
  getLocalizedPublicHref,
  getLocalizedPublicPath,
  isServerLocalizedPublicPath,
  requiresServerLocaleRefresh,
  resolvePreferredLocale,
  splitLocalizedPath,
} from "../src/lib/i18nRoutes";

test("i18n route helper maps equivalent public routes across locales", () => {
  assert.deepEqual(splitLocalizedPath("/de/how-it-works"), {
    locale: "de",
    parts: ["how-it-works"],
  });

  assert.equal(getLocalizedPublicPath("/how-it-works", "de"), "/de/how-it-works");
  assert.equal(getLocalizedPublicPath("/de/how-it-works", "tr"), "/tr/how-it-works");
  assert.equal(getLocalizedPublicPath("/file-service", "de"), "/de/file-service");
  assert.equal(getLocalizedPublicPath("/de/file-service", "tr"), "/tr/file-service");
  assert.equal(getLocalizedPublicPath("/services/stage-1", "de"), "/de/services/stage-1");
  assert.equal(getLocalizedPublicPath("/de/services/dtc-off", "en"), "/services/dtc-off");
  assert.equal(getLocalizedPublicPath("/about", "tr"), "/about");
  assert.equal(getLocalizedPublicPath("/services/stage-2", "de"), "/services/stage-2");
  assert.equal(getLocalizedPublicPath("/services/stage-3", "tr"), "/services/stage-3");
  assert.equal(getLocalizedPublicHref("/file-service?ref=nav#upload", "de"), "/de/file-service?ref=nav#upload");
  assert.equal(getLocalizedPublicHref("/about?ref=nav", "tr"), "/about?ref=nav");
});

test("language changes use a sanitized anchor so paid-click consent interception cannot be bypassed", () => {
  const switcher = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");
  assert.match(switcher, /const canNavigate = localizedTarget !== pathname/);
  assert.match(switcher, /usesDocumentNavigation[\s\S]*?appendSafeQuery\(localizedTarget, currentSearch\)/);
  assert.match(switcher, /appendSafeQuery\(localizedTarget, currentSearch\)[\s\S]*?currentHash/u);
  assert.match(switcher, /return usesDocumentNavigation \? \([\s\S]*?<a[\s\S]*?href=\{target\}[\s\S]*?: \([\s\S]*?<button/);
  assert.match(switcher, /data-mg-locale-intent=\{item\.code\}/u);
  assert.doesNotMatch(switcher, /router\.push|useRouter/);
});

test("single-path server-localized pages reload when switching away from SSR copy", () => {
  assert.equal(requiresServerLocaleRefresh("/about", "de", "tr"), true);
  assert.equal(requiresServerLocaleRefresh("/services", "tr", "en"), true);
  assert.equal(requiresServerLocaleRefresh("/workshop-guides/read-methods", "de", "fr"), true);
  assert.equal(requiresServerLocaleRefresh("/about", "de", "de"), false);
  assert.equal(requiresServerLocaleRefresh("/de/file-service", "de", "tr"), false);
  assert.equal(requiresServerLocaleRefresh("/dashboard", "de", "tr"), false);

  const switcher = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");
  assert.match(switcher, /if \(requiresServerRefresh\)[\s\S]*?window\.location\.reload\(\)[\s\S]*?window\.location\.assign\(target\)/u);
  assert.match(
    switcher,
    /requiresServerLocaleRefresh\(pathname, currentLocale, preferredLocale\)[\s\S]*?persistLocale\(preferredLocale\)[\s\S]*?window\.location\.reload\(\)/u
  );
});

test("private and one-time routes never produce a language-navigation destination", () => {
  for (const route of [
    "/auth/callback",
    "/payment/success",
    "/new-request",
    "/admin/vehicles/123",
    "/dashboard/orders/123",
  ]) {
    assert.equal(getLocalizedPublicPath(route, "de"), route);
  }
});

test("i18n route helper recognizes only routes with complete server-localized content", () => {
  assert.equal(isServerLocalizedPublicPath("/"), true);
  assert.equal(isServerLocalizedPublicPath("/de"), true);
  assert.equal(isServerLocalizedPublicPath("/file-service"), true);
  assert.equal(isServerLocalizedPublicPath("/tr/how-it-works"), true);
  assert.equal(isServerLocalizedPublicPath("/services/stage-1"), true);
  assert.equal(isServerLocalizedPublicPath("/services/stage-2"), true);
  assert.equal(isServerLocalizedPublicPath("/brands/audi"), true);
  assert.equal(isServerLocalizedPublicPath("/download/windows"), true);
  assert.equal(isServerLocalizedPublicPath("/tools/file-readiness-check"), true);
  assert.equal(isServerLocalizedPublicPath("/dashboard"), false);
});

test("i18n route helper preserves safe query strings and does not rewrite private routes", () => {
  assert.equal(appendSafeQuery("/de/how-it-works", "?utm_source=test"), "/de/how-it-works?utm_source=test");
  assert.equal(appendSafeQuery("/de/how-it-works", "ref=footer"), "/de/how-it-works?ref=footer");
  assert.equal(
    appendSafeQuery(
      "/de/how-it-works",
      "?utm_source=google&gclid=private&GCLID=also-private&wbraid=private&_gl=private&ref=footer"
    ),
    "/de/how-it-works?utm_source=google&ref=footer"
  );
  assert.equal(appendSafeQuery("/de/how-it-works", "?gclid=private"), "/de/how-it-works");
  assert.equal(getLocalizedPublicPath("/dashboard/orders/123", "de"), "/dashboard/orders/123");
  assert.equal(getLocalizedPublicPath("/admin/vehicles", "tr"), "/admin/vehicles");
  assert.equal(getLocalizedPublicPath("/api/vehicles", "de"), "/api/vehicles");
});

test("first visit keeps an explicit or detected locale and redirects only true localized routes", () => {
  assert.equal(
    resolvePreferredLocale({
      pathname: "/",
      storedLocale: "tr",
      cookieLocale: "de",
      browserLocale: "fr-FR",
    }),
    "tr"
  );
  assert.equal(
    resolvePreferredLocale({
      pathname: "/de/how-it-works",
      storedLocale: "tr",
      browserLocale: "fr-FR",
    }),
    "de"
  );
  assert.equal(
    resolvePreferredLocale({ pathname: "/login", browserLocale: "fr-FR" }),
    "fr"
  );
  assert.equal(
    resolvePreferredLocale({
      pathname: "/login",
      storedLocale: "unsupported",
      cookieLocale: "de",
      browserLocale: "fr-FR",
    }),
    "de"
  );
  assert.equal(
    resolvePreferredLocale({
      pathname: "/login",
      cookieLocale: "unsupported",
      browserLocale: "fr-FR",
    }),
    "fr"
  );

  assert.equal(getInitialLocaleRedirect("/", "de"), "/de");
  assert.equal(getInitialLocaleRedirect("/file-service", "tr"), "/tr/file-service");
  assert.equal(getInitialLocaleRedirect("/de/how-it-works", "tr"), null);
  assert.equal(getInitialLocaleRedirect("/services/stage-2", "de"), null);
  assert.equal(getInitialLocaleRedirect("/login", "de"), null);
  assert.equal(getInitialLocaleRedirect("/", "en"), null);
});
