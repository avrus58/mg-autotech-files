import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Run against `next start` after a completed build. This never starts a server,
// reads environment files, follows redirects, or fetches canonical URLs.
export const seoPaths = [
  "/",
  "/file-service",
  "/how-it-works",
  "/services/stage-1",
  "/services/dpf-off",
  "/services/egr-off",
  "/services/adblue-off",
  "/services/dtc-off",
];
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export function parseBaseUrl(args) {
  assert.ok(
    args.length === 0 || (args.length === 2 && args[0] === "--base-url"),
    "Usage: node scripts/check-server-html-language.mjs [--base-url http://127.0.0.1:3217]",
  );
  const url = new URL(args[1] ?? "http://127.0.0.1:3217");
  assert.ok(
    ["http:", "https:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/",
    "Only an HTTP(S) loopback origin is allowed.",
  );
  return url;
}

// Read only the literal locale declarations, not TypeScript modules or env.
// Fail if the declarations change shape instead of silently omitting a locale.
export function readLocaleContract(root = projectRoot) {
  const config = readFileSync(resolve(root, "src/lib/i18nConfig.ts"), "utf8");
  const seo = readFileSync(resolve(root, "src/lib/seo.ts"), "utf8");
  const localeBlock = config.match(
    /export const supportedLocales\s*=\s*\[([\s\S]*?)\]\s*as const/u,
  )?.[1];
  assert.ok(localeBlock, "Cannot read supportedLocales declaration.");
  const locales = [...localeBlock.matchAll(/\bcode:\s*"([a-z]+)"/gu)].map(
    (match) => match[1],
  );
  assert.equal(
    locales.length,
    12,
    "Update the regression matrix deliberately when supported locales change.",
  );
  assert.equal(new Set(locales).size, locales.length);
  const readMap = (source, name) => {
    const block = source.match(
      new RegExp(`export const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\};`, "u"),
    )?.[1];
    assert.ok(block, `Cannot read ${name} declaration.`);
    const entries = [...block.matchAll(/\b([a-z]+):\s*"([^"]+)"/gu)].map(
      (match) => [match[1], match[2]],
    );
    assert.deepEqual(
      entries.map(([key]) => key).sort(),
      [...locales].sort(),
      `${name} must cover every locale exactly once.`,
    );
    return Object.fromEntries(entries);
  };
  const defaultLocale = config.match(
    /export const defaultLocale[^=]*=\s*"([a-z]+)"/u,
  )?.[1];
  const siteUrl = seo.match(/export const siteUrl\s*=\s*"([^"]+)"/u)?.[1];
  assert.ok(
    locales.includes(defaultLocale) && siteUrl,
    "Missing default locale or canonical origin.",
  );
  return {
    locales,
    defaultLocale,
    siteUrl,
    htmlLanguages: readMap(seo, "hreflangByLocale"),
    contentLanguages: readMap(config, "intlLocaleByCode"),
  };
}

function decodeEntities(value) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/giu,
    (entity, code) => {
      if (!code.startsWith("#")) return named[code.toLowerCase()];
      const point =
        code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    },
  );
}

/** @returns {Record<string, string>} */
function attributes(tag) {
  /** @type {Record<string, string>} */
  const result = {};
  const content = tag.replace(/^<\w+\b/u, "").replace(/\/?\s*>$/u, "");
  for (const match of content.matchAll(
    /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu,
  )) {
    const key = match[1].toLowerCase();
    assert.ok(!Object.hasOwn(result, key), `Duplicate HTML attribute: ${key}`);
    result[key] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

const tagEnd = "(?:\"[^\"]*\"|'[^']*'|[^'\">])*>";
function plainText(html) {
  return decodeEntities(html.replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

// Intentionally narrow to generated document/head markup; not a general DOM
// parser. Ignore comments and executable/inert scripts so RSC payload strings
// and a hydration-time lang assignment cannot make the raw-HTML check pass.
export function inspectHtml(raw) {
  const html = raw
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, "");
  const opening = html.match(
    new RegExp(`^\\s*(?:<!doctype[^>]*>\\s*)?(<html\\b${tagEnd})`, "iu"),
  )?.[1];
  assert.ok(opening, "Opening HTML element missing.");
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/iu)?.[1];
  assert.notEqual(head, undefined, "Server-rendered head missing.");
  const links = [...head.matchAll(new RegExp(`<link\\b${tagEnd}`, "giu"))].map(
    (match) => attributes(match[0]),
  );
  const metas = [...head.matchAll(new RegExp(`<meta\\b${tagEnd}`, "giu"))].map(
    (match) => attributes(match[0]),
  );
  const main = html.match(/<main\b([^>]*)>([\s\S]*?)<\/main\s*>/iu);
  const h1 = main?.[2].match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/iu)?.[1] ?? "";
  return {
    lang: attributes(opening).lang,
    documentId: attributes(opening).id,
    htmlElementCount: [...html.matchAll(new RegExp(`<html\\b${tagEnd}`, "giu"))]
      .length,
    bodyElementCount: [...html.matchAll(new RegExp(`<body\\b${tagEnd}`, "giu"))]
      .length,
    robots: metas
      .filter((meta) => meta.name?.toLowerCase() === "robots")
      .flatMap((meta) => meta.content?.toLowerCase().split(/\s*,\s*/u) ?? []),
    canonicals: links
      .filter((link) =>
        link.rel?.toLowerCase().split(/\s+/u).includes("canonical"),
      )
      .map((link) => link.href),
    alternates: links.filter(
      (link) =>
        link.rel?.toLowerCase().split(/\s+/u).includes("alternate") &&
        link.hreflang,
    ),
    h1: plainText(h1),
    main: plainText(main?.[2] ?? ""),
  };
}

export function localizedPath(locale, path, contract) {
  return locale === contract.defaultLocale
    ? path
    : `/${locale}${path === "/" ? "" : path}`;
}

export function validatePage(
  document,
  { locale, path, contentLanguage },
  contract,
) {
  assert.equal(
    document.lang,
    contract.htmlLanguages[locale],
    "Opening html lang mismatch.",
  );
  assert.equal(document.htmlElementCount, 1, "Expected a single HTML element.");
  assert.equal(document.bodyElementCount, 1, "Expected a single body element.");
  assert.equal(
    contentLanguage,
    contract.contentLanguages[locale],
    "Content-Language mismatch.",
  );
  assert.deepEqual(
    document.canonicals.map((href) => new URL(href).href),
    [
      new URL(`${contract.siteUrl}${localizedPath(locale, path, contract)}`)
        .href,
    ],
    "Canonical mismatch or duplicate.",
  );
  const expected = Object.fromEntries(
    contract.locales.map((code) => [
      contract.htmlLanguages[code],
      new URL(`${contract.siteUrl}${localizedPath(code, path, contract)}`).href,
    ]),
  );
  expected["x-default"] = new URL(`${contract.siteUrl}${path}`).href;
  assert.equal(
    document.alternates.length,
    contract.locales.length + 1,
    "Expected exactly 13 hreflang links.",
  );
  assert.equal(
    new Set(document.alternates.map((link) => link.hreflang)).size,
    document.alternates.length,
    "Duplicate hreflang.",
  );
  assert.deepEqual(
    Object.fromEntries(
      document.alternates.map((link) => [
        link.hreflang,
        new URL(link.href).href,
      ]),
    ),
    expected,
    "Hreflang URLs mismatch.",
  );
  assert.ok(
    document.h1.length > 0,
    "Main H1 must be present before JavaScript.",
  );
  assert.ok(
    document.main.length > document.h1.length + 80,
    "Meaningful main content must be present before JavaScript.",
  );
}

export function validateLocalizedContent(document, english) {
  assert.notEqual(
    document.h1,
    english.h1,
    "Localized H1 is identical to the English route.",
  );
  assert.notEqual(
    document.main,
    english.main,
    "Localized main is identical to the English route.",
  );
}

export function validateNotFound(document, status, contract) {
  assert.equal(status, 404, "Unknown route must remain a 404.");
  assert.equal(document.htmlElementCount, 1, "Expected a single HTML element.");
  assert.equal(document.bodyElementCount, 1, "Expected a single body element.");
  assert.ok(
    document.robots.includes("noindex"),
    "Unknown route must remain noindex.",
  );
  const frameworkErrorShell = document.documentId === "__next_error__";
  if (!frameworkErrorShell) {
    assert.equal(
      document.lang,
      contract.htmlLanguages[contract.defaultLocale],
      "Our unknown-route document must use the default language.",
    );
  }
  return { frameworkErrorShell, documentLanguage: document.lang ?? null };
}

export async function runCheck(baseUrl, contract = readLocaleContract()) {
  // Validate again for programmatic callers; don't trust a caller-supplied URL.
  baseUrl = parseBaseUrl(["--base-url", String(baseUrl)]);
  assert.ok(
    readFileSync(resolve(projectRoot, ".next/BUILD_ID"), "utf8").trim(),
    "A completed Next production build is required.",
  );
  const failures = [];
  const notFoundDiagnostics = [];
  let checked = 0;
  const englishPages = new Map();
  const request = async (path, headers = {}) =>
    fetch(new URL(path, baseUrl), {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "text/html", "Accept-Language": "en-GB", ...headers },
    });
  const check = async (name, callback) => {
    checked += 1;
    try {
      await callback();
    } catch (error) {
      // Only assertion descriptions are reported; never dump response bodies.
      failures.push({
        check: name,
        error:
          error instanceof Error
            ? error.message.split("\n")[0]
            : "Unknown failure",
      });
    }
  };
  const page = async (locale, path, headers) => {
    const response = await request(
      localizedPath(locale, path, contract),
      headers,
    );
    assert.equal(response.status, 200, "Expected 200 without redirect.");
    assert.ok(
      response.headers.get("content-type")?.includes("text/html"),
      "Expected HTML response.",
    );
    const document = inspectHtml(await response.text());
    validatePage(
      document,
      {
        locale,
        path,
        contentLanguage: response.headers.get("content-language"),
      },
      contract,
    );
    if (locale === contract.defaultLocale) englishPages.set(path, document);
    else {
      assert.ok(
        englishPages.has(path),
        "English baseline failed; localized comparison cannot pass.",
      );
      validateLocalizedContent(document, englishPages.get(path));
    }
    return document;
  };
  // English baselines must complete before their localized comparisons.
  for (const locale of [
    contract.defaultLocale,
    ...contract.locales.filter((code) => code !== contract.defaultLocale),
  ]) {
    for (const path of seoPaths) {
      await check(`${locale} ${path}`, () =>
        page(locale, path, {
          "Accept-Language": contract.contentLanguages[locale],
        }),
      );
    }
    if (locale !== contract.defaultLocale) {
      const other = locale === "de" ? "tr" : "de";
      await check(`${locale} path beats Accept-Language`, () =>
        page(locale, "/", {
          "Accept-Language": contract.contentLanguages[other],
        }),
      );
      await check(`${locale} path beats cookie and Accept-Language`, () =>
        page(locale, "/file-service", {
          Cookie: `mg_locale=${other}`,
          "Accept-Language": "en-GB",
        }),
      );
    }
  }
  // Header/cookie negotiation may redirect prefixless public URLs, but must
  // preserve benign query parameters. URL fragments never reach HTTP servers.
  for (const headers of [
    { "Accept-Language": "de-DE" },
    { Cookie: "mg_locale=de", "Accept-Language": "tr-TR" },
  ]) {
    await check(
      `prefixless redirect (${headers.Cookie ? "cookie" : "language"})`,
      async () => {
        const response = await request(
          "/how-it-works?locale_check=server-html",
          headers,
        );
        assert.ok(
          [307, 308].includes(response.status),
          "Expected locale redirect.",
        );
        const target = new URL(response.headers.get("location") ?? "", baseUrl);
        assert.equal(
          target.origin,
          baseUrl.origin,
          "Redirect left the local origin.",
        );
        assert.equal(target.pathname, "/de/how-it-works");
        assert.equal(target.search, "?locale_check=server-html");
      },
    );
  }
  for (const path of [
    "/__server_html_language_missing__",
    "/xx/__server_html_language_missing__",
  ]) {
    await check(`nonlocale 404 ${path}`, async () => {
      const response = await request(path);
      const diagnostic = validateNotFound(
        inspectHtml(await response.text()),
        response.status,
        contract,
      );
      notFoundDiagnostics.push({ path, ...diagnostic });
    });
  }
  return {
    passed: failures.length === 0,
    checked,
    localeCount: contract.locales.length,
    seoPageCount: contract.locales.length * seoPaths.length,
    failures,
    notFoundDiagnostics,
    notFoundBaseline:
      "2026-09-07 local baseline/candidate comparison: Next's __next_error__ shell already omitted lang for a single unknown segment and an unknown localized service. The 404/noindex boundary is checked separately; this does not exempt any 200 SEO page or claim the framework language omission is fixed.",
    scope:
      "Loopback raw HTTP HTML only; no JavaScript, auth, production calls, or linguistic quality certification.",
  };
}

async function main() {
  try {
    const result = await runCheck(parseBaseUrl(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message.split("\n")[0]
        : "Server HTML language check failed.",
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
