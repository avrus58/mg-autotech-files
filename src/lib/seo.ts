import {
  defaultLocale,
  supportedLocales,
  type LocaleCode,
} from "@/lib/i18nConfig";

export const siteUrl = "https://file.mgautotech.de";
export const siteName = "MG AutoTech File Service";
export const contactEmail = "info@mgautotech.de";
export const contactPhone = "+49 151 51561670";
export const companyAddress = {
  streetAddress: "Böckinger Str. 32",
  postalCode: "70437",
  addressLocality: "Stuttgart",
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

export function isSeoLocale(value: string): value is LocaleCode {
  return seoLocales.includes(value as LocaleCode);
}

function normalizePath(path = "/") {
  if (!path || path === "/") return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export function localizedPath(locale: LocaleCode, path = "/") {
  return `/${locale}${normalizePath(path)}`;
}

export function absoluteUrl(path = "/") {
  const cleanPath = path === "/" ? "" : normalizePath(path);
  return `${siteUrl}${cleanPath || "/"}`;
}

export function localizedUrl(locale: LocaleCode, path = "/") {
  return `${siteUrl}${localizedPath(locale, path)}`;
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

const serviceNames: Record<PublicServiceSlug, Record<LocaleCode, string>> = {
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

export const serviceMeta: Record<
  PublicServiceSlug,
  {
    credits: string;
    turnaround: string;
    supported: string[];
    required: string[];
  }
> = {
  "stage-1": {
    credits: "10",
    turnaround: "~30 min",
    supported: ["BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Porsche", "Opel"],
    required: ["Original ECU file", "Vehicle model and engine", "ECU / HW / SW data", "Read method", "Hardware notes"],
  },
  "dpf-off": {
    credits: "6",
    turnaround: "~30 min",
    supported: ["BMW Diesel", "Mercedes CDI", "VAG TDI", "Opel Diesel", "Renault Diesel", "Peugeot HDI"],
    required: ["Original ECU file", "DPF fault codes", "Vehicle and engine", "Read method", "Workshop notes"],
  },
  "egr-off": {
    credits: "6",
    turnaround: "~30 min",
    supported: ["BMW", "Mercedes-Benz", "Audi", "VW", "Skoda", "Seat", "Opel", "Renault"],
    required: ["Original ECU file", "EGR fault codes", "Vehicle data", "ECU family", "Read method"],
  },
  "adblue-off": {
    credits: "11",
    turnaround: "~30 min",
    supported: ["Mercedes CDI", "BMW Diesel", "VAG TDI", "Opel Diesel", "Renault Diesel", "Peugeot HDI"],
    required: ["Original ECU file", "AdBlue / SCR codes", "Vehicle data", "Read method", "System condition notes"],
  },
  "dtc-off": {
    credits: "4",
    turnaround: "Fast review",
    supported: ["BMW", "Mercedes-Benz", "Audi", "VW", "Porsche", "Opel", "Renault", "Peugeot"],
    required: ["Exact DTC list", "Original ECU file", "Vehicle and ECU data", "Read method", "Fault context"],
  },
};

type ServiceTemplate = {
  eyebrow: string;
  description: (name: string) => string;
  hero: (name: string) => string;
  intro: (name: string) => string[];
  benefits: string[];
  process: { title: string; text: string }[];
  faq: (name: string) => { q: string; a: string }[];
};

const serviceTemplates: Record<LocaleCode, ServiceTemplate> = {
  en: {
    eyebrow: "Workshop file-service workflow",
    description: (name) =>
      `${name} for workshops and tuning partners with secure upload, credit-based checkout, order tracking and controlled file delivery.`,
    hero: (name) =>
      `${name} handled through a professional portal workflow: request, file check, processing, delivery and revision support.`,
    intro: (name) => [
      `${name} is designed for workshops that need a clear technical process instead of scattered messages and uncontrolled file exchange.`,
      "The original file, vehicle details, read method, ECU information and notes stay attached to the order from upload to delivery.",
    ],
    benefits: [
      "Secure customer dashboard for original and modified files",
      "Status timeline for request created, file check, in progress and completed",
      "Credit-based workflow with Stripe card payment and bank transfer",
      "Revision request support after completed delivery",
    ],
    process: [
      { title: "Submit vehicle data", text: "Customer selects vehicle, ECU, read method and service details." },
      { title: "Upload original file", text: "The original ECU/TCU file is connected to the customer account." },
      { title: "Technical review", text: "MG AutoTech checks the request and asks for more information if needed." },
      { title: "Secure delivery", text: "The completed file is delivered inside the order detail view." },
    ],
    faq: (name) => [
      { q: `How fast is ${name}?`, a: "Standard files are usually handled quickly, often around 30 minutes, depending on workload and file complexity." },
      { q: "Can I request a revision?", a: "Yes. Completed orders include revision support through the customer dashboard." },
    ],
  },
  de: {
    eyebrow: "Ablauf für den Werkstatt-Dateiservice",
    description: (name) =>
      `${name} für Werkstätten und Tuning-Partner mit sicherem Hochladen, Credit-Abrechnung, Auftragsverfolgung und kontrollierter Dateilieferung.`,
    hero: (name) =>
      `${name} in einem professionellen Portal-Ablauf: Anfrage, Dateiprüfung, Bearbeitung, Lieferung und Revision.`,
    intro: (name) => [
      `${name} ist für Werkstätten gedacht, die einen klaren technischen Ablauf statt verstreuter Nachrichten und unsicherem Dateiaustausch brauchen.`,
      "Originaldatei, Fahrzeugdaten, Lesemethode, ECU-Informationen und Notizen bleiben vom Hochladen bis zur Lieferung am Auftrag.",
    ],
    benefits: [
      "Sicheres Kundenportal für Originaldateien und modifizierte Dateien",
      "Klarer Statusverlauf für Anfrage, Dateiprüfung, Bearbeitung und Abschluss",
      "Credit-basierter Ablauf mit Stripe-Kartenzahlung und Banküberweisung",
      "Revisionsanfrage nach abgeschlossener Lieferung möglich",
    ],
    process: [
      { title: "Fahrzeugdaten senden", text: "Kunde wählt Fahrzeug, ECU, Lesemethode und Service-Details." },
      { title: "Originaldatei hochladen", text: "Die originale ECU/TCU-Datei wird dem Kundenkonto zugeordnet." },
      { title: "Technische Prüfung", text: "MG AutoTech prüft die Anfrage und fordert bei Bedarf weitere Informationen an." },
      { title: "Sichere Lieferung", text: "Die fertige Datei wird in der Auftragsdetailseite bereitgestellt." },
    ],
    faq: (name) => [
      { q: `Wie schnell ist ${name}?`, a: "Standarddateien werden meist schnell bearbeitet, oft um 30 Minuten, abhängig von Auslastung und Dateikomplexität." },
      { q: "Ist eine Revision möglich?", a: "Ja. Abgeschlossene Aufträge können direkt im Kundenportal als Revision angefragt werden." },
    ],
  },
  tr: {
    eyebrow: "Servisler için dosya iş akışı",
    description: (name) =>
      `${name}; servisler ve tuning partnerleri için güvenli yükleme, kredi bazlı ödeme, sipariş takibi ve kontrollü dosya teslimatıyla hazırlanır.`,
    hero: (name) =>
      `${name} profesyonel panel akışıyla yürür: talep, dosya kontrolü, işlem, teslimat ve revizyon desteği.`,
    intro: (name) => [
      `${name}, dağınık mesajlaşma ve kontrolsüz dosya trafiği yerine net teknik süreç isteyen servisler için tasarlandı.`,
      "Orijinal dosya, araç bilgisi, okuma yöntemi, ECU detayı ve notlar yüklemeden teslimata kadar siparişe bağlı kalır.",
    ],
    benefits: [
      "Orijinal ve düzenlenmiş dosyalar için güvenli müşteri paneli",
      "Talep oluşturuldu, dosya kontrolü, işlemde ve tamamlandı durum akışı",
      "Stripe kart ödeme ve banka transferli kredi akışı",
      "Tamamlanan teslimat sonrası revizyon talebi desteği",
    ],
    process: [
      { title: "Araç bilgilerini gönder", text: "Müşteri araç, ECU, okuma yöntemi ve servis detaylarını seçer." },
      { title: "Orijinal dosyayı yükle", text: "Orijinal ECU/TCU dosyası müşteri hesabına bağlı şekilde saklanır." },
      { title: "Teknik kontrol", text: "MG AutoTech talebi kontrol eder ve gerekirse ek bilgi ister." },
      { title: "Güvenli teslimat", text: "Tamamlanan dosya sipariş detayından indirilir." },
    ],
    faq: (name) => [
      { q: `${name} ne kadar sürer?`, a: "Standart dosyalar genelde hızlı hazırlanır; çoğu işte süre yaklaşık 30 dakika civarındadır, yoğunluk ve dosya zorluğuna göre değişir." },
      { q: "Revizyon isteyebilir miyim?", a: "Evet. Tamamlanan siparişlerde müşteri panelinden revizyon talebi açılabilir." },
    ],
  },
  nl: {
    eyebrow: "Werkproces voor bestandsservice in de werkplaats",
    description: (name) =>
      `${name} voor werkplaatsen en tuningpartners met veilige bestandsoverdracht, creditbetaling, orderopvolging en gecontroleerde bestandslevering.`,
    hero: (name) =>
      `${name} via een professioneel portaal: aanvraag, bestandscontrole, verwerking, levering en revisieondersteuning.`,
    intro: (name) => [
      `${name} is bedoeld voor werkplaatsen die een duidelijk technisch werkproces nodig hebben.`,
      "Origineel bestand, voertuigdata, leesmethode, ECU-informatie en notities blijven aan de order gekoppeld.",
    ],
    benefits: ["Veilig klantenportaal", "Duidelijk statusverloop", "Werkproces op basis van credits", "Revisie mogelijk na levering"],
    process: [
      { title: "Voertuigdata indienen", text: "Selecteer voertuig, ECU, leesmethode en service." },
      { title: "Origineel bestand versturen", text: "Het originele ECU/TCU-bestand wordt aan het account gekoppeld." },
      { title: "Technische controle", text: "MG AutoTech controleert de aanvraag." },
      { title: "Veilige levering", text: "Het voltooide bestand staat in de orderdetailpagina." },
    ],
    faq: (name) => [
      { q: `Hoe snel is ${name}?`, a: "Standaardbestanden worden vaak rond 30 minuten verwerkt, afhankelijk van drukte en complexiteit." },
      { q: "Kan ik revisie aanvragen?", a: "Ja, via het klantenportaal." },
    ],
  },
  fr: {
    eyebrow: "Processus de service de fichiers pour ateliers",
    description: (name) =>
      `${name} pour ateliers et partenaires tuning avec envoi sécurisé, crédits, suivi de commande et livraison contrôlée.`,
    hero: (name) =>
      `${name} dans un portail professionnel: demande, contrôle fichier, traitement, livraison et révision.`,
    intro: (name) => [
      `${name} s'adresse aux ateliers qui veulent un processus technique clair.`,
      "Fichier original, données véhicule, méthode de lecture, ECU et notes restent liés à la demande.",
    ],
    benefits: ["Portail client sécurisé", "Suivi clair du statut", "Processus basé sur des crédits", "Révision possible après livraison"],
    process: [
      { title: "Envoyer les données véhicule", text: "Sélection du véhicule, ECU, méthode de lecture et service." },
      { title: "Envoyer le fichier original", text: "Le fichier ECU/TCU original reste lié au compte client." },
      { title: "Contrôle technique", text: "MG AutoTech vérifie la demande." },
      { title: "Livraison sécurisée", text: "Le fichier terminé est disponible dans le détail de commande." },
    ],
    faq: (name) => [
      { q: `Quel délai pour ${name} ?`, a: "Les fichiers standards sont souvent traités autour de 30 minutes selon charge et complexité." },
      { q: "Puis-je demander une révision ?", a: "Oui, depuis le portail client." },
    ],
  },
  it: {
    eyebrow: "Processo di servizio file per officine",
    description: (name) =>
      `${name} per officine e partner tuning con caricamento sicuro, crediti, tracciamento ordine e consegna controllata.`,
    hero: (name) =>
      `${name} tramite portale professionale: richiesta, controllo file, lavorazione, consegna e revisione.`,
    intro: (name) => [
      `${name} è pensato per officine che vogliono un processo tecnico chiaro.`,
      "File originale, dati veicolo, metodo di lettura, ECU e note restano collegati all'ordine.",
    ],
    benefits: ["Portale cliente sicuro", "Stato ordine sempre chiaro", "Processo basato su crediti", "Revisione dopo la consegna"],
    process: [
      { title: "Invio dati veicolo", text: "Veicolo, ECU, metodo di lettura e servizio." },
      { title: "Caricamento file originale", text: "Il file ECU/TCU originale resta collegato all'account." },
      { title: "Controllo tecnico", text: "MG AutoTech controlla la richiesta." },
      { title: "Consegna sicura", text: "Il file completato è nella pagina ordine." },
    ],
    faq: (name) => [
      { q: `Quanto tempo richiede ${name}?`, a: "I file standard sono spesso gestiti intorno a 30 minuti, secondo carico e complessità." },
      { q: "Posso chiedere una revisione?", a: "Sì, dal portale cliente." },
    ],
  },
  ru: {
    eyebrow: "Процесс обработки файлов для автосервисов",
    description: (name) =>
      `${name} для автосервисов и партнёров по тюнингу: безопасная загрузка, кредиты, отслеживание заказа и контролируемая выдача файла.`,
    hero: (name) =>
      `${name} через профессиональный портал: запрос, проверка файла, обработка, выдача и ревизия.`,
    intro: (name) => [
      `${name} подходит сервисам, которым нужен понятный технический процесс.`,
      "Оригинальный файл, данные автомобиля, метод чтения, ECU и заметки остаются привязанными к заказу.",
    ],
    benefits: ["Безопасный клиентский портал", "Понятный ход выполнения заказа", "Расчёт с помощью кредитов", "Доработка после выдачи"],
    process: [
      { title: "Данные автомобиля", text: "Выбор автомобиля, ECU, метода чтения и услуги." },
      { title: "Загрузка оригинала", text: "Оригинальный ECU/TCU файл привязан к аккаунту." },
      { title: "Техническая проверка", text: "MG AutoTech проверяет запрос." },
      { title: "Безопасная выдача", text: "Готовый файл доступен в деталях заказа." },
    ],
    faq: (name) => [
      { q: `Сколько занимает ${name}?`, a: "Стандартные файлы часто обрабатываются около 30 минут, зависит от нагрузки и сложности." },
      { q: "Можно запросить ревизию?", a: "Да, через клиентский портал." },
    ],
  },
  es: {
    eyebrow: "Proceso de servicio de archivos para talleres",
    description: (name) =>
      `${name} para talleres y colaboradores de calibración con carga segura, créditos, seguimiento del pedido y entrega controlada.`,
    hero: (name) =>
      `${name} mediante portal profesional: solicitud, revisión, proceso, entrega y revisión posterior.`,
    intro: (name) => [
      `${name} está pensado para talleres que necesitan un proceso técnico claro.`,
      "Archivo original, datos del vehículo, método de lectura, ECU y notas quedan ligados al pedido.",
    ],
    benefits: ["Portal de cliente seguro", "Estado del pedido siempre claro", "Proceso basado en créditos", "Revisión después de la entrega"],
    process: [
      { title: "Enviar datos vehículo", text: "Vehículo, ECU, método de lectura y servicio." },
      { title: "Subir archivo original", text: "El archivo ECU/TCU original queda ligado a la cuenta." },
      { title: "Revisión técnica", text: "MG AutoTech revisa la solicitud." },
      { title: "Entrega segura", text: "El archivo terminado está en el detalle del pedido." },
    ],
    faq: (name) => [
      { q: `¿Cuánto tarda ${name}?`, a: "Los archivos estándar suelen gestionarse alrededor de 30 minutos, según carga y complejidad." },
      { q: "¿Puedo pedir revisión?", a: "Sí, desde el portal cliente." },
    ],
  },
  pt: {
    eyebrow: "Processo de serviço de ficheiros para oficinas",
    description: (name) =>
      `${name} para oficinas e parceiros de afinação com carregamento seguro, créditos, acompanhamento e entrega controlada.`,
    hero: (name) =>
      `${name} por portal profissional: pedido, verificação, processamento, entrega e revisão.`,
    intro: (name) => [
      `${name} foi pensado para oficinas que precisam de um processo técnico claro.`,
      "Ficheiro original, dados do veículo, método de leitura, ECU e notas ficam ligados ao pedido.",
    ],
    benefits: ["Portal de cliente seguro", "Estado do pedido sempre claro", "Processo baseado em créditos", "Revisão após entrega"],
    process: [
      { title: "Enviar dados do veículo", text: "Veículo, ECU, método de leitura e serviço." },
      { title: "Carregar ficheiro original", text: "O ficheiro ECU/TCU original fica ligado à conta." },
      { title: "Verificação técnica", text: "MG AutoTech verifica o pedido." },
      { title: "Entrega segura", text: "O ficheiro concluído fica no detalhe do pedido." },
    ],
    faq: (name) => [
      { q: `Quanto tempo demora ${name}?`, a: "Ficheiros standard são muitas vezes tratados perto de 30 minutos, conforme carga e complexidade." },
      { q: "Posso pedir revisão?", a: "Sim, no portal do cliente." },
    ],
  },
  zh: {
    eyebrow: "面向维修厂的文件服务流程",
    description: (name) =>
      `${name} 面向维修厂和调校合作伙伴，包含安全上传、积分结算、订单跟踪和受控文件交付。`,
    hero: (name) =>
      `${name} 通过专业门户完成：请求、文件检查、处理、交付和修订支持。`,
    intro: (name) => [
      `${name} 适合需要清晰技术流程的维修厂。`,
      "原始文件、车辆数据、读取方式、ECU 信息和备注都会保持在同一个订单中。",
    ],
    benefits: ["安全客户门户", "清晰状态时间线", "积分式流程", "交付后可请求修订"],
    process: [
      { title: "提交车辆数据", text: "选择车辆、ECU、读取方式和服务。" },
      { title: "上传原始文件", text: "原始 ECU/TCU 文件会连接到客户账户。" },
      { title: "技术检查", text: "MG AutoTech 检查请求。" },
      { title: "安全交付", text: "完成文件在订单详情中下载。" },
    ],
    faq: (name) => [
      { q: `${name} 需要多久？`, a: "标准文件通常处理较快，常见约 30 分钟，取决于工作量和复杂度。" },
      { q: "可以申请修订吗？", a: "可以，通过客户门户申请。" },
    ],
  },
  pl: {
    eyebrow: "Proces obsługi plików dla warsztatów",
    description: (name) =>
      `${name} dla warsztatów i partnerów tuningowych z bezpiecznym przesyłaniem, kredytami, śledzeniem i kontrolowaną dostawą pliku.`,
    hero: (name) =>
      `${name} przez profesjonalny portal: zlecenie, kontrola pliku, praca, dostawa i rewizja.`,
    intro: (name) => [
      `${name} jest dla warsztatów, które potrzebują jasnego procesu technicznego.`,
      "Oryginalny plik, dane pojazdu, metoda odczytu, ECU i notatki pozostają przy zleceniu.",
    ],
    benefits: ["Bezpieczny portal klienta", "Czytelny przebieg realizacji", "Proces rozliczany kredytami", "Poprawka po dostawie"],
    process: [
      { title: "Dane pojazdu", text: "Wybór pojazdu, ECU, metody odczytu i usługi." },
      { title: "Prześlij oryginalny plik", text: "Oryginalny plik ECU/TCU jest przypisany do konta." },
      { title: "Kontrola techniczna", text: "MG AutoTech sprawdza zlecenie." },
      { title: "Bezpieczna dostawa", text: "Gotowy plik jest w szczegółach zlecenia." },
    ],
    faq: (name) => [
      { q: `Ile trwa ${name}?`, a: "Standardowe pliki często są gotowe około 30 minut, zależnie od obciążenia i złożoności." },
      { q: "Czy mogę poprosić o rewizję?", a: "Tak, w portalu klienta." },
    ],
  },
  sq: {
    eyebrow: "Proces i shërbimit të skedarëve për servise",
    description: (name) =>
      `${name} për servise dhe partnerë tuning me ngarkim të sigurt, kredi, ndjekje porosie dhe dorëzim të kontrolluar.`,
    hero: (name) =>
      `${name} përmes portalit profesional: kërkesë, kontroll skedari, përpunim, dorëzim dhe revizion.`,
    intro: (name) => [
      `${name} është për servise që duan proces teknik të qartë.`,
      "Skedari origjinal, të dhënat e automjetit, metoda e leximit, ECU dhe shënimet lidhen me porosinë.",
    ],
    benefits: ["Portal i sigurt klienti", "Ecuri e qartë e statusit", "Proces me kredi", "Revizion pas dorëzimit"],
    process: [
      { title: "Dërgo të dhënat", text: "Automjeti, ECU, metoda e leximit dhe shërbimi." },
      { title: "Ngarko skedarin origjinal", text: "Skedari ECU/TCU lidhet me llogarinë." },
      { title: "Kontroll teknik", text: "MG AutoTech kontrollon kërkesën." },
      { title: "Dorëzim i sigurt", text: "Skedari i përfunduar është në detajet e porosisë." },
    ],
    faq: (name) => [
      { q: `Sa zgjat ${name}?`, a: "Skedarët standardë shpesh trajtohen rreth 30 minuta, sipas ngarkesës dhe kompleksitetit." },
      { q: "A mund të kërkoj revizion?", a: "Po, nga portali i klientit." },
    ],
  },
};

const localizedServiceOperations: Record<
  LocaleCode,
  { standardTurnaround: string; fastReview: string; required: string[] }
> = {
  en: {
    standardTurnaround: "Usually around 30 minutes",
    fastReview: "Fast technical review",
    required: ["Original ECU/TCU file", "Vehicle model and engine", "ECU and HW/SW information", "Read method", "Fault codes and workshop notes"],
  },
  de: {
    standardTurnaround: "In der Regel etwa 30 Minuten",
    fastReview: "Schnelle technische Prüfung",
    required: ["Originale ECU-/TCU-Datei", "Fahrzeugmodell und Motor", "Steuergerät und HW-/SW-Daten", "Lesemethode", "Fehlercodes und Werkstattnotizen"],
  },
  nl: {
    standardTurnaround: "Meestal rond 30 minuten",
    fastReview: "Snelle technische controle",
    required: ["Origineel ECU/TCU-bestand", "Voertuigmodel en motor", "ECU- en HW/SW-informatie", "Leesmethode", "Foutcodes en werkplaatsnotities"],
  },
  fr: {
    standardTurnaround: "En général autour de 30 minutes",
    fastReview: "Contrôle technique rapide",
    required: ["Fichier ECU/TCU d'origine", "Modèle du véhicule et moteur", "ECU et informations HW/SW", "Méthode de lecture", "Codes défaut et notes atelier"],
  },
  it: {
    standardTurnaround: "Di solito circa 30 minuti",
    fastReview: "Controllo tecnico rapido",
    required: ["File ECU/TCU originale", "Modello veicolo e motore", "ECU e dati HW/SW", "Metodo di lettura", "Codici guasto e note officina"],
  },
  ru: {
    standardTurnaround: "Обычно около 30 минут",
    fastReview: "Быстрая техническая проверка",
    required: ["Исходный файл ECU/TCU", "Модель автомобиля и двигатель", "ECU и данные HW/SW", "Метод чтения", "Коды ошибок и заметки сервиса"],
  },
  es: {
    standardTurnaround: "Normalmente unos 30 minutos",
    fastReview: "Revisión técnica rápida",
    required: ["Archivo ECU/TCU original", "Modelo del vehículo y motor", "ECU y datos HW/SW", "Método de lectura", "Códigos de avería y notas del taller"],
  },
  tr: {
    standardTurnaround: "Genellikle yaklaşık 30 dakika",
    fastReview: "Hızlı teknik kontrol",
    required: ["Orijinal ECU/TCU dosyası", "Araç modeli ve motor", "ECU ile HW/SW bilgileri", "Okuma yöntemi", "Arıza kodları ve servis notları"],
  },
  pt: {
    standardTurnaround: "Normalmente cerca de 30 minutos",
    fastReview: "Verificação técnica rápida",
    required: ["Ficheiro ECU/TCU original", "Modelo do veículo e motor", "ECU e dados HW/SW", "Método de leitura", "Códigos de avaria e notas da oficina"],
  },
  zh: {
    standardTurnaround: "通常约 30 分钟",
    fastReview: "快速技术审核",
    required: ["原始 ECU/TCU 文件", "车型与发动机信息", "ECU 与 HW/SW 信息", "读取方式", "故障码与车间备注"],
  },
  pl: {
    standardTurnaround: "Zwykle około 30 minut",
    fastReview: "Szybka kontrola techniczna",
    required: ["Oryginalny plik ECU/TCU", "Model pojazdu i silnik", "ECU oraz dane HW/SW", "Metoda odczytu", "Kody błędów i uwagi warsztatu"],
  },
  sq: {
    standardTurnaround: "Zakonisht rreth 30 minuta",
    fastReview: "Kontroll i shpejtë teknik",
    required: ["File origjinal ECU/TCU", "Modeli i automjetit dhe motori", "ECU dhe të dhënat HW/SW", "Metoda e leximit", "Kodet e defekteve dhe shënimet e servisit"],
  },
};

export function getServiceSeo(slug: PublicServiceSlug, locale: LocaleCode) {
  const name = serviceNames[slug][locale] ?? serviceNames[slug][defaultLocale];
  const template = serviceTemplates[locale] ?? serviceTemplates[defaultLocale];
  const operations = localizedServiceOperations[locale] ?? localizedServiceOperations[defaultLocale];
  const meta = serviceMeta[slug];

  return {
    slug,
    name,
    eyebrow: template.eyebrow,
    title: name,
    description: template.description(name),
    hero: template.hero(name),
    intro: template.intro(name),
    benefits: template.benefits,
    process: template.process,
    faq: template.faq(name),
    ...meta,
    turnaround: slug === "dtc-off" ? operations.fastReview : operations.standardTurnaround,
    required: operations.required,
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "AutomotiveBusiness"],
    "@id": `${siteUrl}/#organization`,
    name: "MG AutoTech",
    legalName: "MG AutoTech - Melih Gokkaya",
    description:
      "Professional ECU and TCU file service platform for workshops and automotive tuning partners.",
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
        contactType: "customer support",
        availableLanguage: seoLocales.map((locale) => hreflangByLocale[locale]),
        areaServed: ["DE", "EU"],
      },
    ],
    areaServed: ["Germany", "European Union", "Europe"],
    currenciesAccepted: "EUR",
    priceRange: "EUR",
    knowsAbout: [
      "ECU file service",
      "TCU tuning",
      "Stage 1 tuning",
      "Stage 2 ECU file service",
      "TCU file service",
      "ECU file verification",
      "DPF OFF",
      "EGR OFF",
      "AdBlue OFF",
      "DTC OFF",
      "AutoTuner",
      "WinOLS",
    ],
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

export function serviceJsonLd(slug: PublicServiceSlug, locale: LocaleCode) {
  const service = getServiceSeo(slug, locale);

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description,
    serviceType: service.name,
    inLanguage: hreflangByLocale[locale],
    category: "Automotive ECU and TCU file service",
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Automotive workshops and tuning professionals",
    },
    provider: {
      "@id": `${siteUrl}/#organization`,
    },
    areaServed: ["Germany", "Europe"],
    url: localizedUrl(locale, `/services/${slug}`),
    mainEntityOfPage: localizedUrl(locale, `/services/${slug}`),
  };
}
