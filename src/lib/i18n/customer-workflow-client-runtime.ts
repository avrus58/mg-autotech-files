import type { LocaleCode } from "@/lib/i18nConfig";

export const customerWorkflowClientLocaleOrder = [
  "nl",
  "de",
  "fr",
  "it",
  "ru",
  "es",
  "tr",
  "pt",
  "zh",
  "pl",
  "sq",
] as const satisfies readonly Exclude<LocaleCode, "en">[];

export type CustomerWorkflowClientTemplateRow = readonly [
  string,
  string,
  ...string[],
];

export type CustomerNotificationI18nInput = {
  type:
    | "admin_message"
    | "order_status"
    | "file_ready"
    | "additional_upload_enabled"
    | "system";
  title: string;
  body: string | null;
  status?: string | null;
};

export type CustomerWorkflowTemplateTranslator = (
  locale: LocaleCode,
  key: string,
  values?: Record<string, string | number>,
) => string;

export type CustomerWorkflowExactTranslator = (
  locale: LocaleCode,
  source: string,
) => string;

export function createCustomerWorkflowClientTranslators<
  Key extends string,
>(
  exactTranslations: Readonly<Record<string, readonly string[]>>,
  templateRows: readonly (readonly [Key, string, ...string[]])[],
) {
  const templateRowsByKey = Object.fromEntries(
    templateRows.map((row) => [row[0], row]),
  ) as Record<Key, readonly [Key, string, ...string[]]>;

  const exactT = (locale: LocaleCode, source: string) => {
    if (locale === "en") return source;
    const localeIndex = customerWorkflowClientLocaleOrder.indexOf(
      locale as Exclude<LocaleCode, "en">,
    );
    if (localeIndex < 0) return source;
    return exactTranslations[source]?.[localeIndex] ?? source;
  };

  const t = (
    locale: LocaleCode,
    key: Key,
    values: Record<string, string | number> = {},
  ) => {
    const row = templateRowsByKey[key];
    const localeIndex =
      locale === "en"
        ? 0
        : customerWorkflowClientLocaleOrder.indexOf(
            locale as Exclude<LocaleCode, "en">,
          ) + 1;
    const template = row?.[localeIndex + 1] ?? row?.[1] ?? key;
    return template.replace(
      /\{([a-zA-Z][a-zA-Z0-9]*)\}/g,
      (match, name: string) =>
        Object.prototype.hasOwnProperty.call(values, name)
          ? String(values[name])
          : match,
    );
  };

  return { exactT, t };
}

export function translateCustomerPasswordError(
  locale: LocaleCode,
  source: string,
  exactT: CustomerWorkflowExactTranslator,
  t: CustomerWorkflowTemplateTranslator,
) {
  const minimum = source.match(/^Use at least (\d+) characters\.$/);
  if (minimum) return t(locale, "passwordMinimum", { count: minimum[1] });
  const maximum = source.match(/^Use no more than (\d+) characters\.$/);
  if (maximum) return t(locale, "passwordMaximum", { count: maximum[1] });
  const keyBySource = {
    "Do not use spaces.": "passwordNoSpaces",
    "Add a lowercase letter.": "passwordLowercase",
    "Add an uppercase letter.": "passwordUppercase",
    "Add a number.": "passwordNumber",
    "Add a symbol.": "passwordSymbol",
    "Choose a less predictable password.": "passwordPredictable",
  } as const;
  const key = keyBySource[source as keyof typeof keyBySource];
  return key ? t(locale, key) : exactT(locale, source);
}

const notificationTypeKeys = {
  admin_message: "notificationTypeAdminMessage",
  order_status: "notificationTypeOrderStatus",
  file_ready: "notificationTypeFileReady",
  additional_upload_enabled: "notificationTypeAdditionalUpload",
  system: "notificationTypeSystem",
} as const satisfies Record<CustomerNotificationI18nInput["type"], string>;

const notificationStatusBodyKeys: Record<string, string> = {
  "New status: New Request": "statusNewRequest",
  "New status: File Check": "statusFileCheck",
  "New status: Customer Info Needed": "statusCustomerInfoNeeded",
  "New status: In Progress": "statusInProgress",
  "New status: Completed": "statusCompleted",
  "New status: Revision": "statusRevision",
  "New status: Cancelled": "statusCancelled",
  "New status: Canceled": "statusCancelled",
};

const notificationStatusMetadataKeys: Record<string, string> = {
  new_request: "statusNewRequest",
  file_check: "statusFileCheck",
  customer_info_needed: "statusCustomerInfoNeeded",
  in_progress: "statusInProgress",
  completed: "statusCompleted",
  revision: "statusRevision",
  cancelled: "statusCancelled",
  canceled: "statusCancelled",
};

export function translateCustomerNotification(
  locale: LocaleCode,
  item: CustomerNotificationI18nInput,
  t: CustomerWorkflowTemplateTranslator,
) {
  const typeLabel = t(locale, notificationTypeKeys[item.type]);
  if (item.type === "admin_message") {
    return {
      title: t(locale, "notificationNewMessageTitle"),
      body: item.body,
      typeLabel,
      rawTitle: false,
      rawBody: true,
    };
  }
  if (item.type === "file_ready") {
    return {
      title: t(locale, "notificationFileReadyTitle"),
      body: t(locale, "notificationFileReadyBody"),
      typeLabel,
      rawTitle: false,
      rawBody: false,
    };
  }
  if (item.type === "additional_upload_enabled") {
    return {
      title: t(locale, "notificationAdditionalUploadTitle"),
      body: t(locale, "notificationAdditionalUploadBody"),
      typeLabel,
      rawTitle: false,
      rawBody: false,
    };
  }
  if (item.type === "order_status") {
    const projectedStatus =
      typeof item.status === "string"
        ? item.status.trim().toLowerCase().replace(/[\s-]+/g, "_")
        : "";
    const statusKey = projectedStatus
      ? notificationStatusMetadataKeys[projectedStatus]
      : item.body
        ? notificationStatusBodyKeys[item.body]
        : undefined;
    if (statusKey) {
      return {
        title: t(locale, "notificationOrderStatusTitle"),
        body: t(locale, "notificationNewStatus", {
          status: t(locale, statusKey),
        }),
        typeLabel,
        rawTitle: false,
        rawBody: false,
      };
    }
  }
  return {
    title: item.title,
    body: item.body,
    typeLabel,
    rawTitle: true,
    rawBody: true,
  };
}
