import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  appendSafeQuery,
  getLocalizedPublicPath,
  isServerLocalizedPublicPath,
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
});

test("language changes use a sanitized anchor so paid-click consent interception cannot be bypassed", () => {
  const switcher = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");
  assert.match(switcher, /const canNavigate = localizedTarget !== pathname/);
  assert.match(switcher, /canNavigate[\s\S]*?appendSafeQuery\(localizedTarget, currentSearch\)/);
  assert.match(switcher, /return canNavigate \? \([\s\S]*?<a[\s\S]*?href=\{target\}[\s\S]*?: \([\s\S]*?<button/);
  assert.doesNotMatch(switcher, /router\.push|useRouter/);
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
  assert.equal(isServerLocalizedPublicPath("/services/stage-2"), false);
  assert.equal(isServerLocalizedPublicPath("/brands/audi"), false);
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
