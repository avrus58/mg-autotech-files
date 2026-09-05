"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { usePathname } from "next/navigation";
import {
  defaultLocale,
  normalizeLocale,
  supportedLocales,
  type LocaleCode,
} from "@/lib/i18nConfig";
import {
  appendSafeQuery,
  getInitialLocaleRedirect,
  getLocalizedPublicPath,
  isServerLocalizedPublicPath,
  requiresServerLocaleRefresh,
  resolvePreferredLocale,
} from "@/lib/i18nRoutes";
import {
  dispatchLocaleChange,
  readLocaleCookie,
  readStoredLocale,
  writeDocumentLocale,
  writeLocaleCookies,
  writeStoredLocale,
} from "@/lib/localePreference";
import { isSeoLocale } from "@/lib/seo";
import { useActiveLocale } from "@/lib/useActiveLocale";
import {
  customerWorkflowClientGroupForPath,
  customerWorkflowManagedRouteSegments,
} from "@/lib/i18n/customer-workflow-client-routes";
import {
  createCanonicalSourceAccumulator,
  registerCanonicalSource,
  registerCanonicalVariant,
  translateRuntimeExactText,
  type CanonicalSourceAccumulator,
  type RuntimeTranslationCatalog,
} from "@/lib/i18n/runtime-exact-translation";
import { fixedPresentationLocaleBySegment } from "@/lib/fixedPresentationLocale";

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();
const appliedText = new WeakMap<Text, string>();
const appliedAttributes = new WeakMap<Element, Record<string, string>>();
const translatedAttributeNames = [
  "alt",
  "aria-description",
  "aria-label",
  "aria-roledescription",
  "content",
  "placeholder",
  "title",
] as const;

export const selectorCopy: Record<
  LocaleCode,
  {
    label: string;
    change: string;
    switchTo: string;
    loading: string;
    failed: string;
    retry: string;
  }
> = {
  nl: {
    label: "Taal",
    change: "Taal wijzigen",
    switchTo: "Overschakelen naar",
    loading: "Taal wordt geladen…",
    failed: "Deze taal kon niet worden geladen. Uw huidige taal blijft actief.",
    retry: "Opnieuw proberen",
  },
  en: {
    label: "Language",
    change: "Change language",
    switchTo: "Switch language to",
    loading: "Loading language…",
    failed: "This language could not be loaded. Your current language remains active.",
    retry: "Try again",
  },
  de: {
    label: "Sprache",
    change: "Sprache ändern",
    switchTo: "Sprache wechseln zu",
    loading: "Sprache wird geladen…",
    failed: "Diese Sprache konnte nicht geladen werden. Ihre aktuelle Sprache bleibt aktiv.",
    retry: "Erneut versuchen",
  },
  fr: {
    label: "Langue",
    change: "Changer de langue",
    switchTo: "Passer en",
    loading: "Chargement de la langue…",
    failed: "Cette langue n’a pas pu être chargée. Votre langue actuelle reste active.",
    retry: "Réessayer",
  },
  it: {
    label: "Lingua",
    change: "Cambia lingua",
    switchTo: "Passa a",
    loading: "Caricamento della lingua…",
    failed: "Impossibile caricare questa lingua. La lingua attuale rimane attiva.",
    retry: "Riprova",
  },
  ru: {
    label: "Язык",
    change: "Изменить язык",
    switchTo: "Переключить на",
    loading: "Загрузка языка…",
    failed: "Не удалось загрузить этот язык. Текущий язык останется активным.",
    retry: "Повторить",
  },
  es: {
    label: "Idioma",
    change: "Cambiar idioma",
    switchTo: "Cambiar a",
    loading: "Cargando idioma…",
    failed: "No se pudo cargar este idioma. El idioma actual seguirá activo.",
    retry: "Reintentar",
  },
  tr: {
    label: "Dil",
    change: "Dili değiştir",
    switchTo: "Şu dile geç",
    loading: "Dil yükleniyor…",
    failed: "Bu dil yüklenemedi. Mevcut diliniz etkin kalacak.",
    retry: "Tekrar dene",
  },
  pt: {
    label: "Idioma",
    change: "Alterar idioma",
    switchTo: "Mudar para",
    loading: "A carregar o idioma…",
    failed: "Não foi possível carregar este idioma. O idioma atual continuará ativo.",
    retry: "Tentar novamente",
  },
  zh: {
    label: "语言",
    change: "更改语言",
    switchTo: "切换为",
    loading: "正在加载语言…",
    failed: "无法加载此语言。当前语言将保持不变。",
    retry: "重试",
  },
  pl: {
    label: "Język",
    change: "Zmień język",
    switchTo: "Przełącz na",
    loading: "Ładowanie języka…",
    failed: "Nie udało się wczytać tego języka. Obecny język pozostanie aktywny.",
    retry: "Spróbuj ponownie",
  },
  sq: {
    label: "Gjuha",
    change: "Ndrysho gjuhën",
    switchTo: "Kalo në",
    loading: "Gjuha po ngarkohet…",
    failed: "Kjo gjuhë nuk mund të ngarkohej. Gjuha aktuale do të mbetet aktive.",
    retry: "Provo përsëri",
  },
};

const authoredOrPrivateSegments = new Set([
  "admin",
  "agb",
  "api",
  "av-vertrag",
  "datenschutz",
  "embed",
  "impressum",
  "measurement",
  "privacy",
  "widerruf",
]);

const localeCatalogRetryDelayMs = 180;

function subscribeToLocationSearch(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function readLocationSearch() {
  return window.location.search;
}

function readServerLocationSearch() {
  return "";
}

function readLocationHash() {
  return window.location.hash;
}

type TranslationCatalog = RuntimeTranslationCatalog;

type TupleTranslationCatalog = Record<string, readonly string[]>;

type CompactCustomerWorkflowCatalog = {
  customerWorkflowLocaleOrder: readonly Exclude<LocaleCode, "en">[];
  customerWorkflowExactTranslations: TupleTranslationCatalog;
};

const publicSurfaceSegments = new Set([
  "about",
  "brands",
  "contact",
  "download",
  "ecu-platforms",
  "services",
  "tools",
  "widget",
  "workshop-guides",
]);

const customerWorkflowSegments = new Set(customerWorkflowManagedRouteSegments);

function emptyExactCatalog(): Record<LocaleCode, Record<string, string>> {
  return Object.fromEntries(
    supportedLocales.map(({ code }) => [code, {}])
  ) as Record<LocaleCode, Record<string, string>>;
}

function registerTupleCatalog(
  target: Record<LocaleCode, Record<string, string>>,
  localeOrder: readonly Exclude<LocaleCode, "en">[],
  translations: TupleTranslationCatalog,
  activeLocale: LocaleCode,
  canonicalSources: CanonicalSourceAccumulator,
) {
  const localeIndex =
    activeLocale === "en" ? -1 : localeOrder.indexOf(activeLocale);

  Object.entries(translations).forEach(([source, values]) => {
    registerCanonicalSource(canonicalSources, source);
    values.forEach((variant) => {
      if (variant?.trim()) {
        registerCanonicalVariant(canonicalSources, source, variant);
      }
    });

    if (localeIndex < 0) return;
    const translated = values[localeIndex];
    if (translated?.trim()) target[activeLocale][source] = translated;
  });
}

async function loadCompactCustomerWorkflowCatalog(pathname: string) {
  const group = customerWorkflowClientGroupForPath(pathname);
  if (!group) return null;

  let catalogs: CompactCustomerWorkflowCatalog[];
  switch (group) {
    case "auth":
      catalogs = await Promise.all([
        import("@/lib/i18n/customer-workflow-auth-translations"),
        import("@/lib/i18n/customer-workflow-auth-dom-translations"),
      ]);
      break;
    case "overview":
      catalogs = await Promise.all([
        import("@/lib/i18n/customer-workflow-overview-translations"),
        import("@/lib/i18n/customer-workflow-overview-dom-translations"),
        import("@/lib/i18n/customer-workflow-portal-common-translations"),
      ]);
      break;
    case "request":
      catalogs = await Promise.all([
        import("@/lib/i18n/customer-workflow-request-translations"),
        import("@/lib/i18n/customer-workflow-request-dom-translations"),
        import("@/lib/i18n/customer-workflow-portal-common-translations"),
      ]);
      break;
    case "credits":
      catalogs = await Promise.all([
        import("@/lib/i18n/customer-workflow-credits-translations"),
        import("@/lib/i18n/customer-workflow-credits-dom-translations"),
        import("@/lib/i18n/customer-workflow-portal-common-translations"),
      ]);
      break;
    case "file-expert":
      catalogs = await Promise.all([
        import("@/lib/i18n/customer-workflow-file-expert-translations"),
        import("@/lib/i18n/customer-workflow-file-expert-dom-translations"),
        import("@/lib/i18n/customer-workflow-portal-common-translations"),
      ]);
      break;
    case "orders":
      catalogs = await Promise.all([
        import("@/lib/i18n/customer-workflow-orders-translations"),
        import("@/lib/i18n/customer-workflow-orders-dom-translations"),
        import("@/lib/i18n/customer-workflow-portal-common-translations"),
      ]);
      break;
    case "notifications":
      catalogs = await Promise.all([
        import("@/lib/i18n/customer-workflow-notifications-translations"),
        import("@/lib/i18n/customer-workflow-notifications-dom-translations"),
        import("@/lib/i18n/customer-workflow-portal-common-translations"),
      ]);
      break;
    case "portal":
      catalogs = [
        await import("@/lib/i18n/customer-workflow-portal-common-translations"),
      ];
      break;
    case "security":
      catalogs = await Promise.all([
        import("@/lib/i18n/customer-workflow-security-translations"),
        import("@/lib/i18n/customer-workflow-security-dom-translations"),
        import("@/lib/i18n/customer-workflow-portal-common-translations"),
      ]);
      break;
    case "widget": {
      const [widgetDom, portalCommon, widgetSite] = await Promise.all([
        import("@/lib/i18n/customer-workflow-widget-dom-translations"),
        import("@/lib/i18n/customer-workflow-portal-common-translations"),
        import("@/lib/i18n/widget-site-translations"),
      ]);
      catalogs = [
        widgetDom,
        portalCommon,
        {
          customerWorkflowLocaleOrder: widgetSite.widgetSiteLocaleOrder,
          customerWorkflowExactTranslations:
            widgetSite.widgetSiteExactTranslations,
        },
      ];
      break;
    }
  }

  // Dashboard subroutes inherit their title and description from the dashboard
  // layout even when their visible copy uses a different compact route group.
  // Keep the tiny shared metadata rows in every dashboard transaction so the
  // head can move between any two locales without reloading or discarding form
  // state.
  let metadataCatalog: CompactCustomerWorkflowCatalog | null = null;
  if (pathname.startsWith("/dashboard")) {
    metadataCatalog = await import(
      "@/lib/i18n/customer-workflow-private-metadata-translations"
    );
    catalogs.push(metadataCatalog);
  }

  return { catalogs, metadataCatalog };
}

async function loadScopedExactTranslations(
  pathname: string,
  locale: LocaleCode,
  canonicalSources: CanonicalSourceAccumulator,
) {
  const scoped = emptyExactCatalog();
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const unprefixedSegment = isSeoLocale(firstSegment)
    ? pathname.split("/").filter(Boolean)[1] ?? ""
    : firstSegment;

  if (publicSurfaceSegments.has(unprefixedSegment)) {
    const [{ publicSurfaceLocaleOrder }, { publicCoreTranslations }] = await Promise.all([
      import("@/lib/i18n/public-surface-types"),
      import("@/lib/i18n/public-core-translations"),
    ]);
    registerTupleCatalog(
      scoped,
      publicSurfaceLocaleOrder,
      publicCoreTranslations,
      locale,
      canonicalSources,
    );
  }

  if (unprefixedSegment === "brands" || unprefixedSegment === "ecu-platforms") {
    const [{ publicSurfaceLocaleOrder }, { publicVehicleTranslations }] = await Promise.all([
      import("@/lib/i18n/public-surface-types"),
      import("@/lib/i18n/public-vehicle-translations"),
    ]);
    registerTupleCatalog(
      scoped,
      publicSurfaceLocaleOrder,
      publicVehicleTranslations,
      locale,
      canonicalSources,
    );
  }

  if (unprefixedSegment === "services") {
    const [{ publicSurfaceLocaleOrder }, { publicServicesTranslations }] = await Promise.all([
      import("@/lib/i18n/public-surface-types"),
      import("@/lib/i18n/public-services-translations"),
    ]);
    registerTupleCatalog(
      scoped,
      publicSurfaceLocaleOrder,
      publicServicesTranslations,
      locale,
      canonicalSources,
    );
  }

  if (unprefixedSegment === "tools") {
    const [{ publicSurfaceLocaleOrder }, { publicToolsTranslations }] = await Promise.all([
      import("@/lib/i18n/public-surface-types"),
      import("@/lib/i18n/public-tools-translations"),
    ]);
    registerTupleCatalog(
      scoped,
      publicSurfaceLocaleOrder,
      publicToolsTranslations,
      locale,
      canonicalSources,
    );
  }

  if (unprefixedSegment === "services") {
    const { serviceIntentLocaleOrder, serviceIntentExactTranslations } = await import(
      "@/lib/i18n/service-intent-translations"
    );
    registerTupleCatalog(
      scoped,
      serviceIntentLocaleOrder,
      serviceIntentExactTranslations,
      locale,
      canonicalSources,
    );
  }

  if (unprefixedSegment === "workshop-guides") {
    const { workshopGuideLocaleOrder, workshopGuideExactTranslations } = await import(
      "@/lib/i18n/workshop-guides-translations"
    );
    registerTupleCatalog(
      scoped,
      workshopGuideLocaleOrder,
      workshopGuideExactTranslations,
      locale,
      canonicalSources,
    );
  }

  if (customerWorkflowSegments.has(unprefixedSegment)) {
    const {
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations,
    } = await import("@/lib/i18n/customer-workflow-translations");
    registerTupleCatalog(
      scoped,
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations,
      locale,
      canonicalSources,
    );
  }

  if (
    unprefixedSegment === "widget" ||
    pathname === "/dashboard/widget" ||
    pathname.startsWith("/dashboard/widget/")
  ) {
    const {
      widgetSiteLocaleOrder,
      widgetSiteExactTranslations,
    } = await import("@/lib/i18n/widget-site-translations");
    registerTupleCatalog(
      scoped,
      widgetSiteLocaleOrder,
      widgetSiteExactTranslations,
      locale,
      canonicalSources,
    );
  }

  return scoped;
}

async function loadRuntimeTranslationCatalog(
  pathname: string,
  locale: LocaleCode
): Promise<TranslationCatalog> {
  let latestError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const compactCustomerWorkflow =
        await loadCompactCustomerWorkflowCatalog(pathname);
      if (compactCustomerWorkflow) {
        const supplementalExact = emptyExactCatalog();
        const canonicalSources = createCanonicalSourceAccumulator();
        compactCustomerWorkflow.catalogs.forEach((catalog) => {
          registerTupleCatalog(
            supplementalExact,
            catalog.customerWorkflowLocaleOrder,
            catalog.customerWorkflowExactTranslations,
            locale,
            canonicalSources,
          );
        });
        const metadataCanonicalSources = createCanonicalSourceAccumulator();
        if (compactCustomerWorkflow.metadataCatalog) {
          registerTupleCatalog(
            emptyExactCatalog(),
            compactCustomerWorkflow.metadataCatalog.customerWorkflowLocaleOrder,
            compactCustomerWorkflow.metadataCatalog
              .customerWorkflowExactTranslations,
            locale,
            metadataCanonicalSources,
          );
        }
        return {
          exact: emptyExactCatalog(),
          supplementalExact,
          terms: emptyExactCatalog(),
          canonicalSources: canonicalSources.lookup,
          metadataCanonicalSources: metadataCanonicalSources.lookup,
        };
      }

      const { exactTranslations, termTranslations } = await import("@/lib/i18n");
      const canonicalSources = createCanonicalSourceAccumulator();
      const supplementalExact = await loadScopedExactTranslations(
        pathname,
        locale,
        canonicalSources,
      );

      return {
        exact: exactTranslations,
        supplementalExact,
        terms: termTranslations,
        canonicalSources: canonicalSources.lookup,
        metadataCanonicalSources: {},
      };
    } catch (error) {
      latestError = error;
      if (attempt === 0) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, localeCatalogRetryDelayMs);
        });
      }
    }
  }

  throw latestError instanceof Error
    ? latestError
    : new Error("Locale catalog could not be loaded.");
}

function getInitialLocale(pathname: string) {
  if (typeof window === "undefined") return defaultLocale;

  return resolvePreferredLocale({
    pathname,
    storedLocale: readStoredLocale(),
    cookieLocale: readLocaleCookie(),
    browserLocale: window.navigator.language,
  });
}

function getPathLocale(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment && isSeoLocale(firstSegment) ? firstSegment : null;
}

function persistLocale(locale: LocaleCode) {
  writeStoredLocale(locale);
  writeLocaleCookies(locale);
  writeDocumentLocale(locale);
  dispatchLocaleChange(locale);
}

function observeLocaleMutations(
  locale: LocaleCode,
  catalog: TranslationCatalog
) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        translateTextNode(mutation.target as Text, locale, catalog);
        return;
      }

      if (mutation.type === "attributes") {
        translateElementAttributes(mutation.target as Element, locale, catalog);
        return;
      }

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && !shouldSkip(node)) {
          translateTextNode(node as Text, locale, catalog);
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          translateElementAttributes(element, locale, catalog);
          translateNode(element, locale, catalog);
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    attributeFilter: [...translatedAttributeNames],
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });

  return observer;
}

function translateText(
  value: string,
  locale: LocaleCode,
  catalog: TranslationCatalog,
  scope: "content" | "metadata" = "content",
) {
  return translateRuntimeExactText(value, locale, catalog, scope);
}

function shouldSkip(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;

  return Boolean(
    parent.closest(
      'script, style, code, pre, textarea, [contenteditable="true"], [translate="no"], [data-no-translate], [data-language-switcher]'
    )
  );
}

function translateTextNode(
  node: Text,
  locale: LocaleCode,
  catalog: TranslationCatalog
) {
  if (shouldSkip(node)) return;

  const current = node.nodeValue ?? "";
  const lastApplied = appliedText.get(node);
  if (!originalText.has(node) || (lastApplied !== undefined && current !== lastApplied)) {
    originalText.set(node, current);
  }

  const scope = node.parentElement?.closest("head") ? "metadata" : "content";
  const next = translateText(
    originalText.get(node) ?? current,
    locale,
    catalog,
    scope,
  );
  appliedText.set(node, next);
  if (next !== current) node.nodeValue = next;
}

function translateElementAttributes(
  element: Element,
  locale: LocaleCode,
  catalog: TranslationCatalog
) {
  if (
    element.closest(
      '[translate="no"], [data-no-translate], [data-language-switcher]'
    )
  ) return;

  const originals = originalAttributes.get(element) ?? {};
  const lastApplied = appliedAttributes.get(element) ?? {};
  const nextApplied = { ...lastApplied };

  translatedAttributeNames.forEach((attr) => {
    const current = element.getAttribute(attr);
    if (!current) return;

    if (!originals[attr] || (lastApplied[attr] !== undefined && current !== lastApplied[attr])) {
      originals[attr] = current;
    }

    const scope = element.closest("head") ? "metadata" : "content";
    const next = translateText(originals[attr], locale, catalog, scope);
    nextApplied[attr] = next;
    if (next !== current) element.setAttribute(attr, next);
  });

  originalAttributes.set(element, originals);
  appliedAttributes.set(element, nextApplied);
}

function translateNode(
  root: ParentNode,
  locale: LocaleCode,
  catalog: TranslationCatalog
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!shouldSkip(node)) textNodes.push(node);
  }

  textNodes.forEach((node) => translateTextNode(node, locale, catalog));

  const selector = translatedAttributeNames.map((attr) => `[${attr}]`).join(", ");
  root.querySelectorAll?.(selector).forEach((element) => {
    translateElementAttributes(element, locale, catalog);
  });
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const externallySelectedLocale = useActiveLocale();
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const pageOwnsDocumentLocale =
    pathname.startsWith("/embed/") ||
    pathname === "/auth/complete-profile";
  const hideSwitcher =
    pageOwnsDocumentLocale ||
    authoredOrPrivateSegments.has(firstSegment) ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/desktop-auth/");
  const hiddenLocalizedFlow =
    pathname === "/auth/callback" ||
    pathname.startsWith("/desktop-auth/") ||
    pathname.startsWith("/embed/") ||
    pathname.startsWith("/measurement/");
  const [locale, setLocale] = useState<LocaleCode>(externallySelectedLocale);
  const [requestedLocale, setRequestedLocale] = useState<LocaleCode | null>(null);
  const [localeResolved, setLocaleResolved] = useState(false);
  const [isLocaleLoading, setIsLocaleLoading] = useState(false);
  const [failedLocale, setFailedLocale] = useState<LocaleCode | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const currentSearch = useSyncExternalStore(
    subscribeToLocationSearch,
    readLocationSearch,
    readServerLocationSearch
  );
  const currentHash = useSyncExternalStore(
    subscribeToLocationSearch,
    readLocationHash,
    readServerLocationSearch
  );
  const [isOpen, setIsOpen] = useState(false);
  const translatedLocaleRef = useRef<LocaleCode>(externallySelectedLocale);
  const activeCatalogRef = useRef<TranslationCatalog | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // The embedded selector owns a product language chosen through `lang`,
    // while profile completion is already request-localized by its boundary.
    // Do not overwrite either document or mutate the saved site preference.
    if (pageOwnsDocumentLocale) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      activeCatalogRef.current = null;
      return;
    }

    if (hideSwitcher && !hiddenLocalizedFlow) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      activeCatalogRef.current = null;
      writeDocumentLocale(
        fixedPresentationLocaleBySegment[
          firstSegment as keyof typeof fixedPresentationLocaleBySegment
        ] ?? defaultLocale
      );
      return;
    }

    const pathLocale = getPathLocale(pathname);
    const preferredLocale = pathLocale ?? getInitialLocale(pathname);
    const currentLocale =
      pathLocale ?? normalizeLocale(document.documentElement.lang || defaultLocale);

    if (hideSwitcher) {
      persistLocale(preferredLocale);
      return;
    }

    const localizedTarget = getInitialLocaleRedirect(pathname, preferredLocale);
    if (localizedTarget) {
      window.location.replace(
        `${localizedTarget}${window.location.search}${window.location.hash}`
      );
      return;
    }

    // A canonical single-path public page is already localized by the server.
    // If localStorage and the server cookie got out of sync, reconcile the
    // explicit browser preference first and request one fresh SSR document.
    // Reloading preserves any paid-click query so the consent handoff remains
    // intact; the updated cookie prevents a second reload.
    if (requiresServerLocaleRefresh(pathname, currentLocale, preferredLocale)) {
      persistLocale(preferredLocale);
      window.location.reload();
      return;
    }

    const resolveTimer = window.setTimeout(() => {
      translatedLocaleRef.current = currentLocale;
      setLocale(currentLocale);
      setRequestedLocale(preferredLocale);
      setFailedLocale(null);
      setIsLocaleLoading(
        preferredLocale !== defaultLocale || currentLocale !== defaultLocale
      );
      setLocaleResolved(true);
    }, 0);

    return () => window.clearTimeout(resolveTimer);
  }, [firstSegment, hiddenLocalizedFlow, hideSwitcher, pageOwnsDocumentLocale, pathname]);

  useEffect(() => {
    if (
      hideSwitcher ||
      !localeResolved ||
      externallySelectedLocale === locale
    ) return;

    const syncTimer = window.setTimeout(() => {
      setRequestedLocale((current) =>
        current === externallySelectedLocale ? current : externallySelectedLocale
      );
      setFailedLocale(null);
      setIsLocaleLoading(true);
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [externallySelectedLocale, hideSwitcher, locale, localeResolved]);

  useEffect(() => {
    if (!localeResolved || hideSwitcher || requestedLocale === null) return;

    const targetLocale = requestedLocale;

    // Locale-prefixed SEO routes render translated content on the server. The
    // unified homepage also contains deferred interactive tools, so keep the
    // observer available there to translate content mounted after hydration.
    const hasDeferredLocalizedHomepage = Boolean(
      document.querySelector("[data-unified-localized-homepage]")
    );
    const serverLocalizedWithoutDeferredRuntime =
      isServerLocalizedPublicPath(pathname) && !hasDeferredLocalizedHomepage;
    const untouchedDefaultContent =
      targetLocale === defaultLocale &&
      translatedLocaleRef.current === defaultLocale;

    if (serverLocalizedWithoutDeferredRuntime || untouchedDefaultContent) {
      const commitTimer = window.setTimeout(() => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        activeCatalogRef.current = null;
        translatedLocaleRef.current = targetLocale;
        persistLocale(targetLocale);
        setLocale(targetLocale);
        setRequestedLocale((current) =>
          current === targetLocale ? null : current
        );
        setFailedLocale(null);
        setIsLocaleLoading(false);
      }, 0);

      return () => window.clearTimeout(commitTimer);
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      void loadRuntimeTranslationCatalog(pathname, targetLocale)
        .then((catalog) => {
          if (cancelled) return;

          const previousObserver = observerRef.current;
          previousObserver?.disconnect();

          try {
            translateNode(document.head, targetLocale, catalog);
            translateNode(document.body, targetLocale, catalog);
            observerRef.current =
              targetLocale === defaultLocale
                ? null
                : observeLocaleMutations(targetLocale, catalog);
          } catch (error) {
            const rollbackCatalog = activeCatalogRef.current ?? catalog;
            try {
              translateNode(document.head, locale, rollbackCatalog);
              translateNode(document.body, locale, rollbackCatalog);
              observerRef.current =
                locale === defaultLocale
                  ? null
                  : observeLocaleMutations(locale, rollbackCatalog);
            } catch {
              observerRef.current = null;
            }
            throw error;
          }

          activeCatalogRef.current = catalog;
          translatedLocaleRef.current = targetLocale;
          persistLocale(targetLocale);
          setLocale(targetLocale);
          setRequestedLocale((current) =>
            current === targetLocale ? null : current
          );
          setFailedLocale(null);
          setIsLocaleLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          writeDocumentLocale(locale);
          setRequestedLocale((current) =>
            current === targetLocale ? null : current
          );
          setFailedLocale(targetLocale);
          setIsLocaleLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hideSwitcher, locale, localeResolved, pathname, requestedLocale, retryAttempt]);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = window.setTimeout(() => {
      const active = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitemradio"][aria-checked="true"]'
      );
      active?.focus();
    }, 0);

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-language-switcher]")) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const activeLocale = useMemo(
    () =>
      supportedLocales.find((item) => item.code === locale) ??
      supportedLocales.find((item) => item.code === defaultLocale) ??
      supportedLocales[0],
    [locale]
  );
  const currentSelectorCopy = selectorCopy[locale];
  if (hideSwitcher) return null;

  // The root layout stays static so localized public pages can be prerendered.
  // Until hydration reads the route-level document language, render a neutral
  // control instead of briefly claiming that English is active.
  if (!localeResolved) {
    return (
      <div
        data-language-switcher
        data-language-switcher-pending
        aria-hidden="true"
        className="fixed bottom-4 right-4 z-[80] flex h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-[#111720]/95 px-3 text-base text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <span aria-hidden="true">🌐</span>
      </div>
    );
  }

  const closeMenuAndRestoreFocus = () => {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const retryFailedLocale = () => {
    if (!failedLocale) return;
    setFailedLocale(null);
    setRequestedLocale(failedLocale);
    setIsLocaleLoading(true);
    setRetryAttempt((attempt) => attempt + 1);
    closeMenuAndRestoreFocus();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!menuRef.current) return;
    const items = [...menuRef.current.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      items[currentIndex]?.click();
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1 + items.length) % items.length
            : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div
      data-language-switcher
      className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2"
      aria-label={currentSelectorCopy.label}
      aria-busy={isLocaleLoading}
    >
      {isOpen && (
        <div
          ref={menuRef}
          id="mg-language-menu"
          role="menu"
          aria-label={currentSelectorCopy.label}
          onKeyDown={handleMenuKeyDown}
          className="grid max-h-[min(31rem,68vh)] w-56 overflow-y-auto rounded-2xl border border-white/10 bg-[#111720]/98 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          {supportedLocales.map((item) => {
            const localizedTarget = getLocalizedPublicPath(pathname, item.code);
            const canNavigate = localizedTarget !== pathname;
            const requiresServerRefresh = requiresServerLocaleRefresh(
              pathname,
              locale,
              item.code
            );
            const usesDocumentNavigation = canNavigate || requiresServerRefresh;
            const target = usesDocumentNavigation
              ? `${appendSafeQuery(localizedTarget, currentSearch)}${currentHash}`
              : localizedTarget;
            const chooseLocale = (
              event?: ReactMouseEvent<HTMLAnchorElement>
            ) => {
              setFailedLocale(null);
              closeMenuAndRestoreFocus();

              if (usesDocumentNavigation) {
                // A server-rendered locale route does not need the runtime
                // catalog transaction. Persist the explicit navigation intent
                // before leaving so the prefixless English route cannot bounce
                // back to a stale non-English cookie/localStorage preference.
                persistLocale(item.code);
                setRequestedLocale(null);
                setIsLocaleLoading(false);

                if (requiresServerRefresh) {
                  event?.preventDefault();
                  const currentTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                  if (currentTarget === target) {
                    window.location.reload();
                  } else {
                    window.location.assign(target);
                  }
                }
                return;
              }

              if (item.code === locale) {
                setRequestedLocale(null);
                setIsLocaleLoading(false);
                persistLocale(locale);
                return;
              }

              setRequestedLocale(item.code);
              setIsLocaleLoading(true);
            };
            const optionClassName = `flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-red-400 ${
              item.code === locale
                ? "bg-red-600 text-white"
                : "text-zinc-200 hover:bg-white/10"
            }`;
            return usesDocumentNavigation ? (
              <a
                key={item.code}
                href={target}
                data-mg-locale-intent={item.code}
                onClick={chooseLocale}
                className={optionClassName}
                title={item.name}
                role="menuitemradio"
                aria-checked={item.code === locale}
                aria-label={`${currentSelectorCopy.switchTo} ${item.name}`}
              >
                <span aria-hidden="true" className="text-base">{item.flag}</span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-[10px] uppercase text-white/55">{item.label}</span>
              </a>
            ) : (
              <button
                key={item.code}
                type="button"
                onClick={() => chooseLocale()}
                className={optionClassName}
                title={item.name}
                role="menuitemradio"
                aria-checked={item.code === locale}
                aria-label={`${currentSelectorCopy.switchTo} ${item.name}`}
              >
                <span aria-hidden="true" className="text-base">{item.flag}</span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-[10px] uppercase text-white/55">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {isLocaleLoading && (
        <div
          role="status"
          aria-live="polite"
          className="max-w-72 rounded-xl border border-white/10 bg-[#111720]/98 px-4 py-3 text-xs font-bold text-zinc-200 shadow-xl shadow-black/40 backdrop-blur-xl"
        >
          {currentSelectorCopy.loading}
        </div>
      )}
      {failedLocale && !isLocaleLoading && (
        <div
          role="alert"
          className="max-w-72 rounded-xl border border-red-500/35 bg-[#1a1115]/98 px-4 py-3 text-xs font-bold text-zinc-100 shadow-xl shadow-black/40 backdrop-blur-xl"
        >
          <p>{currentSelectorCopy.failed}</p>
          <button
            type="button"
            onClick={retryFailedLocale}
            className="mt-2 rounded-lg border border-red-400/35 px-3 py-1.5 text-[11px] font-black text-red-200 outline-none transition hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400"
          >
            {currentSelectorCopy.retry}
          </button>
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-[#111720]/95 px-3 text-xs font-black text-white shadow-2xl shadow-black/40 backdrop-blur-xl transition hover:border-red-700/60 hover:bg-[#171f2b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="mg-language-menu"
        aria-label={currentSelectorCopy.change}
        title={currentSelectorCopy.change}
      >
        <span aria-hidden="true" className="text-base">🌐</span>
        {activeLocale.label}
      </button>
    </div>
  );
}
