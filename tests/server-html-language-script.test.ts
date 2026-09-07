import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectHtml,
  localizedPath,
  parseBaseUrl,
  readLocaleContract,
  runCheck,
  seoPaths,
  validateLocalizedContent,
  validateNotFound,
  validatePage,
} from "../scripts/check-server-html-language.mjs";

const contract = readLocaleContract();
const path = "/file-service";
const context = { locale: "de", path, contentLanguage: "de-DE" };

function fixture({
  lang = "de",
  heading = "Dateiservice für Werkstätten",
  extraHead = "",
  extraBody = "",
} = {}) {
  const alternateLinks = contract.locales
    .map(
      (locale: string) =>
        `<LINK href='${contract.siteUrl}${localizedPath(locale, path, contract)}' HREFLANG='${contract.htmlLanguages[locale]}' rel='alternate'>`,
    )
    .join("");
  return `<!doctype html><HTML data-lang='en' LANG='${lang}'><head>
    <link href='${contract.siteUrl}/de/file-service' rel='canonical'>
    ${alternateLinks}<link href='${contract.siteUrl}${path}' hreflang='x-default' rel='alternate'>
    ${extraHead}</head><body><main><h1>${heading}</h1>
    <p>${"Lokalisierter Inhalt für Werkstätten und sichere Dateiaufträge. ".repeat(5)}</p>
    </main>${extraBody}</body></HTML>`;
}

test("raw HTML checker only accepts loopback origins and a bounded CLI", () => {
  assert.equal(parseBaseUrl([]).href, "http://127.0.0.1:3217/");
  for (const url of [
    "http://localhost:3217",
    "http://127.0.0.1:3217",
    "http://[::1]:3217",
  ]) {
    assert.doesNotThrow(() => parseBaseUrl(["--base-url", url]));
  }
  for (const url of [
    "https://file.mgautotech.de",
    "https://example.com",
    "http://localhost.evil.test",
    "http://192.168.1.2:3217",
    "file:///tmp/index.html",
    "http://user:pass@localhost:3217",
    "http://localhost:3217/de",
    "http://localhost:3217/?url=https://example.com",
    "http://localhost:3217/#hash",
  ])
    assert.throws(() => parseBaseUrl(["--base-url", url]));
  assert.throws(() => parseBaseUrl(["--base-url"]));
  assert.throws(() => parseBaseUrl(["--target", "http://localhost:3217"]));
  assert.throws(() =>
    parseBaseUrl(["--base-url", "http://localhost:3217", "--anything"]),
  );
});

test("raw HTML checker derives the complete current 12-locale, 8-route contract", () => {
  assert.equal(contract.locales.length, 12);
  assert.equal(contract.defaultLocale, "en");
  assert.equal(contract.htmlLanguages.zh, "zh-CN");
  assert.equal(contract.contentLanguages.de, "de-DE");
  assert.equal(contract.locales.length * seoPaths.length, 96);
  assert.equal(localizedPath("en", "/", contract), "/");
  assert.equal(localizedPath("de", "/", contract), "/de");
  assert.equal(
    localizedPath("zh", "/services/stage-1", contract),
    "/zh/services/stage-1",
  );
});

test("programmatic checker rejects an external target before build reads or fetch", async (t) => {
  const fetchSpy = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("No network request is allowed in this test.");
  });
  await assert.rejects(
    runCheck(new URL("https://file.mgautotech.de"), contract),
    /loopback/u,
  );
  assert.equal(fetchSpy.mock.callCount(), 0);
});

test("raw document inspection handles attribute order, casing and nested H1 text", () => {
  const document = inspectHtml(
    fixture({
      heading:
        "<span>ECU &amp; TCU</span> <span>Dateiservice &#252;berall</span>",
    }),
  );
  assert.equal(document.lang, "de");
  assert.equal(document.h1, "ECU & TCU Dateiservice überall");
  assert.doesNotThrow(() => validatePage(document, context, contract));
});

test("a hydration script cannot repair the raw opening HTML language in the checker", () => {
  const document = inspectHtml(
    fixture({
      lang: "en",
      extraBody: `<script>document.documentElement.lang = 'de'; const sample = '<html lang="de">';</script>`,
    }),
  );
  assert.equal(document.lang, "en");
  assert.throws(
    () => validatePage(document, context, contract),
    /Opening html lang mismatch/u,
  );
});

test("head-only canonical and hreflang checks reject wrong URLs, omissions and duplicates", () => {
  const document = inspectHtml(fixture());
  assert.throws(
    () => validatePage({ ...document, canonicals: [] }, context, contract),
    /Canonical/u,
  );
  assert.throws(
    () =>
      validatePage(
        { ...document, canonicals: [contract.siteUrl] },
        context,
        contract,
      ),
    /Canonical/u,
  );
  assert.throws(
    () =>
      validatePage(
        {
          ...document,
          canonicals: [...document.canonicals, ...document.canonicals],
        },
        context,
        contract,
      ),
    /Canonical/u,
  );
  assert.throws(
    () =>
      validatePage(
        { ...document, alternates: document.alternates.slice(1) },
        context,
        contract,
      ),
    /13 hreflang/u,
  );
  const duplicated = [...document.alternates];
  duplicated[1] = duplicated[0];
  assert.throws(
    () =>
      validatePage({ ...document, alternates: duplicated }, context, contract),
    /Duplicate hreflang/u,
  );
  const wrongUrl = document.alternates.map((link) =>
    link.hreflang === "de" ? { ...link, href: `${contract.siteUrl}/de` } : link,
  );
  assert.throws(
    () =>
      validatePage({ ...document, alternates: wrongUrl }, context, contract),
    /Hreflang URLs/u,
  );
  const withBodyLinks = inspectHtml(
    fixture({ extraBody: '<link rel="canonical" href="https://example.com">' }),
  );
  assert.doesNotThrow(() => validatePage(withBodyLinks, context, contract));
});

test("origin-only canonical URLs normalize without relaxing origin, path, query or hash", () => {
  const rootDocument = inspectHtml(fixture().replaceAll("/file-service", ""));
  assert.doesNotThrow(() =>
    validatePage(rootDocument, { ...context, path: "/" }, contract),
  );
  const document = inspectHtml(fixture());
  for (const href of [
    "https://example.com/de/file-service",
    `${contract.siteUrl}/de/file-service/`,
    `${contract.siteUrl}/de/file-service?wrong=1`,
    `${contract.siteUrl}/de/file-service#wrong`,
  ]) {
    assert.throws(
      () =>
        validatePage({ ...document, canonicals: [href] }, context, contract),
      /Canonical/u,
    );
    const alternates = document.alternates.map((link) =>
      link.hreflang === "de" ? { ...link, href } : link,
    );
    assert.throws(
      () => validatePage({ ...document, alternates }, context, contract),
      /Hreflang URLs/u,
    );
  }
});

test("404 diagnostics distinguish the preexisting framework shell without exempting 200 pages", () => {
  const fallback = inspectHtml(
    '<!doctype html><html id="__next_error__"><head><meta name="robots" content="noindex, nofollow"></head><body>404</body></html>',
  );
  assert.deepEqual(validateNotFound(fallback, 404, contract), {
    frameworkErrorShell: true,
    documentLanguage: null,
  });
  assert.throws(
    () => validateNotFound(fallback, 200, contract),
    /remain a 404/u,
  );
  assert.throws(
    () => validatePage(fallback, context, contract),
    /Opening html lang/u,
  );
  assert.throws(
    () => validateNotFound({ ...fallback, robots: [] }, 404, contract),
    /noindex/u,
  );
  assert.throws(
    () => validateNotFound({ ...fallback, htmlElementCount: 2 }, 404, contract),
    /single HTML/u,
  );
  assert.throws(
    () => validateNotFound({ ...fallback, bodyElementCount: 2 }, 404, contract),
    /single body/u,
  );
  assert.throws(
    () =>
      validateNotFound({ ...fallback, documentId: undefined }, 404, contract),
    /default language/u,
  );
  assert.doesNotThrow(() =>
    validateNotFound(
      { ...fallback, documentId: undefined, lang: "en" },
      404,
      contract,
    ),
  );
});

test("comments, scripts and template content cannot supply missing server content", () => {
  const fakeContent = "<main><h1>Faked content</h1></main>";
  const document =
    inspectHtml(`<!doctype html><html lang="de"><head></head><body>
    <!-- ${fakeContent} --><script>const html = '${fakeContent}';</script><template>${fakeContent}</template>
    </body></html>`);
  assert.equal(document.h1, "");
  assert.equal(document.main, "");
  assert.throws(
    () => inspectHtml('<body><html lang="de"><head></head></html></body>'),
    /Opening HTML/u,
  );
  assert.throws(
    () => inspectHtml(fixture().replace("LANG='de'", "LANG='de' lang='en'")),
    /Duplicate HTML attribute/u,
  );
});

test("raw page content and headers must be present and non-English duplicates are rejected", () => {
  const document = inspectHtml(fixture());
  assert.throws(
    () =>
      validatePage(
        document,
        { ...context, contentLanguage: "en-GB" },
        contract,
      ),
    /Content-Language/u,
  );
  assert.throws(
    () => validatePage({ ...document, h1: "" }, context, contract),
    /Main H1/u,
  );
  assert.throws(
    () => validatePage({ ...document, main: document.h1 }, context, contract),
    /Meaningful main/u,
  );
  assert.throws(
    () => validateLocalizedContent(document, document),
    /Localized H1/u,
  );
  assert.throws(
    () =>
      validateLocalizedContent(document, {
        ...document,
        h1: "English heading",
      }),
    /Localized main/u,
  );
  assert.doesNotThrow(() =>
    validateLocalizedContent(document, {
      h1: "English heading",
      main: "English content",
    }),
  );
});
