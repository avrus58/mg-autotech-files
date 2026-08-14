import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";
import { POST as notifyIndexNow } from "../src/app/api/admin/seo-performance/indexnow/route";
import {
  buildIndexNowPayload,
  buildSearchEngineVerification,
  canonicalIndexingUrls,
  getSearchEngineVerificationReadiness,
  indexNowEndpoint,
  indexNowKey,
  indexNowKeyPath,
  isPublicIndexableUrl,
  splitIndexNowBatches,
  submitIndexNowUrls,
} from "../src/lib/searchEngineIndexing";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("search-engine verification metadata accepts only explicit safe tokens", () => {
  const environment = {
    BING_SITE_VERIFICATION: "bing-token_123",
    YANDEX_SITE_VERIFICATION: "yandex-token.456",
    BAIDU_SITE_VERIFICATION: "codeva-789",
    NAVER_SITE_VERIFICATION: "naver_token_012",
  };
  const metadata = buildSearchEngineVerification(environment);

  assert.deepEqual(getSearchEngineVerificationReadiness(environment), {
    bing: true,
    yandex: true,
    baidu: true,
    naver: true,
  });
  assert.equal(metadata?.yandex, "yandex-token.456");
  assert.deepEqual(metadata?.other, {
    "msvalidate.01": "bing-token_123",
    "baidu-site-verification": "codeva-789",
    "naver-site-verification": "naver_token_012",
  });

  assert.equal(buildSearchEngineVerification({
    BING_SITE_VERIFICATION: '"><script>alert(1)</script>',
    YANDEX_SITE_VERIFICATION: "unknown value",
  }), undefined);
});

test("IndexNow key is public, stable and served from the canonical root", () => {
  assert.match(indexNowKey, /^[a-f0-9]{32,128}$/);
  assert.equal(indexNowKeyPath, `/${indexNowKey}.txt`);
  assert.equal(
    projectFile("public", `${indexNowKey}.txt`).trim(),
    indexNowKey
  );
});

test("IndexNow accepts sitemap URLs only and rejects private or foreign URLs", () => {
  const entries = sitemap();
  const urls = canonicalIndexingUrls(entries);

  assert.ok(urls.length > 20);
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(urls.every(isPublicIndexableUrl), true);
  assert.equal(urls.some((url) => /\/(?:admin|api|auth|dashboard|login|register)(?:\/|$)/.test(new URL(url).pathname)), false);

  for (const blocked of [
    "https://file.mgautotech.de/admin",
    "https://file.mgautotech.de/api/vehicles",
    "https://file.mgautotech.de/dashboard/orders/private",
    "https://example.com/services/stage-1",
    "http://file.mgautotech.de/services/stage-1",
    "https://file.mgautotech.de/services/stage-1?customer=1",
  ]) {
    assert.equal(isPublicIndexableUrl(blocked), false, blocked);
  }
});

test("IndexNow payload is deterministic, bounded and contains no private metadata", () => {
  const payload = buildIndexNowPayload([
    "https://file.mgautotech.de/services/stage-1",
    "https://file.mgautotech.de/",
    "https://file.mgautotech.de/services/stage-1",
    "https://file.mgautotech.de/admin",
  ]);

  assert.equal(payload.host, "file.mgautotech.de");
  assert.equal(payload.key, indexNowKey);
  assert.equal(payload.keyLocation, `https://file.mgautotech.de/${indexNowKey}.txt`);
  assert.deepEqual(payload.urlList, [
    "https://file.mgautotech.de/",
    "https://file.mgautotech.de/services/stage-1",
  ]);
  assert.doesNotMatch(JSON.stringify(payload), /customer|email|order|storage|token|signed|admin/i);
  assert.equal(splitIndexNowBatches(payload.urlList, 1).length, 2);
  assert.throws(() => splitIndexNowBatches(payload.urlList, 10_001));
});

test("IndexNow submission uses the official endpoint and accepts 200 or 202 only", async () => {
  let requestUrl = "";
  let requestBody = "";
  const result = await submitIndexNowUrls({
    urls: ["https://file.mgautotech.de/services/stage-1"],
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestBody = String(init?.body ?? "");
      return new Response(null, { status: 202 });
    },
  });

  assert.equal(requestUrl, indexNowEndpoint);
  assert.equal(JSON.parse(requestBody).urlList[0], "https://file.mgautotech.de/services/stage-1");
  assert.deepEqual(result, {
    submittedUrlCount: 1,
    batchCount: 1,
    responseStatuses: [202],
  });

  await assert.rejects(() => submitIndexNowUrls({
    urls: ["https://file.mgautotech.de/services/stage-1"],
    fetchImpl: async () => new Response(null, { status: 403 }),
  }), /HTTP 403/);
});

test("robots and edge routing keep discovery public and private workspaces excluded", () => {
  const rules = JSON.stringify(robots());
  const proxy = projectFile("src", "proxy.ts");
  const nextConfig = projectFile("next.config.ts");

  assert.match(rules, /https:\/\/file\.mgautotech\.de\/sitemap\.xml/);
  assert.match(rules, new RegExp(indexNowKey));
  assert.match(rules, /\/admin/);
  assert.match(rules, /\/dashboard/);
  assert.match(rules, /\/api/);
  assert.match(proxy, /robots\.txt\|sitemap\.xml\|feed\.xml\|llms\.txt/);
  assert.match(proxy, new RegExp(indexNowKey));
  assert.match(nextConfig, /publicDiscoverySources/);
  assert.match(nextConfig, /stale-while-revalidate=86400/);
});

test("admin IndexNow notification is authenticated, permissioned and not an arbitrary URL relay", async () => {
  const response = await notifyIndexNow(
    new Request("http://localhost/api/admin/seo-performance/indexnow", { method: "POST" })
  );
  const route = projectFile("src", "app", "api", "admin", "seo-performance", "indexnow", "route.ts");

  assert.equal(response.status, 401);
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
  assert.match(route, /requireStaffPermission\(request, "orders\.manage"\)/);
  assert.match(route, /canonicalIndexingUrls\(sitemap\(\)\)/);
  assert.doesNotMatch(route, /request\.json|searchParams|get\("url"\)/);
  assert.match(route, /limit = 4/);
});

test("the operational script is dry-run by default and requires explicit submission", () => {
  const script = projectFile("scripts", "submit-indexnow.ts");
  assert.match(script, /process\.argv\.includes\("--submit"\)/);
  assert.match(script, /mode: "dry_run"/);
  assert.match(script, /privateUrlsIncluded: false/);
  assert.match(script, /submitIndexNowUrls/);
});
