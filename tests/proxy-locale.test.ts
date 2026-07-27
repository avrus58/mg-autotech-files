import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { config, proxy } from "../src/proxy";
import { applySupabaseSessionRefresh } from "../src/lib/supabaseProxySession";

const baseUrl = "https://file.mgautotech.de";
const localeHeader = "x-middleware-request-x-mg-locale";

async function runProxy(
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

test("proxy resolves locale from localized path before cookie or accept-language", async () => {
  const response = await runProxy("/de/services/stage-1", {
    acceptLanguage: "fr-FR,fr;q=0.9",
    cookieLocale: "tr",
  });

  assert.equal(response.headers.get(localeHeader), "de");
  assert.equal(response.cookies.get("mg_locale")?.value, "de");
});

test("proxy preserves locale cookie when path has no locale segment", async () => {
  const response = await runProxy("/dashboard/orders/123", {
    acceptLanguage: "de-DE,de;q=0.9",
    cookieLocale: "tr",
  });

  assert.equal(response.headers.get(localeHeader), "tr");
  assert.equal(response.headers.get("x-middleware-set-cookie"), null);
  assert.equal(response.cookies.get("mg_locale"), undefined);
});

test("proxy falls back to accept-language when no locale cookie exists", async () => {
  const response = await runProxy("/services/dtc-off", {
    acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8",
  });

  assert.equal(response.headers.get(localeHeader), "fr");
  assert.equal(response.cookies.get("mg_locale")?.value, "fr");
});

test("proxy covers authenticated routes and APIs while excluding static assets", () => {
  assert.deepEqual(config.matcher, [
    "/((?!_next/static|_next/image|favicon.ico|og-image.svg|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ]);
});

test("Supabase refresh helper forwards supplied private headers and cookie options", () => {
  const request = new NextRequest(`${baseUrl}/dashboard`, {
    headers: { cookie: "existing_cookie=kept" },
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mg-locale", "de");
  const response = applySupabaseSessionRefresh({
    request,
    requestHeaders,
    cookiesToSet: [
      {
        name: "sb-test-auth-token",
        value: "synthetic-session-cookie",
        options: {
          httpOnly: true,
          maxAge: 3600,
          path: "/",
          sameSite: "lax",
          secure: true,
        },
      },
    ],
    responseHeaders: {
      "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      Expires: "0",
      Pragma: "no-cache",
    },
  });

  assert.match(
    response.headers.get("x-middleware-request-cookie") ?? "",
    /existing_cookie=kept/
  );
  assert.match(
    response.headers.get("x-middleware-request-cookie") ?? "",
    /sb-test-auth-token=synthetic-session-cookie/
  );
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-cache, no-store, max-age=0, must-revalidate"
  );
  assert.equal(response.headers.get("expires"), "0");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("x-middleware-request-x-mg-locale"), "de");
  const refreshedCookie = response.cookies.get("sb-test-auth-token");
  assert.equal(refreshedCookie?.value, "synthetic-session-cookie");
  assert.equal(refreshedCookie?.httpOnly, true);
  assert.equal(refreshedCookie?.maxAge, 3600);
  assert.equal(refreshedCookie?.path, "/");
  assert.equal(refreshedCookie?.sameSite, "lax");
  assert.equal(refreshedCookie?.secure, true);
});
