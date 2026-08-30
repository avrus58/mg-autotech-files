import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const switcher = readFileSync("src/components/LanguageSwitcher.tsx", "utf8");
const fixedPresentationLocale = readFileSync(
  "src/lib/fixedPresentationLocale.ts",
  "utf8",
);

test("runtime locale catalogs retry once and expose a recoverable accessible failure", () => {
  assert.match(
    switcher,
    /for \(let attempt = 0; attempt < 2; attempt \+= 1\)[\s\S]*?catch \(error\)[\s\S]*?localeCatalogRetryDelayMs/u
  );
  assert.match(
    switcher,
    /loadRuntimeTranslationCatalog\(pathname, targetLocale\)[\s\S]*?\.catch\(\(\) => \{[\s\S]*?setFailedLocale\(targetLocale\)/u
  );
  assert.match(switcher, /role="alert"/u);
  assert.match(switcher, /role="status"[\s\S]*?aria-live="polite"/u);
  assert.match(switcher, /onClick=\{retryFailedLocale\}/u);
});

test("runtime selection commits after translation while server navigation persists its explicit locale intent", () => {
  const selectionStart = switcher.indexOf("const chooseLocale = (");
  const selectionEnd = switcher.indexOf("const optionClassName", selectionStart);
  const selectionHandler = switcher.slice(selectionStart, selectionEnd);
  const loadStart = switcher.indexOf(
    "void loadRuntimeTranslationCatalog(pathname, targetLocale)"
  );
  const loadEnd = switcher.indexOf("useEffect(() => {", loadStart);
  const loadTransaction = switcher.slice(loadStart, loadEnd);
  const navigationBranch = selectionHandler.match(
    /if \(usesDocumentNavigation\) \{[\s\S]*?return;\s*\}/u
  )?.[0] ?? "";
  const runtimeSelection = selectionHandler.slice(
    selectionHandler.indexOf(navigationBranch) + navigationBranch.length
  );

  assert.ok(selectionStart >= 0 && selectionEnd > selectionStart);
  assert.match(navigationBranch, /persistLocale\(item\.code\)/u);
  assert.doesNotMatch(runtimeSelection, /persistLocale\(item\.code\)/u);
  assert.match(selectionHandler, /persistLocale\(locale\)/u);
  assert.match(selectionHandler, /setRequestedLocale\(item\.code\)/u);
  assert.ok(loadStart >= 0 && loadEnd > loadStart);
  assert.ok(
    loadTransaction.indexOf("translateNode(document.body, targetLocale, catalog)") <
      loadTransaction.indexOf("persistLocale(targetLocale)")
  );
  assert.match(
    loadTransaction,
    /\.catch\(\(\) => \{[\s\S]*?writeDocumentLocale\(locale\)[\s\S]*?setFailedLocale\(targetLocale\)/u
  );
  assert.doesNotMatch(
    loadTransaction.match(/\.catch\(\(\) => \{[\s\S]*?\n\s*\}\);/u)?.[0] ?? "",
    /persistLocale\(/u
  );
});

test("selection restores trigger focus and hidden authored routes reset document language", () => {
  assert.match(
    switcher,
    /const closeMenuAndRestoreFocus = \(\) => \{[\s\S]*?triggerRef\.current\?\.focus\(\)/u
  );
  assert.match(
    switcher,
    /const chooseLocale = \([\s\S]*?event\?: ReactMouseEvent<HTMLAnchorElement>[\s\S]*?\) => \{[\s\S]*?closeMenuAndRestoreFocus\(\)/u
  );
  assert.match(
    switcher,
    /hideSwitcher && !hiddenLocalizedFlow[\s\S]*?writeDocumentLocale\([\s\S]*?fixedPresentationLocaleBySegment[\s\S]*?\?\? defaultLocale/u
  );
  for (const segment of [
    "agb",
    "av-vertrag",
    "datenschutz",
    "impressum",
    "widerruf",
  ]) {
    assert.ok(
      fixedPresentationLocale.includes(`${segment}: "de"`) ||
        fixedPresentationLocale.includes(`${JSON.stringify(segment)}: "de"`),
      `${segment} must retain its authored German document language`
    );
  }
  assert.doesNotMatch(fixedPresentationLocale, /(?:admin|privacy|embed): "de"/u);
});

test("menu radio options support Space activation as well as arrow navigation", () => {
  assert.match(
    switcher,
    /if \(event\.key === " "\) \{[\s\S]*?event\.preventDefault\(\)[\s\S]*?items\[currentIndex\]\?\.click\(\)/u,
  );
});

test("nested widget billing routes load the reviewed widget catalog", () => {
  assert.match(
    switcher,
    /pathname === "\/dashboard\/widget" \|\|[\s\S]*?pathname\.startsWith\("\/dashboard\/widget\/"\)[\s\S]*?widget-site-translations/u
  );
});

test("server locale seeds the selector and canonical SSR routes skip the DOM catalog walk", () => {
  assert.match(
    switcher,
    /const \[locale, setLocale\] = useState<LocaleCode>\(externallySelectedLocale\)/u
  );
  assert.match(
    switcher,
    /const translatedLocaleRef = useRef<LocaleCode>\(externallySelectedLocale\)/u
  );
  assert.match(
    switcher,
    /const serverLocalizedWithoutDeferredRuntime =[\s\S]*?isServerLocalizedPublicPath\(pathname\) && !hasDeferredLocalizedHomepage/u
  );
});
