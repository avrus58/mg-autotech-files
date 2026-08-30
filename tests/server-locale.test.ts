import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getServerLocale } from "../src/lib/serverLocale";

const root = process.cwd();

test("requestless metadata evaluation falls back to canonical English", async () => {
  assert.equal(await getServerLocale(), "en");
});

test("proxy resolves locale before rendering and the root document consumes it", () => {
  const proxy = fs.readFileSync(path.join(root, "src", "proxy.ts"), "utf8");
  const fixedPresentationLocale = fs.readFileSync(
    path.join(root, "src", "lib", "fixedPresentationLocale.ts"),
    "utf8",
  );
  const layout = fs.readFileSync(path.join(root, "src", "app", "layout.tsx"), "utf8");

  assert.match(proxy, /const pathLocale =/);
  assert.match(proxy, /getFixedPresentationLocale\(request\.nextUrl\.pathname\)/);
  assert.match(fixedPresentationLocale, /datenschutz: "de"/);
  assert.match(fixedPresentationLocale, /privacy: "en"/);
  assert.match(proxy, /pathLocale \?\?[\s\S]*authoredLocale \?\?/);
  assert.match(proxy, /requestHeaders\.set\("x-mg-locale", resolvedLocale\)/);
  assert.match(layout, /normalizeLocale\(\(await headers\(\)\)\.get\("x-mg-locale"\)\)/);
  assert.match(layout, /lang=\{hreflangByLocale\[locale\]\}/);
  assert.match(layout, /websiteJsonLd\(locale\)/);
  assert.match(layout, /<ActiveLocaleProvider initialLocale=\{locale\}>/);
  assert.doesNotMatch(layout, /lang=\{hreflangByLocale\[defaultLocale\]\}/);
});

test("client locale consumers hydrate from the same server-resolved locale", () => {
  const activeLocale = fs.readFileSync(
    path.join(root, "src", "lib", "useActiveLocale.ts"),
    "utf8"
  );

  assert.match(activeLocale, /createContext<LocaleCode \| null>\(null\)/);
  assert.match(activeLocale, /createElement\([\s\S]*InitialLocaleContext\.Provider[\s\S]*value: initialLocale/);
  assert.match(
    activeLocale,
    /useSyncExternalStore\([\s\S]*subscribe,[\s\S]*readLocale,[\s\S]*\(\) => initialLocale \?\? defaultLocale/,
  );
  assert.match(activeLocale, /export function useInitialLocale\(\)/);
});

test("root fallback metadata follows the server-resolved locale", () => {
  const layout = fs.readFileSync(path.join(root, "src", "app", "layout.tsx"), "utf8");

  assert.match(layout, /const copy = homeSeo\[locale\]/);
  assert.match(layout, /description: copy\.description/);
  assert.match(layout, /locale: openGraphLocaleByCode\[locale\]/);
});
