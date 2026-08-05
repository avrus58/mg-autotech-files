import {
  defaultLocale,
  normalizeLocale,
  type LocaleCode,
} from "@/lib/i18nConfig";

export type AnalyticsConsentCopy = {
  title: string;
  description: string;
  allow: string;
  necessaryOnly: string;
  privacyInformation: string;
  openPreferences: string;
  preferencesTitle: string;
  enabledAnnouncement: string;
  disabledAnnouncement: string;
};

export const analyticsConsentCopy: Record<LocaleCode, AnalyticsConsentCopy> = {
  en: {
    title: "Optional analytics",
    description:
      "Analytics helps MG AutoTech understand public search traffic and improve the request flow. File names, vehicle details, account data and order IDs are never included.",
    allow: "Allow analytics",
    necessaryOnly: "Necessary only",
    privacyInformation: "Privacy information",
    openPreferences: "Open analytics preferences",
    preferencesTitle: "Analytics preferences",
    enabledAnnouncement: "Optional analytics enabled.",
    disabledAnnouncement: "Optional analytics disabled.",
  },
  de: {
    title: "Optionale Analyse",
    description:
      "Analysen helfen MG AutoTech, den öffentlichen Suchverkehr zu verstehen und den Anfrageablauf zu verbessern. Dateinamen, Fahrzeugdaten, Kontodaten und Auftragsnummern werden niemals erfasst.",
    allow: "Analyse erlauben",
    necessaryOnly: "Nur erforderlich",
    privacyInformation: "Datenschutzinformationen",
    openPreferences: "Analyse-Einstellungen öffnen",
    preferencesTitle: "Analyse-Einstellungen",
    enabledAnnouncement: "Optionale Analyse aktiviert.",
    disabledAnnouncement: "Optionale Analyse deaktiviert.",
  },
  tr: {
    title: "İsteğe bağlı analizler",
    description:
      "Analizler, MG AutoTech'in herkese açık arama trafiğini anlamasına ve talep akışını iyileştirmesine yardımcı olur. Dosya adları, araç bilgileri, hesap verileri ve sipariş numaraları hiçbir zaman dahil edilmez.",
    allow: "Analizlere izin ver",
    necessaryOnly: "Yalnızca gerekli",
    privacyInformation: "Gizlilik bilgileri",
    openPreferences: "Analiz tercihlerini aç",
    preferencesTitle: "Analiz tercihleri",
    enabledAnnouncement: "İsteğe bağlı analizler etkinleştirildi.",
    disabledAnnouncement: "İsteğe bağlı analizler devre dışı bırakıldı.",
  },
  fr: {
    title: "Analyses facultatives",
    description:
      "Les analyses aident MG AutoTech à comprendre le trafic de recherche public et à améliorer le parcours de demande. Les noms de fichiers, les données du véhicule, les données du compte et les numéros de commande ne sont jamais inclus.",
    allow: "Autoriser les analyses",
    necessaryOnly: "Nécessaires uniquement",
    privacyInformation: "Informations sur la confidentialité",
    openPreferences: "Ouvrir les préférences d'analyse",
    preferencesTitle: "Préférences d'analyse",
    enabledAnnouncement: "Analyses facultatives activées.",
    disabledAnnouncement: "Analyses facultatives désactivées.",
  },
  nl: {
    title: "Optionele analyse",
    description:
      "Analyse helpt MG AutoTech om openbaar zoekverkeer te begrijpen en het aanvraagproces te verbeteren. Bestandsnamen, voertuiggegevens, accountgegevens en ordernummers worden nooit opgenomen.",
    allow: "Analyse toestaan",
    necessaryOnly: "Alleen noodzakelijk",
    privacyInformation: "Privacy-informatie",
    openPreferences: "Analysevoorkeuren openen",
    preferencesTitle: "Analysevoorkeuren",
    enabledAnnouncement: "Optionele analyse ingeschakeld.",
    disabledAnnouncement: "Optionele analyse uitgeschakeld.",
  },
  it: {
    title: "Analisi facoltative",
    description:
      "Le analisi aiutano MG AutoTech a comprendere il traffico di ricerca pubblico e a migliorare il flusso delle richieste. Nomi dei file, dati del veicolo, dati dell'account e numeri d'ordine non vengono mai inclusi.",
    allow: "Consenti analisi",
    necessaryOnly: "Solo necessari",
    privacyInformation: "Informazioni sulla privacy",
    openPreferences: "Apri preferenze analisi",
    preferencesTitle: "Preferenze analisi",
    enabledAnnouncement: "Analisi facoltative attivate.",
    disabledAnnouncement: "Analisi facoltative disattivate.",
  },
  es: {
    title: "Análisis opcionales",
    description:
      "Los análisis ayudan a MG AutoTech a comprender el tráfico de búsqueda público y a mejorar el proceso de solicitud. Nunca se incluyen nombres de archivo, datos del vehículo, datos de la cuenta ni números de pedido.",
    allow: "Permitir análisis",
    necessaryOnly: "Solo necesarios",
    privacyInformation: "Información de privacidad",
    openPreferences: "Abrir preferencias de análisis",
    preferencesTitle: "Preferencias de análisis",
    enabledAnnouncement: "Análisis opcionales activados.",
    disabledAnnouncement: "Análisis opcionales desactivados.",
  },
  pt: {
    title: "Análises opcionais",
    description:
      "As análises ajudam a MG AutoTech a compreender o tráfego de pesquisa público e a melhorar o processo de pedido. Nomes de ficheiros, dados do veículo, dados da conta e números de pedido nunca são incluídos.",
    allow: "Permitir análises",
    necessaryOnly: "Apenas necessários",
    privacyInformation: "Informações de privacidade",
    openPreferences: "Abrir preferências de análise",
    preferencesTitle: "Preferências de análise",
    enabledAnnouncement: "Análises opcionais ativadas.",
    disabledAnnouncement: "Análises opcionais desativadas.",
  },
  pl: {
    title: "Opcjonalna analityka",
    description:
      "Analityka pomaga MG AutoTech zrozumieć publiczny ruch z wyszukiwarek i ulepszać proces składania zleceń. Nazwy plików, dane pojazdu, dane konta i numery zamówień nigdy nie są uwzględniane.",
    allow: "Zezwól na analitykę",
    necessaryOnly: "Tylko niezbędne",
    privacyInformation: "Informacje o prywatności",
    openPreferences: "Otwórz ustawienia analityki",
    preferencesTitle: "Ustawienia analityki",
    enabledAnnouncement: "Opcjonalna analityka włączona.",
    disabledAnnouncement: "Opcjonalna analityka wyłączona.",
  },
  ru: {
    title: "Необязательная аналитика",
    description:
      "Аналитика помогает MG AutoTech понимать публичный поисковый трафик и улучшать процесс оформления заявок. Имена файлов, данные автомобиля, данные аккаунта и номера заказов никогда не передаются.",
    allow: "Разрешить аналитику",
    necessaryOnly: "Только необходимые",
    privacyInformation: "Информация о конфиденциальности",
    openPreferences: "Открыть настройки аналитики",
    preferencesTitle: "Настройки аналитики",
    enabledAnnouncement: "Необязательная аналитика включена.",
    disabledAnnouncement: "Необязательная аналитика отключена.",
  },
  zh: {
    title: "可选分析",
    description:
      "分析功能帮助 MG AutoTech 了解公开搜索流量并改进请求流程。我们绝不会收集文件名、车辆信息、账户数据或订单编号。",
    allow: "允许分析",
    necessaryOnly: "仅必要功能",
    privacyInformation: "隐私信息",
    openPreferences: "打开分析偏好设置",
    preferencesTitle: "分析偏好设置",
    enabledAnnouncement: "已启用可选分析。",
    disabledAnnouncement: "已停用可选分析。",
  },
  sq: {
    title: "Analiza opsionale",
    description:
      "Analiza ndihmon MG AutoTech të kuptojë trafikun publik të kërkimit dhe të përmirësojë procesin e kërkesave. Emrat e skedarëve, të dhënat e automjetit, të dhënat e llogarisë dhe numrat e porosive nuk përfshihen kurrë.",
    allow: "Lejo analizën",
    necessaryOnly: "Vetëm të nevojshmet",
    privacyInformation: "Informacion mbi privatësinë",
    openPreferences: "Hap preferencat e analizës",
    preferencesTitle: "Preferencat e analizës",
    enabledAnnouncement: "Analiza opsionale u aktivizua.",
    disabledAnnouncement: "Analiza opsionale u çaktivizua.",
  },
};

export function getAnalyticsConsentLocale(pathname: string): LocaleCode {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment ? normalizeLocale(firstSegment) : defaultLocale;
}

export function getAnalyticsConsentCopy(pathname: string) {
  return analyticsConsentCopy[getAnalyticsConsentLocale(pathname)];
}
