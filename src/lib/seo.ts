import {
  defaultLocale,
  supportedLocales,
  type LocaleCode,
} from "@/lib/i18nConfig";
import {
  customerSupportContactTypeByLocale,
  organizationAreaServedJsonLd,
} from "@/lib/structuredDataI18n";

export const siteUrl = "https://file.mgautotech.de";
export const siteName = "MG AutoTech File Service";
export const contactEmail = "info@mgautotech.de";
export const contactPhone = "+49 151 51561670";
export const companyAddress = {
  streetAddress: "Saarstraße 4",
  postalCode: "71679",
  addressLocality: "Asperg",
  addressCountry: "DE",
} as const;

export const hreflangByLocale: Record<LocaleCode, string> = {
  nl: "nl",
  en: "en",
  de: "de",
  fr: "fr",
  it: "it",
  ru: "ru",
  es: "es",
  tr: "tr",
  pt: "pt",
  zh: "zh-CN",
  pl: "pl",
  sq: "sq",
};

export const seoLocales = supportedLocales.map((locale) => locale.code);
export const localizedSeoLocales = seoLocales.filter(
  (locale): locale is Exclude<LocaleCode, typeof defaultLocale> =>
    locale !== defaultLocale
);

export function isSeoLocale(value: string): value is LocaleCode {
  return seoLocales.includes(value as LocaleCode);
}

function normalizePath(path = "/") {
  if (!path || path === "/") return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export function localizedPath(locale: LocaleCode, path = "/") {
  const cleanPath = normalizePath(path);

  if (locale === defaultLocale) return cleanPath || "/";

  return `/${locale}${cleanPath}`;
}

export function absoluteUrl(path = "/") {
  const cleanPath = path === "/" ? "" : normalizePath(path);
  return `${siteUrl}${cleanPath || "/"}`;
}

export function localizedUrl(locale: LocaleCode, path = "/") {
  return absoluteUrl(localizedPath(locale, path));
}

export function languageAlternates(path = "/") {
  const alternates = Object.fromEntries(
    seoLocales.map((locale) => [
      hreflangByLocale[locale],
      localizedUrl(locale, path),
    ])
  ) as Record<string, string>;

  alternates["x-default"] = absoluteUrl(path);

  return alternates;
}

export const publicServiceSlugs = [
  "stage-1",
  "dpf-off",
  "egr-off",
  "adblue-off",
  "dtc-off",
] as const;

export type PublicServiceSlug = (typeof publicServiceSlugs)[number];

export function isPublicServiceSlug(value: string): value is PublicServiceSlug {
  return publicServiceSlugs.includes(value as PublicServiceSlug);
}

export type SeoHomeCopy = {
  title: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  trustTitle: string;
  trustText: string;
  servicesTitle: string;
  servicesText: string;
};

export const homeSeo: Record<LocaleCode, SeoHomeCopy> = {
  en: {
    title: "ECU & TCU File Service for Workshops",
    description:
      "Professional ECU and TCU file service for workshops: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, secure uploads, credits and fast portal delivery.",
    eyebrow: "Secure online file service platform",
    heroTitle: "Professional ECU & TCU tuning file workflow for workshops.",
    intro:
      "Upload original files, choose the service, track the order and download completed versions through a controlled MG AutoTech customer portal.",
    primaryCta: "Create file request",
    secondaryCta: "View services",
    trustTitle: "Built for daily workshop operation",
    trustText:
      "Every request keeps vehicle data, ECU information, notes, credits, file versions and revisions connected in one workflow.",
    servicesTitle: "Popular ECU and TCU services",
    servicesText:
      "Clear pages for the services workshops search for most: Stage 1, DPF, EGR, AdBlue and DTC file work.",
  },
  de: {
    title: "ECU- & TCU-Dateiservice für Werkstätten",
    description:
      "Professioneller ECU- und TCU-Dateiservice für Werkstätten: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, sichere Uploads, Credits und schnelle Portal-Lieferung.",
    eyebrow: "Sichere Online-Plattform für Dateiservices",
    heroTitle: "Professioneller Ablauf für ECU- und TCU-Tuningdateien in Werkstätten.",
    intro:
      "Originaldateien hochladen, Service wählen, Auftrag verfolgen und fertige Versionen sicher über das MG AutoTech Kundenportal herunterladen.",
    primaryCta: "Dateianfrage starten",
    secondaryCta: "Services ansehen",
    trustTitle: "Für den täglichen Werkstattbetrieb gebaut",
    trustText:
      "Fahrzeugdaten, ECU-Informationen, Notizen, Credits, Dateiversionen und Revisionen bleiben in einem klaren Arbeitsablauf verbunden.",
    servicesTitle: "Gefragte ECU- und TCU-Services",
    servicesText:
      "Gezielte Seiten für häufig gesuchte Werkstatt-Services: Stage 1 sowie DPF-, EGR-, AdBlue- und DTC-Dateibearbeitung.",
  },
  tr: {
    title: "Servisler için ECU & TCU Dosya Servisi",
    description:
      "Servisler için profesyonel ECU ve TCU dosya servisi: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, güvenli yükleme, kredi sistemi ve hızlı panel teslimatı.",
    eyebrow: "Güvenli online dosya servis platformu",
    heroTitle: "Servisler için profesyonel ECU ve TCU tuning dosyası iş akışı.",
    intro:
      "Orijinal dosyayı yükle, servisi seç, siparişi takip et ve tamamlanan versiyonları MG AutoTech müşteri panelinden güvenli şekilde indir.",
    primaryCta: "Dosya talebi oluştur",
    secondaryCta: "Servisleri gör",
    trustTitle: "Günlük servis operasyonu için kuruldu",
    trustText:
      "Araç bilgisi, ECU detayı, notlar, krediler, dosya versiyonları ve revizyonlar tek iş akışında bağlı kalır.",
    servicesTitle: "Popüler ECU ve TCU servisleri",
    servicesText:
      "Servislerin en çok aradığı işler için net sayfalar: Stage 1, DPF, EGR, AdBlue ve DTC dosya işlemleri.",
  },
  nl: {
    title: "ECU- en TCU-bestandsservice voor werkplaatsen",
    description:
      "Professionele ECU- en TCU-bestandsservice voor werkplaatsen: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, veilige uploads, credits en snelle levering via het portaal.",
    eyebrow: "Veilig online platform voor bestandsservices",
    heroTitle: "Professioneel werkproces voor ECU- en TCU-tuningbestanden.",
    intro:
      "Verstuur originele bestanden, kies de service, volg de order en download voltooide versies via het beveiligde MG AutoTech klantenportaal.",
    primaryCta: "Bestandsaanvraag starten",
    secondaryCta: "Services bekijken",
    trustTitle: "Gebouwd voor dagelijks werkplaatsgebruik",
    trustText:
      "Voertuigdata, ECU-informatie, notities, credits, bestandsversies en revisies blijven in één werkproces verbonden.",
    servicesTitle: "Populaire ECU en TCU services",
    servicesText:
      "Duidelijke pagina's voor veelgevraagde services: Stage 1 en DPF-, EGR-, AdBlue- en DTC-bestandsbewerking.",
  },
  fr: {
    title: "Service de fichiers ECU et TCU pour ateliers",
    description:
      "Service professionnel de fichiers ECU et TCU pour ateliers : Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, envois sécurisés, crédits et livraison rapide via le portail.",
    eyebrow: "Plateforme sécurisée de services de fichiers en ligne",
    heroTitle: "Processus professionnel pour les fichiers de réglage ECU et TCU.",
    intro:
      "Envoyez les fichiers d'origine, choisissez le service, suivez la demande et téléchargez les versions terminées depuis le portail client MG AutoTech.",
    primaryCta: "Créer une demande",
    secondaryCta: "Voir les services",
    trustTitle: "Conçu pour le travail quotidien en atelier",
    trustText:
      "Données véhicule, informations ECU, notes, crédits, versions de fichiers et révisions restent liés dans un même processus.",
    servicesTitle: "Services ECU et TCU populaires",
    servicesText:
      "Pages claires pour les services les plus recherchés: Stage 1, DPF, EGR, AdBlue et DTC.",
  },
  it: {
    title: "Servizio file ECU e TCU per officine",
    description:
      "Servizio professionale di file ECU e TCU per officine: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, caricamenti sicuri, crediti e consegna rapida tramite portale.",
    eyebrow: "Piattaforma online sicura per i servizi file",
    heroTitle: "Processo professionale per file tuning ECU e TCU dedicato alle officine.",
    intro:
      "Carica i file originali, scegli il servizio, segui l'ordine e scarica le versioni completate dal portale cliente MG AutoTech.",
    primaryCta: "Crea richiesta file",
    secondaryCta: "Vedi servizi",
    trustTitle: "Creato per il lavoro quotidiano in officina",
    trustText:
      "Dati veicolo, informazioni ECU, note, crediti, versioni file e revisioni restano collegati in un unico processo operativo.",
    servicesTitle: "Servizi ECU e TCU più richiesti",
    servicesText:
      "Pagine chiare per i servizi cercati dalle officine: Stage 1, DPF, EGR, AdBlue e DTC.",
  },
  ru: {
    title: "Сервис файлов ECU и TCU для автосервисов",
    description:
      "Профессиональная подготовка файлов ECU и TCU для автосервисов: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, безопасная загрузка, кредиты и быстрая выдача через портал.",
    eyebrow: "Безопасная онлайн-платформа для работы с файлами",
    heroTitle: "Профессиональный процесс подготовки файлов ECU и TCU для автосервисов.",
    intro:
      "Загрузите оригинальный файл, выберите услугу, отслеживайте заказ и скачивайте готовые версии через портал MG AutoTech.",
    primaryCta: "Создать запрос",
    secondaryCta: "Смотреть услуги",
    trustTitle: "Создано для ежедневной работы сервиса",
    trustText:
      "Данные автомобиля, ECU, заметки, кредиты, версии файлов и ревизии остаются в одном рабочем процессе.",
    servicesTitle: "Популярные ECU и TCU услуги",
    servicesText:
      "Отдельные страницы для самых востребованных услуг: Stage 1, DPF, EGR, AdBlue и DTC.",
  },
  es: {
    title: "Servicio de archivos ECU y TCU para talleres",
    description:
      "Servicio profesional de archivos ECU y TCU para talleres: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, cargas seguras, créditos y entrega rápida por portal.",
    eyebrow: "Plataforma segura en línea para servicios de archivos",
    heroTitle: "Proceso profesional para archivos de calibración ECU y TCU.",
    intro:
      "Sube archivos originales, elige el servicio, sigue el pedido y descarga las versiones completadas desde el portal MG AutoTech.",
    primaryCta: "Crear solicitud",
    secondaryCta: "Ver servicios",
    trustTitle: "Diseñado para la operación diaria del taller",
    trustText:
      "Datos del vehículo, información ECU, notas, créditos, versiones y revisiones quedan conectados en un mismo proceso.",
    servicesTitle: "Servicios ECU y TCU populares",
    servicesText:
      "Páginas claras para los servicios más buscados: Stage 1, DPF, EGR, AdBlue y DTC.",
  },
  pt: {
    title: "Serviço de ficheiros ECU e TCU para oficinas",
    description:
      "Serviço profissional de ficheiros ECU e TCU para oficinas: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, carregamentos seguros, créditos e entrega rápida no portal.",
    eyebrow: "Plataforma online segura para serviços de ficheiros",
    heroTitle: "Processo profissional para ficheiros de afinação ECU e TCU.",
    intro:
      "Envie ficheiros originais, escolha o serviço, acompanhe o pedido e descarregue as versões concluídas no portal MG AutoTech.",
    primaryCta: "Criar pedido",
    secondaryCta: "Ver serviços",
    trustTitle: "Criado para a operação diária da oficina",
    trustText:
      "Dados do veículo, informação ECU, notas, créditos, versões e revisões ficam ligados num só processo.",
    servicesTitle: "Serviços ECU e TCU populares",
    servicesText:
      "Páginas claras para serviços procurados: Stage 1, DPF, EGR, AdBlue e DTC.",
  },
  zh: {
    title: "面向维修厂的 ECU & TCU 文件服务",
    description:
      "面向维修厂和调校公司的专业 ECU / TCU 文件服务：Stage 1、DPF OFF、EGR OFF、AdBlue OFF、DTC OFF、安全上传、积分流程和快速交付。",
    eyebrow: "安全的在线文件服务平台",
    heroTitle: "面向维修厂的专业 ECU & TCU 调校文件流程。",
    intro:
      "上传原厂文件，选择服务，跟踪订单，并通过 MG AutoTech 客户门户安全下载完成版本。",
    primaryCta: "创建文件请求",
    secondaryCta: "查看服务",
    trustTitle: "为日常维修厂操作而设计",
    trustText:
      "车辆数据、ECU 信息、备注、积分、文件版本和修订都保持在同一个流程中。",
    servicesTitle: "热门 ECU 和 TCU 服务",
    servicesText:
      "针对常见需求的清晰页面：Stage 1、DPF、EGR、AdBlue 和 DTC 文件处理。",
  },
  pl: {
    title: "Obsługa plików ECU i TCU dla warsztatów",
    description:
      "Profesjonalna obsługa plików ECU i TCU dla warsztatów: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, bezpieczne przesyłanie, kredyty i szybka dostawa w portalu.",
    eyebrow: "Bezpieczna platforma internetowa do obsługi plików",
    heroTitle: "Profesjonalny proces przygotowania plików tuningowych ECU i TCU.",
    intro:
      "Prześlij oryginalny plik, wybierz usługę, śledź zlecenie i pobierz gotowe wersje z portalu klienta MG AutoTech.",
    primaryCta: "Utwórz zlecenie",
    secondaryCta: "Zobacz usługi",
    trustTitle: "Zbudowane do codziennej pracy warsztatu",
    trustText:
      "Dane pojazdu, informacje ECU, notatki, kredyty, wersje plików i poprawki pozostają w jednym procesie.",
    servicesTitle: "Popularne usługi ECU i TCU",
    servicesText:
      "Czytelne strony dla najczęściej szukanych usług: Stage 1, DPF, EGR, AdBlue i DTC.",
  },
  sq: {
    title: "Shërbim për skedarë ECU dhe TCU për servise",
    description:
      "Shërbim profesional për skedarë ECU dhe TCU: Stage 1, DPF OFF, EGR OFF, AdBlue OFF, DTC OFF, ngarkim i sigurt, kredi dhe dorëzim i shpejtë në portal.",
    eyebrow: "Platformë e sigurt online për shërbimin e skedarëve",
    heroTitle: "Proces profesional për përgatitjen e skedarëve tuning ECU dhe TCU.",
    intro:
      "Ngarko skedarin origjinal, zgjidh shërbimin, ndiq porosinë dhe shkarko versionet e përfunduara në portalin MG AutoTech.",
    primaryCta: "Krijo kërkesë për skedar",
    secondaryCta: "Shiko shërbimet",
    trustTitle: "Ndërtuar për punën ditore të servisit",
    trustText:
      "Të dhënat e automjetit, ECU, shënimet, kreditë, versionet dhe revizionet qëndrojnë në një proces të vetëm.",
    servicesTitle: "Shërbime popullore ECU dhe TCU",
    servicesText:
      "Faqe të qarta për shërbimet më të kërkuara: Stage 1, DPF, EGR, AdBlue dhe DTC.",
  },
};

export type LocaleLabels = {
  navHome: string;
  navServices: string;
  navPrices: string;
  login: string;
  register: string;
  credits: string;
  turnaround: string;
  delivery: string;
  securePortal: string;
  process: string;
  supportedBrands: string;
  requiredInfo: string;
  faq: string;
  why: string;
  viewService: string;
  startRequest: string;
};

export const seoLabels: Record<LocaleCode, LocaleLabels> = {
  en: {
    navHome: "Home",
    navServices: "Services",
    navPrices: "Prices",
    login: "Login",
    register: "Register",
    credits: "Credits",
    turnaround: "Turnaround",
    delivery: "Delivery",
    securePortal: "Secure portal",
    process: "Process",
    supportedBrands: "Supported brands",
    requiredInfo: "Required information",
    faq: "FAQ",
    why: "Why MG AutoTech",
    viewService: "View service",
    startRequest: "Start request",
  },
  de: {
    navHome: "Startseite",
    navServices: "Services",
    navPrices: "Preise",
    login: "Login",
    register: "Registrieren",
    credits: "Credits",
    turnaround: "Bearbeitung",
    delivery: "Lieferung",
    securePortal: "Sicheres Portal",
    process: "Ablauf",
    supportedBrands: "Unterstützte Marken",
    requiredInfo: "Benötigte Angaben",
    faq: "FAQ",
    why: "Warum MG AutoTech",
    viewService: "Service ansehen",
    startRequest: "Anfrage starten",
  },
  tr: {
    navHome: "Ana sayfa",
    navServices: "Servisler",
    navPrices: "Fiyatlar",
    login: "Giriş",
    register: "Kayıt ol",
    credits: "Kredi",
    turnaround: "Teslim süresi",
    delivery: "Teslimat",
    securePortal: "Güvenli panel",
    process: "Süreç",
    supportedBrands: "Desteklenen markalar",
    requiredInfo: "Gerekli bilgiler",
    faq: "SSS",
    why: "Neden MG AutoTech",
    viewService: "Servisi gör",
    startRequest: "Talep başlat",
  },
  nl: {
    navHome: "Home",
    navServices: "Services",
    navPrices: "Prijzen",
    login: "Inloggen",
    register: "Registreren",
    credits: "Credits",
    turnaround: "Doorlooptijd",
    delivery: "Levering",
    securePortal: "Veilig portaal",
    process: "Proces",
    supportedBrands: "Ondersteunde merken",
    requiredInfo: "Benodigde informatie",
    faq: "FAQ",
    why: "Waarom MG AutoTech",
    viewService: "Service bekijken",
    startRequest: "Aanvraag starten",
  },
  fr: {
    navHome: "Accueil",
    navServices: "Services",
    navPrices: "Tarifs",
    login: "Connexion",
    register: "Inscription",
    credits: "Crédits",
    turnaround: "Délai",
    delivery: "Livraison",
    securePortal: "Portail sécurisé",
    process: "Processus",
    supportedBrands: "Marques prises en charge",
    requiredInfo: "Informations nécessaires",
    faq: "FAQ",
    why: "Pourquoi MG AutoTech",
    viewService: "Voir le service",
    startRequest: "Créer une demande",
  },
  it: {
    navHome: "Home",
    navServices: "Servizi",
    navPrices: "Prezzi",
    login: "Accesso",
    register: "Registrati",
    credits: "Crediti",
    turnaround: "Tempi",
    delivery: "Consegna",
    securePortal: "Portale sicuro",
    process: "Processo",
    supportedBrands: "Marchi supportati",
    requiredInfo: "Informazioni richieste",
    faq: "FAQ",
    why: "Perché MG AutoTech",
    viewService: "Vedi servizio",
    startRequest: "Avvia richiesta",
  },
  ru: {
    navHome: "Главная",
    navServices: "Услуги",
    navPrices: "Цены",
    login: "Вход",
    register: "Регистрация",
    credits: "Кредиты",
    turnaround: "Срок",
    delivery: "Доставка",
    securePortal: "Безопасный портал",
    process: "Процесс",
    supportedBrands: "Поддерживаемые марки",
    requiredInfo: "Необходимые данные",
    faq: "FAQ",
    why: "Почему MG AutoTech",
    viewService: "Открыть услугу",
    startRequest: "Создать запрос",
  },
  es: {
    navHome: "Inicio",
    navServices: "Servicios",
    navPrices: "Precios",
    login: "Acceso",
    register: "Registro",
    credits: "Créditos",
    turnaround: "Tiempo",
    delivery: "Entrega",
    securePortal: "Portal seguro",
    process: "Proceso",
    supportedBrands: "Marcas compatibles",
    requiredInfo: "Información necesaria",
    faq: "FAQ",
    why: "Por qué MG AutoTech",
    viewService: "Ver servicio",
    startRequest: "Crear solicitud",
  },
  pt: {
    navHome: "Início",
    navServices: "Serviços",
    navPrices: "Preços",
    login: "Entrar",
    register: "Registar",
    credits: "Créditos",
    turnaround: "Prazo",
    delivery: "Entrega",
    securePortal: "Portal seguro",
    process: "Processo",
    supportedBrands: "Marcas suportadas",
    requiredInfo: "Informação necessária",
    faq: "FAQ",
    why: "Porquê MG AutoTech",
    viewService: "Ver serviço",
    startRequest: "Criar pedido",
  },
  zh: {
    navHome: "首页",
    navServices: "服务",
    navPrices: "价格",
    login: "登录",
    register: "注册",
    credits: "积分",
    turnaround: "处理时间",
    delivery: "交付",
    securePortal: "安全门户",
    process: "流程",
    supportedBrands: "支持品牌",
    requiredInfo: "所需信息",
    faq: "常见问题",
    why: "为什么选择 MG AutoTech",
    viewService: "查看服务",
    startRequest: "创建请求",
  },
  pl: {
    navHome: "Start",
    navServices: "Usługi",
    navPrices: "Ceny",
    login: "Logowanie",
    register: "Rejestracja",
    credits: "Kredyty",
    turnaround: "Czas realizacji",
    delivery: "Dostawa",
    securePortal: "Bezpieczny portal",
    process: "Proces",
    supportedBrands: "Obsługiwane marki",
    requiredInfo: "Wymagane informacje",
    faq: "FAQ",
    why: "Dlaczego MG AutoTech",
    viewService: "Zobacz usługę",
    startRequest: "Utwórz zlecenie",
  },
  sq: {
    navHome: "Kryefaqja",
    navServices: "Shërbimet",
    navPrices: "Çmimet",
    login: "Hyrje",
    register: "Regjistrohu",
    credits: "Kredi",
    turnaround: "Afati",
    delivery: "Dorëzim",
    securePortal: "Portal i sigurt",
    process: "Procesi",
    supportedBrands: "Markat e suportuara",
    requiredInfo: "Të dhënat e nevojshme",
    faq: "FAQ",
    why: "Pse MG AutoTech",
    viewService: "Shiko shërbimin",
    startRequest: "Krijo kërkesë",
  },
};

export const serviceNames: Record<PublicServiceSlug, Record<LocaleCode, string>> = {
  "stage-1": {
    en: "Stage 1 ECU File Service",
    de: "Stage 1 ECU-Dateiservice",
    tr: "Stage 1 ECU Dosya Servisi",
    nl: "Stage 1 ECU-bestandsservice",
    fr: "Service fichier ECU Stage 1",
    it: "Servizio file ECU Stage 1",
    ru: "Файловый сервис ECU Stage 1",
    es: "Servicio de archivo ECU Stage 1",
    pt: "Serviço de ficheiro ECU Stage 1",
    zh: "Stage 1 ECU 文件服务",
    pl: "Usługa pliku ECU Stage 1",
    sq: "Shërbim file ECU Stage 1",
  },
  "dpf-off": {
    en: "DPF OFF File Service",
    de: "DPF OFF Dateiservice",
    tr: "DPF OFF Dosya Servisi",
    nl: "DPF OFF bestandsservice",
    fr: "Service fichier DPF OFF",
    it: "Servizio file DPF OFF",
    ru: "Файловый сервис DPF OFF",
    es: "Servicio de archivo DPF OFF",
    pt: "Serviço de ficheiro DPF OFF",
    zh: "DPF OFF 文件服务",
    pl: "Usługa pliku DPF OFF",
    sq: "Shërbim file DPF OFF",
  },
  "egr-off": {
    en: "EGR OFF File Service",
    de: "EGR / AGR OFF Dateiservice",
    tr: "EGR OFF Dosya Servisi",
    nl: "EGR OFF bestandsservice",
    fr: "Service fichier EGR OFF",
    it: "Servizio file EGR OFF",
    ru: "Файловый сервис EGR OFF",
    es: "Servicio de archivo EGR OFF",
    pt: "Serviço de ficheiro EGR OFF",
    zh: "EGR OFF 文件服务",
    pl: "Usługa pliku EGR OFF",
    sq: "Shërbim file EGR OFF",
  },
  "adblue-off": {
    en: "AdBlue OFF File Service",
    de: "AdBlue OFF Dateiservice",
    tr: "AdBlue OFF Dosya Servisi",
    nl: "AdBlue OFF bestandsservice",
    fr: "Service fichier AdBlue OFF",
    it: "Servizio file AdBlue OFF",
    ru: "Файловый сервис AdBlue OFF",
    es: "Servicio de archivo AdBlue OFF",
    pt: "Serviço de ficheiro AdBlue OFF",
    zh: "AdBlue OFF 文件服务",
    pl: "Usługa pliku AdBlue OFF",
    sq: "Shërbim file AdBlue OFF",
  },
  "dtc-off": {
    en: "DTC OFF File Service",
    de: "DTC OFF Dateiservice",
    tr: "DTC OFF Dosya Servisi",
    nl: "DTC OFF bestandsservice",
    fr: "Service fichier DTC OFF",
    it: "Servizio file DTC OFF",
    ru: "Файловый сервис DTC OFF",
    es: "Servicio de archivo DTC OFF",
    pt: "Serviço de ficheiro DTC OFF",
    zh: "DTC OFF 文件服务",
    pl: "Usługa pliku DTC OFF",
    sq: "Shërbim file DTC OFF",
  },
};


const organizationKnowledgeTerms = [
  "ECU_FILE_SERVICE",
  "TCU_TUNING",
  "STAGE_1_TUNING",
  "STAGE_2_ECU_FILE_SERVICE",
  "TCU_FILE_SERVICE",
  "ECU_FILE_VERIFICATION",
  "DPF_OFF",
  "EGR_OFF",
  "ADBLUE_OFF",
  "DTC_OFF",
  "AUTOTUNER",
  "WINOLS",
] as const;

export function organizationJsonLd(locale: LocaleCode = defaultLocale) {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "AutomotiveBusiness"],
    "@id": `${siteUrl}/#organization`,
    name: "MG AutoTech",
    legalName: "MG AutoTech - Melih Gokkaya",
    description: homeSeo[locale].description,
    url: siteUrl,
    email: contactEmail,
    telephone: contactPhone,
    taxID: "93087/00619",
    vatID: "DE461343520",
    image: `${siteUrl}/opengraph-image`,
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/mg-autotech-logo.svg`,
      contentUrl: `${siteUrl}/mg-autotech-logo.svg`,
      width: 512,
      height: 512,
    },
    address: {
      "@type": "PostalAddress",
      ...companyAddress,
    },
    founder: {
      "@type": "Person",
      name: "Melih Gokkaya",
    },
    sameAs: ["https://mgautotech.de"],
    contactPoint: [
      {
        "@type": "ContactPoint",
        email: contactEmail,
        telephone: contactPhone,
        contactType: customerSupportContactTypeByLocale[locale],
        availableLanguage: seoLocales.map((locale) => hreflangByLocale[locale]),
        areaServed: ["DE", "EU"],
      },
    ],
    areaServed: organizationAreaServedJsonLd,
    currenciesAccepted: "EUR",
    priceRange: "EUR",
    knowsAbout: organizationKnowledgeTerms.map((termCode) => ({
      "@type": "DefinedTerm",
      termCode,
    })),
  };
}

export function websiteJsonLd(locale: LocaleCode) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: siteName,
    url: siteUrl,
    inLanguage: hreflangByLocale[locale],
    publisher: {
      "@id": `${siteUrl}/#organization`,
    },
  };
}

export function buildSiteIdentityJsonLd(locale: LocaleCode) {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationJsonLd(locale), websiteJsonLd(locale)],
  };
}

/**
 * Shared root identity intentionally omits presentation-language fields. Each
 * localized public page emits its richer locale-specific Organization/WebSite
 * graph without forcing the entire App Router tree into request-time rendering.
 */
export function buildNeutralSiteIdentityJsonLd() {
  const organization = {
    ...organizationJsonLd(defaultLocale),
  } as Record<string, unknown>;
  const website = {
    ...websiteJsonLd(defaultLocale),
  } as Record<string, unknown>;
  const localizedContactPoints = organization.contactPoint as Array<
    Record<string, unknown>
  >;

  delete organization.description;
  delete website.inLanguage;
  organization.contactPoint = localizedContactPoints.map((localizedPoint) => {
    const point = { ...localizedPoint };
    delete point.contactType;
    return point;
  });

  return {
    "@context": "https://schema.org",
    "@graph": [organization, website],
  };
}
