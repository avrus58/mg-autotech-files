import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import { customerOnboardingT } from "../src/lib/i18n/customer-onboarding-translations";

type Element = { type: unknown; props: Record<string, unknown> };
const compiled = ts.transpileModule(
  readFileSync("src/components/dashboard/CustomerOnboardingGuide.tsx", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function renderGuide(pathname: string, step: number, locale: LocaleCode = "en") {
  const exports: { CustomerOnboardingGuide?: () => Element } = {};
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const noop = () => undefined;
  const imports: Record<string, unknown> = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    react: { useRef: () => ({ current: null }) },
    "next/link": { __esModule: true, default: "link" },
    "next/navigation": { usePathname: () => pathname },
    "lucide-react": new Proxy({}, { get: (_target, name) => String(name) }),
    "@/hooks/useCustomerOnboarding": { useCustomerOnboarding: () => ({
      visible: true, saving: false, saveFailed: false, step,
      moveToStep: noop, dismiss: noop, retryDismiss: noop, hideForSession: noop,
    }) },
    "@/lib/useActiveLocale": { useActiveLocale: () => locale },
    "@/lib/i18n/customer-onboarding-translations": { customerOnboardingT },
  };
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected component dependency: ${name}`);
      return imports[name];
    },
  }, { timeout: 1000 });
  assert.ok(exports.CustomerOnboardingGuide);
  return exports.CustomerOnboardingGuide();
}

function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}

function text(node: unknown): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return node && typeof node === "object" && "props" in node
    ? text((node as Element).props.children)
    : "";
}

test("guide auxiliary actions retain the current request tab and announce new tabs in all locales", () => {
  for (const { code: locale } of supportedLocales) {
    for (const [step, href] of [[1, "/dashboard/credits"], [3, "/dashboard/orders?view=all"]] as const) {
      const link = elements(renderGuide("/new-request", step, locale)).find(({ type }) => type === "link");
      assert.ok(link, `${locale}: guide action is present`);
      assert.equal(link.props.href, href);
      assert.equal(link.props.target, "_blank");
      assert.equal(link.props.rel, "noopener noreferrer");
      assert.ok(text(link).includes(customerOnboardingT(locale, "Opens in a new tab")));
    }
  }
});

test("normal guide navigation and the current request action keep their existing same-tab behavior", () => {
  for (const [pathname, step] of [["/dashboard", 1], ["/dashboard/credits", 2], ["/dashboard/orders", 3], ["/new-request", 2]] as const) {
    const link = elements(renderGuide(pathname, step)).find(({ type }) => type === "link");
    assert.ok(link);
    assert.equal(link.props.target, undefined);
    assert.equal(link.props.rel, undefined);
    assert.ok(!text(link).includes("Opens in a new tab"));
  }
});
