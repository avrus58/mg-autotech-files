import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AgbPage from "../src/app/agb/page";
import DatenschutzPage from "../src/app/datenschutz/page";
import ImpressumPage from "../src/app/impressum/page";
import PrivacyPage from "../src/app/privacy/page";
import WiderrufPage from "../src/app/widerruf/page";
import { LocalizedSeoFooter } from "../src/components/LocalizedSeoFooter";
import { supportedLocales } from "../src/lib/i18nConfig";
import {
  runtimePublicMetadataCopy,
  runtimePublicT,
} from "../src/lib/i18n/runtime-public";
import { companyAddress, organizationJsonLd } from "../src/lib/seo";

const expectedAddress = {
  streetAddress: "Saarstraße 4",
  postalCode: "71679",
  addressLocality: "Asperg",
  addressCountry: "DE",
};

test("every localized Organization uses the owner-confirmed current address", () => {
  assert.deepEqual(companyAddress, expectedAddress);
  for (const { code } of supportedLocales) {
    assert.deepEqual(organizationJsonLd(code).address, {
      "@type": "PostalAddress",
      ...expectedAddress,
    });
  }
});

test("server-rendered legal recipients share the current provider address", () => {
  for (const Page of [
    AgbPage,
    DatenschutzPage,
    ImpressumPage,
    PrivacyPage,
    WiderrufPage,
  ]) {
    const markup = renderToStaticMarkup(createElement(Page));
    assert.match(markup, /Saarstraße 4/);
    assert.match(markup, /71679(?:<!-- -->)?\s*(?:<!-- -->)?Asperg/);
    assert.doesNotMatch(markup, /Böckinger|70437/);
    assert.match(markup, /href="mailto:info@mgautotech\.de"/);
    assert.match(markup, /(?:1\. Oktober 2026|1 October 2026)/);
  }

  const withdrawal = renderToStaticMarkup(createElement(WiderrufPage));
  assert.equal((withdrawal.match(/Saarstraße 4/g) ?? []).length, 2);
  const legalNotice = renderToStaticMarkup(createElement(ImpressumPage));
  assert.equal((legalNotice.match(/Saarstraße 4/g) ?? []).length, 2);
});

test("all public footer languages render the same address and contact links", () => {
  for (const { code } of supportedLocales) {
    const markup = renderToStaticMarkup(
      createElement(LocalizedSeoFooter, { locale: code }),
    );
    assert.match(markup, /Saarstraße 4/);
    assert.match(markup, /71679(?:<!-- -->)?\s*(?:<!-- -->)?Asperg/);
    assert.doesNotMatch(markup, /Böckinger|70437/);
    assert.match(markup, /href="mailto:info@mgautotech\.de"/);
    assert.match(markup, /href="tel:\+4915151561670"/);
  }
});

test("Contact metadata and About location identify Asperg in all 12 languages", () => {
  const contactSource = readFileSync("src/app/contact/page.tsx", "utf8");
  const aboutSource = readFileSync("src/app/about/page.tsx", "utf8");
  const contactDescription = contactSource.match(
    /const description = "([^"]+)";/,
  )?.[1];
  const aboutLocation = aboutSource.match(
    />(MG AutoTech is operated by Melih Gokkaya[^<]+)</,
  )?.[1];
  assert.ok(contactDescription);
  assert.ok(aboutLocation);

  for (const { code } of supportedLocales) {
    const expectedCity = code === "ru"
      ? "Асперге"
      : code === "zh"
        ? "阿斯佩格"
        : "Asperg";
    const metadata = runtimePublicMetadataCopy(
      code,
      "Contact MG AutoTech",
      contactDescription,
      ["core"],
    );
    const location = runtimePublicT(code, aboutLocation, ["core"]);
    for (const text of [metadata.description, location]) {
      assert.ok(text.includes(expectedCity), `${code}: ${text}`);
      assert.doesNotMatch(
        text,
        /Stuttgart|Stoccarda|Estugarda|Stuttgarcie|Штутгарте|斯图加特|Shtutgart/,
      );
      assert.match(text, /ECU/);
      assert.match(text, /TCU/);
    }
    if (code !== "en") {
      assert.notEqual(metadata.description, contactDescription);
      assert.notEqual(location, aboutLocation);
    }
  }
});
