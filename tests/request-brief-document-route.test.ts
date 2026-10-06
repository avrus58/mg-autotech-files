import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest, type NextResponse } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { proxy, config } from "../src/proxy";
import { intlLocaleByCode, supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import {
  isRequestBriefDocumentAlias,
  isRequestBriefDocumentRequest,
  requestBriefDocumentTarget,
} from "../src/lib/requestBriefDocumentRoute";

const canonical = "/tools/request-brief-builder";
const marker = "x-mg-request-brief-document";

function request(pathname: string, headers: HeadersInit = {}) {
  return new NextRequest(`https://synthetic.invalid${pathname}`, { headers });
}

function effectiveUpstream(response: NextResponse) {
  const result = new Headers();
  const keys = response.headers.get("x-middleware-override-headers")?.split(",") ?? [];
  for (const key of keys) {
    const value = response.headers.get(`x-middleware-request-${key}`);
    if (value !== null) result.set(key, value);
  }
  return result;
}

test("the actual Proxy rewrites only non-English canonical brief requests and forwards matching native locale", () => {
  for (const { code } of supportedLocales) {
    const response = proxy(request(canonical, { "accept-language": intlLocaleByCode[code] }));
    const upstream = effectiveUpstream(response);
    assert.equal(upstream.get("x-mg-locale"), code);
    assert.equal(response.headers.get("content-language"), intlLocaleByCode[code]);
    assert.equal(response.headers.get(marker), null, "marker is upstream-only");
    assert.match(response.headers.get("vary") ?? "", /Cookie/u);
    assert.match(response.headers.get("vary") ?? "", /Accept-Language/u);
    if (code === "en") {
      assert.equal(response.headers.get("x-middleware-rewrite"), null);
      assert.equal(response.headers.get("x-middleware-next"), "1");
      assert.equal(upstream.get(marker), null);
    } else {
      assert.equal(response.headers.get("x-middleware-rewrite"), `https://synthetic.invalid/${code}${canonical}`);
      assert.equal(upstream.get(marker), `${code}:${canonical}`);
    }
  }
});

test("the exact rewrite preserves the original query bytes, including repeats, encoding and RSC discriminator", () => {
  for (const search of [
    "?ref=first&ref=second&note=a%2Bb%20c&empty=&_rsc=synthetic",
    "?intent=stage_2&next=%2Fnew-request%3Fintent%3Dstage_2",
    "?encoded=%E4%B8%AD%E6%96%87&percent=%252F&question=%3F&hash=%23",
  ]) {
    for (const code of ["de", "tr", "zh"] as const) {
      const input = request(canonical + search, { "accept-language": intlLocaleByCode[code] });
      const response = proxy(input);
      const target = new URL(response.headers.get("x-middleware-rewrite") ?? "https://missing.invalid");
      assert.equal(target.search, input.nextUrl.search);
      assert.equal(target.pathname, `/${code}${canonical}`);
      assert.equal(input.nextUrl.pathname, canonical, "request URL is not mutated");
    }
  }
});

test("normal cookie and browser-language precedence still selects the rewrite locale", () => {
  const cases: Array<[HeadersInit, LocaleCode]> = [
    [{ cookie: "mg_locale=tr", "accept-language": "de-DE" }, "tr"],
    [{ cookie: "mg_locale=not-a-locale", "accept-language": "de;q=0,zh-CN;q=1" }, "zh"],
    [{ cookie: "mg_locale=en", "accept-language": "de-DE" }, "en"],
    [{ "accept-language": "unsupported;q=1,fr-FR;q=0.5" }, "fr"],
  ];
  for (const [headers, locale] of cases) {
    const response = proxy(request(canonical, headers));
    assert.equal(effectiveUpstream(response).get("x-mg-locale"), locale);
    assert.equal(response.headers.get("x-middleware-rewrite"), locale === "en" ? null : `https://synthetic.invalid/${locale}${canonical}`);
  }
});

test("caller provenance cannot survive any Proxy-handled path or authorize a direct alias", () => {
  for (const path of [canonical, `/de${canonical}`, "/tools", "/login", "/dashboard", "/impressum", "/de/services/stage-1"]) {
    const response = proxy(request(path, {
      "accept-language": "en-GB",
      "X-MG-Request-Brief-Document": `de:${canonical}`,
      "x-mg-locale": "de",
      "x-middleware-override-headers": marker,
      [`x-middleware-request-${marker}`]: `de:${canonical}`,
    }));
    assert.equal(effectiveUpstream(response).get(marker), null, path);
    assert.equal(response.headers.get(marker), null, path);
    assert.equal(response.headers.get("x-middleware-rewrite"), null, path);
  }
});

test("unrelated exact/private/fixed routes keep their response behavior; excluded routes stay outside Proxy", () => {
  for (const path of ["/tools/request-brief-builder-extra", "/tools", "/login", "/register", "/dashboard", "/new-request", "/embed/vehicle-selector"]) {
    const response = proxy(request(path, { "accept-language": "tr-TR" }));
    assert.equal(response.headers.get("x-middleware-rewrite"), null, path);
    assert.equal(response.headers.get("x-middleware-next"), "1", path);
  }
  const localizedHome = proxy(request("/?ref=synthetic", { "accept-language": "de-DE" }));
  assert.equal(localizedHome.status, 307);
  assert.equal(localizedHome.headers.get("location"), "https://synthetic.invalid/de?ref=synthetic");
  const legal = proxy(request("/impressum", { cookie: "mg_locale=tr", "accept-language": "tr-TR" }));
  assert.equal(legal.headers.get("content-language"), "de-DE");
  assert.equal(legal.headers.get("set-cookie"), null);
  const embedded = proxy(request("/embed/vehicle-selector", { "accept-language": "zh-CN" }));
  assert.equal(embedded.headers.get("content-language"), null);
  for (const path of ["/api/auth/session", "/_next/static/synthetic.js", "/_next/image", "/robots.txt", "/sitemap.xml", "/opengraph-image"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: `https://synthetic.invalid${path}` }), false, path);
  }
  assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: `https://synthetic.invalid/de${canonical}` }), true);
});

test("document routing accepts only the exact canonical path and a supported scalar non-English locale", () => {
  for (const { code } of supportedLocales) {
    assert.equal(requestBriefDocumentTarget(canonical, code), code === "en" ? null : `/${code}${canonical}`);
  }
  for (const locale of [undefined, null, [], ["de"], ["de", "tr"], "DE", "de-DE", " de", "de ", "unknown", "__proto__", 'de" onload="synthetic']) {
    assert.equal(requestBriefDocumentTarget(canonical, locale), null);
    assert.equal(isRequestBriefDocumentRequest(locale, new Headers({ "x-mg-locale": "de", [marker]: `de:${canonical}` })), false);
  }
  for (const path of [canonical + "/", canonical + "-extra", "/de" + canonical, canonical + "?intent=stage_2", "/login", "/api/auth/session"]) {
    assert.equal(requestBriefDocumentTarget(path, "de"), null);
  }
  for (const prefix of ["de", "tr", "zh", "unknown", "DE", "__proto__"]) {
    for (const suffix of ["", "/"]) {
      assert.equal(isRequestBriefDocumentAlias(`/${prefix}${canonical}${suffix}`), true);
      for (const headers of [{}, { RSC: "1" }, { RSC: "1", "Next-Router-Prefetch": "1" }] as HeadersInit[]) {
        const response = proxy(request(`/${prefix}${canonical}${suffix}`, headers));
        assert.equal(response.status, 404);
        assert.equal(response.headers.get("x-robots-tag"), "noindex");
      }
    }
  }
  for (const path of [canonical, "/en" + canonical, "/en" + canonical + "/", "/de" + canonical + "-extra", "/de/tools/another", "/de/services/stage-1", "/api" + canonical]) {
    assert.equal(isRequestBriefDocumentAlias(path), false, path);
  }
  const incompleteMarkers: HeadersInit[] = [
    {},
    { [marker]: `de:${canonical}` },
    { "x-mg-locale": "de" },
    { "x-mg-locale": "tr", [marker]: `de:${canonical}` },
    { "x-mg-locale": "de", [marker]: `tr:${canonical}` },
    { "x-mg-locale": "de", [marker]: canonical },
    { "x-mg-locale": "de", [marker]: `de:${canonical}/` },
  ];
  for (const headers of incompleteMarkers)
    assert.equal(isRequestBriefDocumentRequest("de", new Headers(headers)), false);
});

type RouteProps = { params: Promise<{ locale: unknown }> };
type RouteModule = {
  default: (props: RouteProps) => Promise<unknown>;
  generateMetadata: (props: RouteProps) => Promise<unknown>;
};

// Execute both exports from the actual wrapper. Only request context and the
// unchanged canonical renderer are substituted; the guard is not reimplemented.
function wrapper(upstream: Headers) {
  const file = "src/app/[locale]/tools/request-brief-builder/page.tsx";
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const source = ast.statements.filter((statement) => !ts.isImportDeclaration(statement)).map((statement) => statement.getText(ast)).join("\n");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {} as RouteModule;
  const page = { synthetic: "unchanged canonical body" };
  const metadata = { synthetic: "unchanged canonical metadata" };
  const calls = { page: 0, metadata: 0 };
  runInNewContext(compiled, {
    exports, isRequestBriefDocumentRequest,
    headers: async () => upstream,
    notFound() { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); },
    CanonicalRequestBriefBuilderPage: async () => { calls.page++; return page; },
    generateCanonicalMetadata: async () => { calls.metadata++; return metadata; },
  });
  return { exports, page, metadata, calls };
}

test("both actual wrapper exports accept the actual canonical Proxy provenance and delegate unchanged", async () => {
  for (const { code } of supportedLocales) {
    if (code === "en") continue;
    const upstream = effectiveUpstream(proxy(request(canonical, { "accept-language": intlLocaleByCode[code] })));
    const route = wrapper(upstream);
    const props = { params: Promise.resolve({ locale: code }) };
    assert.equal(await route.exports.default(props), route.page);
    assert.equal(await route.exports.generateMetadata(props), route.metadata);
    assert.deepEqual(route.calls, { page: 1, metadata: 1 });
  }
});

test("both wrapper exports reject direct and forged aliases after the real Proxy without rendering body or metadata", async () => {
  for (const { code } of supportedLocales) {
    if (code === "en") continue;
    for (const forged of [false, true]) {
      const response = proxy(request(`/${code}${canonical}`, forged ? {
        [marker]: `${code}:${canonical}`,
        "x-mg-locale": code,
        "x-middleware-override-headers": `${marker},x-mg-locale`,
        [`x-middleware-request-${marker}`]: `${code}:${canonical}`,
        "x-middleware-request-x-mg-locale": code,
      } : {}));
      const route = wrapper(effectiveUpstream(response));
      const props = { params: Promise.resolve({ locale: code }) };
      await assert.rejects(route.exports.default(props), /;404/u);
      await assert.rejects(route.exports.generateMetadata(props), /;404/u);
      assert.deepEqual(route.calls, { page: 0, metadata: 0 });
    }
  }
  const accepted = effectiveUpstream(proxy(request(canonical, { "accept-language": "de-DE" })));
  for (const locale of ["en", "tr", "DE", "de-DE", undefined, null, ["de"], "unknown"]) {
    const route = wrapper(accepted);
    const props = { params: Promise.resolve({ locale }) };
    await assert.rejects(route.exports.default(props), /;404/u);
    await assert.rejects(route.exports.generateMetadata(props), /;404/u);
    assert.deepEqual(route.calls, { page: 0, metadata: 0 });
  }
});
