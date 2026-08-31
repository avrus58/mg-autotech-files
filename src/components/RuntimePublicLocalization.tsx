import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import type { LocaleCode } from "@/lib/i18nConfig";
import { ServerLocaleBoundary } from "@/components/ServerLocaleBoundary";
import { getLocalizedPublicHref } from "@/lib/i18nRoutes";
import {
  runtimePublicText,
  type RuntimePublicScope,
} from "@/lib/i18n/runtime-public";

const skippedElements = new Set(["script", "style", "code", "pre", "textarea"]);
const translatedAttributes = [
  "action",
  "alt",
  "aria-description",
  "aria-label",
  "description",
  "detail",
  "eyebrow",
  "heading",
  "label",
  "placeholder",
  "status",
  "text",
  "title",
  "value",
] as const;

function hasTranslationBoundary(props: Record<string, unknown>) {
  return (
    (props["data-no-translate"] !== undefined &&
      props["data-no-translate"] !== false) ||
    (props["data-language-switcher"] !== undefined &&
      props["data-language-switcher"] !== false) ||
    props.translate === "no"
  );
}

function localizeNode(
  node: ReactNode,
  locale: LocaleCode,
  scopes: readonly RuntimePublicScope[]
): ReactNode {
  if (locale === "en") return node;
  if (typeof node === "string") return runtimePublicText(locale, node, scopes);
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<Record<string, unknown>>;
  const props = element.props;
  const elementName = typeof element.type === "string" ? element.type : null;

  if (
    hasTranslationBoundary(props) ||
    (elementName !== null && skippedElements.has(elementName))
  ) {
    return node;
  }

  const nextProps: Record<string, unknown> = {};

  if ("children" in props) {
    nextProps.children = Children.map(props.children as ReactNode, (child) =>
      localizeNode(child, locale, scopes)
    );
  }

  for (const attribute of translatedAttributes) {
    const value = props[attribute];
    if (typeof value === "string") {
      nextProps[attribute] = runtimePublicText(locale, value, scopes);
    }
  }

  if (typeof props.href === "string") {
    nextProps.href = getLocalizedPublicHref(props.href, locale);
  }

  return cloneElement(element, nextProps);
}

export function RuntimePublicLocalization({
  children,
  locale,
  scopes,
}: {
  children?: ReactNode;
  locale: LocaleCode;
  scopes: readonly RuntimePublicScope[];
}) {
  return (
    <ServerLocaleBoundary locale={locale}>
      {localizeNode(children, locale, scopes)}
    </ServerLocaleBoundary>
  );
}
