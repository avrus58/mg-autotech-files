"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import type { LocaleCode } from "@/lib/i18nConfig";

export type HomepageTranslationCatalog = {
  exact: Record<string, string>;
  terms: Record<string, string>;
};

type HomepageLocalizationValue = {
  locale: LocaleCode;
  catalog?: HomepageTranslationCatalog;
};

const HomepageLocalizationContext = createContext<HomepageLocalizationValue>({
  locale: "en",
});

const localizedHomepageRoutes = new Set(["/", "/file-service", "/how-it-works"]);
const localizedServiceSlugs = new Set([
  "stage-1",
  "dpf-off",
  "egr-off",
  "adblue-off",
  "dtc-off",
]);
const skippedElements = new Set(["script", "style", "code", "pre", "textarea"]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function translateHomepageText(
  value: string,
  catalog?: HomepageTranslationCatalog
) {
  if (!catalog) return value;

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) return value;

  const exact = catalog.exact[normalized];
  if (exact) return `${leading}${exact}${trailing}`;

  const directTerm =
    catalog.terms[normalized] ??
    Object.entries(catalog.terms).find(
      ([source]) => source.toLowerCase() === normalized.toLowerCase()
    )?.[1];

  if (directTerm) return `${leading}${directTerm}${trailing}`;

  const wordCount = normalized.match(/\p{L}+/gu)?.length ?? 0;
  if (wordCount > 6) return value;

  const replaced = Object.entries(catalog.terms)
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((text, [source, target]) => {
      const escaped = escapeRegExp(source);
      const prefix = /^\w/.test(source) ? "\\b" : "";
      const suffix = /\w$/.test(source) ? "\\b" : "";
      return text.replace(new RegExp(`${prefix}${escaped}${suffix}`, "gi"), target);
    }, normalized);

  return replaced === normalized
    ? value
    : `${leading}${replaced}${trailing}`;
}

export function localizeHomepageHref(href: string, locale: LocaleCode) {
  if (locale === "en" || !href.startsWith("/") || href.startsWith("//")) {
    return href;
  }

  const match = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!match) return href;

  const pathname = match[1] || "/";
  const suffix = `${match[2] ?? ""}${match[3] ?? ""}`;
  const serviceMatch = pathname.match(/^\/services\/([^/]+)\/?$/);
  const isLocalizedService = Boolean(
    serviceMatch?.[1] && localizedServiceSlugs.has(serviceMatch[1])
  );

  if (!localizedHomepageRoutes.has(pathname) && !isLocalizedService) {
    return href;
  }

  return pathname === "/"
    ? `/${locale}${suffix}`
    : `/${locale}${pathname}${suffix}`;
}

function hasLocalizationBoundary(props: Record<string, unknown>) {
  return (
    (props["data-no-translate"] !== undefined &&
      props["data-no-translate"] !== false) ||
    (props["data-language-switcher"] !== undefined &&
      props["data-language-switcher"] !== false)
  );
}

function localizeChildren(
  children: ReactNode,
  locale: LocaleCode,
  catalog?: HomepageTranslationCatalog
) {
  const values = Children.toArray(children);

  if (
    values.length > 0 &&
    values.every((child) =>
      typeof child === "string" || typeof child === "number"
    )
  ) {
    return translateHomepageText(values.join(""), catalog);
  }

  return Children.map(children, (child) =>
    localizeHomepageNode(child, locale, catalog)
  );
}

export function localizeHomepageNode(
  node: ReactNode,
  locale: LocaleCode,
  catalog?: HomepageTranslationCatalog
): ReactNode {
  if (locale === "en" || !catalog) return node;
  if (typeof node === "string") return translateHomepageText(node, catalog);
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<Record<string, unknown>>;
  const props = element.props;
  const elementName = typeof element.type === "string" ? element.type : null;

  if (
    hasLocalizationBoundary(props) ||
    (elementName !== null && skippedElements.has(elementName))
  ) {
    return node;
  }

  const nextProps: Record<string, unknown> = {};

  if ("children" in props) {
    nextProps.children = localizeChildren(props.children as ReactNode, locale, catalog);
  }

  for (const attribute of [
    "placeholder",
    "aria-label",
    "title",
    "alt",
    "label",
    "detail",
    "heading",
    "description",
    "action",
    "status",
    "suffix",
  ] as const) {
    const value = props[attribute];
    if (typeof value === "string") {
      nextProps[attribute] = translateHomepageText(value, catalog);
    }
  }

  if (typeof props.href === "string") {
    nextProps.href = localizeHomepageHref(props.href, locale);
  }

  return cloneElement(element, nextProps);
}

export function HomepageLocalizationProvider({
  locale,
  catalog,
  children,
}: HomepageLocalizationValue & { children: ReactNode }) {
  return (
    <HomepageLocalizationContext.Provider value={{ locale, catalog }}>
      {children}
    </HomepageLocalizationContext.Provider>
  );
}

export function LocalizedHomepageTree({ children }: { children: ReactNode }) {
  const { locale, catalog } = useContext(HomepageLocalizationContext);
  return <>{localizeHomepageNode(children, locale, catalog)}</>;
}
