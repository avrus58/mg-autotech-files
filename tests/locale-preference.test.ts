import assert from "node:assert/strict";
import test from "node:test";
import {
  dispatchLocaleChange,
  readLocaleCookie,
  readStoredLocale,
  writeDocumentLocale,
  writeLocaleCookies,
  writeStoredLocale,
} from "../src/lib/localePreference";
import { resolveClientLocale } from "../src/lib/useActiveLocale";

test("invalid higher-priority client preferences fall through without overwriting a valid locale", () => {
  assert.equal(
    resolveClientLocale({
      pathLocale: null,
      storedLocale: "xx",
      cookieLocale: "de",
      documentLocale: "en",
      browserLocale: "fr-FR",
    }),
    "de",
  );
  assert.equal(
    resolveClientLocale({
      pathLocale: null,
      storedLocale: "unsupported",
      cookieLocale: "invalid",
      documentLocale: "tr",
      browserLocale: "de-DE",
    }),
    "tr",
  );
  assert.equal(
    resolveClientLocale({
      pathLocale: "pt",
      storedLocale: "de",
      cookieLocale: "fr",
      documentLocale: "en",
      browserLocale: "tr-TR",
    }),
    "pt",
  );
});

test("locale preference access fails soft when browser storage and cookies are blocked", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

  const blockedStorage = {
    getItem() {
      throw new DOMException("Blocked", "SecurityError");
    },
    setItem() {
      throw new DOMException("Blocked", "SecurityError");
    },
  };
  const blockedDocument = {
    get cookie() {
      throw new DOMException("Blocked", "SecurityError");
    },
    set cookie(_value: string) {
      throw new DOMException("Blocked", "SecurityError");
    },
    documentElement: {
      set lang(_value: string) {
        throw new DOMException("Blocked", "SecurityError");
      },
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: blockedStorage,
      dispatchEvent() {
        throw new DOMException("Blocked", "SecurityError");
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: blockedDocument,
  });

  try {
    assert.equal(readStoredLocale(), null);
    assert.equal(readLocaleCookie(), null);
    assert.doesNotThrow(() => writeStoredLocale("de"));
    assert.doesNotThrow(() => writeLocaleCookies("de"));
    assert.doesNotThrow(() => writeDocumentLocale("de"));
    assert.doesNotThrow(() => dispatchLocaleChange("de"));
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else delete (globalThis as { document?: unknown }).document;
  }
});
