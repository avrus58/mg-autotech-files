import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { config, proxy } from "../src/proxy";

const baseUrl = "https://file.mgautotech.de";
const localeHeader = "x-middleware-request-x-mg-locale";

function runProxy(
  path: string,
  options: { acceptLanguage?: string; cookieLocale?: string } = {}
) {
  const headers = new Headers();

  if (options.acceptLanguage) {
    headers.set("accept-language", options.acceptLanguage);
  }

  if (options.cookieLocale) {
    headers.set("cookie", `mg_locale=${options.cookieLocale}`);
  }

  return proxy(new NextRequest(`${baseUrl}${path}`, { headers }));
}

test("proxy resolves locale from localized path before cookie or accept-language", () => {
  const response = runProxy("/de/services/stage-1", {
    acceptLanguage: "fr-FR,fr;q=0.9",
    cookieLocale: "tr",
  });

  assert.equal(response.headers.get(localeHeader), "de");
  assert.equal(response.cookies.get("mg_locale")?.value, "de");
});

test("proxy preserves locale cookie when path has no locale segment", () => {
  const response = runProxy("/dashboard/orders/123", {
    acceptLanguage: "de-DE,de;q=0.9",
    cookieLocale: "tr",
  });

  assert.equal(response.headers.get(localeHeader), "tr");
  assert.equal(response.headers.get("x-middleware-set-cookie"), null);
  assert.equal(response.cookies.get("mg_locale"), undefined);
});

test("proxy falls back to accept-language when no locale cookie exists", () => {
  const response = runProxy("/services/dtc-off", {
    acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8",
  });

  assert.equal(response.headers.get(localeHeader), "fr");
  assert.equal(response.cookies.get("mg_locale")?.value, "fr");
});

test("fixed-language authored documents do not overwrite the visitor preference", () => {
  const germanDocument = runProxy("/agb", {
    acceptLanguage: "de-DE,de;q=0.9",
    cookieLocale: "tr",
  });
  const englishDocument = runProxy("/privacy", {
    acceptLanguage: "en-GB,en;q=0.9",
    cookieLocale: "tr",
  });

  assert.equal(germanDocument.headers.get(localeHeader), "de");
  assert.equal(englishDocument.headers.get(localeHeader), "en");
  assert.equal(germanDocument.headers.get("x-middleware-set-cookie"), null);
  assert.equal(englishDocument.headers.get("x-middleware-set-cookie"), null);
  assert.equal(germanDocument.cookies.get("mg_locale"), undefined);
  assert.equal(englishDocument.cookies.get("mg_locale"), undefined);
});

test("proxy selects the highest-ranked supported Accept-Language candidate", () => {
  const response = runProxy("/about", {
    acceptLanguage: "ja-JP, de-DE;q=0.9, tr-TR;q=0.8, en;q=0.7",
  });

  assert.equal(response.headers.get(localeHeader), "de");
  assert.equal(response.cookies.get("mg_locale")?.value, "de");
});

test("proxy ignores unsupported and q=0 candidates and rejects an invalid locale cookie", () => {
  const response = runProxy("/about", {
    acceptLanguage: "fr-FR;q=0, xx;q=1, tr-TR;q=0.7",
    cookieLocale: "xx",
  });

  assert.equal(response.headers.get(localeHeader), "tr");
  assert.equal(response.cookies.get("mg_locale")?.value, "tr");
});

test("proxy excludes APIs, static assets and deterministic search discovery resources", () => {
  assert.deepEqual(config.matcher, [
    "/((?!api|_next/static|_next/image|favicon.ico|og-image.svg|opengraph-image|robots.txt|sitemap.xml|feed.xml|llms.txt|53478ab4be7faddc91a14935b2b35013051e4dfc9bb31c4a.txt).*)",
  ]);
});
