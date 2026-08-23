import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  getTrustedClientIp,
  getTrustedCountryCode,
  resolveTrustedRequestNetwork,
  trustedProxyHeaders,
} from "../src/lib/requestNetwork";

const proxySecret = "proxy-secret-used-only-by-unit-tests-123456789";

function request(headers: Record<string, string>) {
  return new Request("https://file.mgautotech.de", { headers });
}

test("Vercel network metadata remains supported only inside Vercel", () => {
  const input = request({
    "x-vercel-forwarded-for": "203.0.113.12, 10.0.0.2",
    "x-vercel-ip-country": " tr ",
    "x-forwarded-for": "198.51.100.12",
    "cf-connecting-ip": "198.51.100.13",
    "cf-ipcountry": "US",
  });

  assert.deepEqual(resolveTrustedRequestNetwork(input.headers, { VERCEL: "1" }), {
    provider: "vercel",
    trusted: true,
    clientIp: "203.0.113.12",
    countryCode: "TR",
  });
  assert.deepEqual(resolveTrustedRequestNetwork(input.headers, {
    REQUEST_NETWORK_PROVIDER: "vercel",
  }), {
    provider: "none",
    trusted: false,
    clientIp: "unknown",
    countryCode: null,
  });
});

test("Cloudflare-Caddy mode accepts only proof-bound normalized upstream headers", () => {
  const environment = {
    REQUEST_NETWORK_PROVIDER: "cloudflare-caddy",
    REQUEST_NETWORK_PROXY_SECRET: proxySecret,
  };
  const input = request({
    [trustedProxyHeaders.proof]: proxySecret,
    [trustedProxyHeaders.clientIp]: "[2001:db8::25]:443",
    [trustedProxyHeaders.country]: " de ",
    "cf-connecting-ip": "198.51.100.20",
    "cf-ipcountry": "US",
    "x-forwarded-for": "198.51.100.21",
  });

  assert.deepEqual(resolveTrustedRequestNetwork(input.headers, environment), {
    provider: "cloudflare-caddy",
    trusted: true,
    clientIp: "2001:db8::25",
    countryCode: "DE",
  });
  assert.equal(getTrustedClientIp(input, environment), "2001:db8::25");
  assert.equal(getTrustedCountryCode(input, environment), "DE");
});

test("spoofed proxy and Cloudflare headers fail closed", () => {
  const configured = {
    REQUEST_NETWORK_PROVIDER: "cloudflare-caddy",
    REQUEST_NETWORK_PROXY_SECRET: proxySecret,
  };
  const noProof = request({
    [trustedProxyHeaders.clientIp]: "203.0.113.30",
    [trustedProxyHeaders.country]: "US",
    "cf-connecting-ip": "203.0.113.31",
    "cf-ipcountry": "TR",
    "x-forwarded-for": "203.0.113.32",
    "x-real-ip": "203.0.113.33",
  });
  const wrongProof = request({
    [trustedProxyHeaders.proof]: "wrong-secret-that-is-still-long-enough-123456",
    [trustedProxyHeaders.clientIp]: "203.0.113.34",
    [trustedProxyHeaders.country]: "DE",
  });

  for (const input of [noProof, wrongProof]) {
    const result = resolveTrustedRequestNetwork(input.headers, configured);
    assert.equal(result.trusted, false);
    assert.equal(result.clientIp, "unknown");
    assert.equal(result.countryCode, null);
  }

  const unconfigured = resolveTrustedRequestNetwork(noProof.headers, {});
  assert.equal(unconfigured.provider, "none");
  assert.equal(unconfigured.clientIp, "unknown");
  assert.equal(unconfigured.countryCode, null);
});

test("ambiguous IP lists and non-catalog countries are rejected", () => {
  const environment = {
    REQUEST_NETWORK_PROVIDER: "cloudflare-caddy",
    REQUEST_NETWORK_PROXY_SECRET: proxySecret,
  };
  const input = request({
    [trustedProxyHeaders.proof]: proxySecret,
    [trustedProxyHeaders.clientIp]: "203.0.113.40, 10.0.0.2",
    [trustedProxyHeaders.country]: "XX",
  });

  const result = resolveTrustedRequestNetwork(input.headers, environment);
  assert.equal(result.trusted, true);
  assert.equal(result.clientIp, "unknown");
  assert.equal(result.countryCode, null);
});

test("analytics and security consumers use the shared trusted network resolver", () => {
  const files = [
    "src/lib/abuseProtection.ts",
    "src/lib/rateLimit.ts",
    "src/lib/widget/usage.ts",
    "src/app/api/public/country/route.ts",
    "src/app/api/growth/journey/route.ts",
    "src/app/api/observability/client-event/route.ts",
  ];
  const combined = files
    .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
    .join("\n");

  assert.match(combined, /getTrustedClientIp|getTrustedCountryCode/);
  assert.doesNotMatch(combined, /headers\.get\("x-forwarded-for"\)/);
  assert.doesNotMatch(combined, /headers\.get\("x-real-ip"\)/);
  assert.doesNotMatch(combined, /headers\.get\("cf-connecting-ip"\)/);
  assert.doesNotMatch(combined, /headers\.get\("cf-ipcountry"\)/);
});
