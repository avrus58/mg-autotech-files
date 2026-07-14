import { absoluteUrl, hreflangByLocale, isPublicServiceSlug, localizedUrl } from "@/lib/seo";
import type { LocaleCode } from "@/lib/i18n";

export type FileServiceHubCard = {
  title: string;
  text: string;
  href: string;
  action: string;
  tag: string;
};

export type FileServiceHubStep = {
  title: string;
  text: string;
};

export type FileServiceHubFaq = {
  question: string;
  answer: string;
};

export type FileServiceHubCopy = {
  pageTitle: string;
  description: string;
  nav: {
    fileService: string;
    services: string;
    howItWorks: string;
    login: string;
    startRequest: string;
  };
  eyebrow: string;
  title: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  metrics: string[];
  categoriesKicker: string;
  categoriesTitle: string;
  categoriesText: string;
  workflowKicker: string;
  workflowTitle: string;
  workflowText: string;
  resourcesKicker: string;
  resourcesTitle: string;
  resourcesText: string;
  safetyKicker: string;
  safetyTitle: string;
  safetyText: string;
  faqKicker: string;
  faqTitle: string;
  finalTitle: string;
  finalText: string;
  serviceCategories: FileServiceHubCard[];
  workflowSteps: FileServiceHubStep[];
  linkedResources: FileServiceHubCard[];
  safetyBoundaries: string[];
  faq: FileServiceHubFaq[];
};

const en: FileServiceHubCopy = {
  pageTitle: "ECU & TCU File Service Hub",
  description:
    "MG AutoTech file service hub for ECU tuning files, TCU support, diagnostic support requests, secure uploads and workshop file workflows.",
  nav: {
    fileService: "File service",
    services: "Services",
    howItWorks: "How it works",
    login: "Login",
    startRequest: "Start request",
  },
  eyebrow: "Professional file service",
  title: "ECU & TCU file service for workshops that need a secure specialist workflow.",
  intro:
    "MG AutoTech helps workshops submit tuning and diagnostic file requests through a controlled portal with vehicle selection, secure upload handling, admin review and customer-safe delivery steps.",
  primaryCta: "Start a secure request",
  secondaryCta: "See the workflow",
  metrics: [
    "Secure customer portal",
    "Vehicle database assisted intake",
    "Admin reviewed file workflow",
    "Customer-safe status updates",
  ],
  categoriesKicker: "Service categories",
  categoriesTitle: "File services organized around real workshop requests.",
  categoriesText:
    "The hub connects customers to the main request types without exposing internal tuning evidence, private analysis notes or admin-only metadata.",
  workflowKicker: "Workflow",
  workflowTitle: "A clear portal flow from vehicle selection to reviewed delivery.",
  workflowText:
    "Customers submit vehicle details and files through the portal. Admins review the work order, check the file context and communicate only customer-safe updates.",
  resourcesKicker: "SEO resource map",
  resourcesTitle: "Useful landing paths for file service searches.",
  resourcesText:
    "These pages help customers understand the platform while giving search engines a clean structure for MG AutoTech file service topics.",
  safetyKicker: "Safety boundaries",
  safetyTitle: "Professional support without exposing private internals.",
  safetyText:
    "The public website describes the service workflow. Technical evidence, private source references, file paths and admin notes stay inside protected staff tools.",
  faqKicker: "FAQ",
  faqTitle: "File service questions customers ask before starting.",
  finalTitle: "Ready to submit a file service request?",
  finalText:
    "Use the secure request flow so MG AutoTech can review the vehicle, selected service and file context before any work starts.",
  serviceCategories: [
    {
      title: "Stage 1 file service",
      text: "Structured intake for performance file requests with vehicle data, selected service and secure file upload.",
      href: "/services/stage-1",
      action: "Open Stage 1",
      tag: "Performance",
    },
    {
      title: "DPF, EGR and AdBlue support",
      text: "Guided service selection for common workshop support requests, always routed through admin review.",
      href: "/services/dpf-off",
      action: "Open service page",
      tag: "Workshop support",
    },
    {
      title: "TCU and gearbox support",
      text: "A request path for transmission-related file work and torque context where supported.",
      href: "/ecu-platforms/transmission-control-units",
      action: "Open TCU page",
      tag: "TCU",
    },
  ],
  workflowSteps: [
    {
      title: "Select vehicle",
      text: "Choose brand, model, generation and engine from the public vehicle catalog or provide details manually when needed.",
    },
    {
      title: "Choose service",
      text: "Pick the requested file service and add customer-safe notes that explain the workshop objective.",
    },
    {
      title: "Upload securely",
      text: "Files are submitted through the protected request flow and reviewed inside the admin work-order system.",
    },
    {
      title: "Track progress",
      text: "Customers see request status and customer-visible messages while internal checks remain protected.",
    },
  ],
  linkedResources: [
    {
      title: "How MG AutoTech works",
      text: "A customer-friendly explanation of the request, review, upload and delivery process.",
      href: "/how-it-works",
      action: "Read the process",
      tag: "Guide",
    },
    {
      title: "Vehicle coverage",
      text: "Explore supported brands and file-service vehicle intake paths.",
      href: "/brands",
      action: "View brands",
      tag: "Catalog",
    },
    {
      title: "ECU platforms",
      text: "Understand common ECU platform terms used in professional file service work.",
      href: "/ecu-platforms",
      action: "Open platforms",
      tag: "Technical SEO",
    },
    {
      title: "Workshop tools",
      text: "Customer-safe tools and references that support the file service workflow.",
      href: "/tools",
      action: "Open tools",
      tag: "Resources",
    },
  ],
  safetyBoundaries: [
    "Customer pages never show admin notes, private evidence, source references or internal review data.",
    "The public site does not expose protected upload paths, private file metadata or staff-only analysis details.",
    "AI and dataset intelligence remain admin-reviewed support systems, not automatic customer file generation.",
    "Payment and request status remain separated from public SEO content.",
  ],
  faq: [
    {
      question: "What is an ECU or TCU file service?",
      answer:
        "It is a specialist workflow where a workshop submits vehicle details, selected service information and a file through a protected portal so MG AutoTech can review and process the request.",
    },
    {
      question: "Can I track my request online?",
      answer:
        "Yes. Customers can use the dashboard to follow request status and see customer-visible messages from MG AutoTech.",
    },
    {
      question: "Does the public website show private technical data?",
      answer:
        "No. Public pages and customer pages are designed to hide internal notes, private evidence, source references and staff-only analysis details.",
    },
    {
      question: "Where should a workshop start?",
      answer:
        "Start with the secure request form, select the vehicle and service, then upload the relevant file through the portal.",
    },
  ],
};

const de: FileServiceHubCopy = {
  ...en,
  pageTitle: "ECU und TCU Dateiservice Hub",
  description:
    "MG AutoTech Dateiservice Hub fuer ECU Tuning Files, TCU Support, Diagnose-Anfragen, sichere Uploads und Werkstatt Workflows.",
  nav: {
    fileService: "Dateiservice",
    services: "Services",
    howItWorks: "Ablauf",
    login: "Login",
    startRequest: "Anfrage starten",
  },
  eyebrow: "Professioneller Dateiservice",
  title: "ECU und TCU Dateiservice fuer Werkstaetten mit sicherem Spezialisten-Workflow.",
  intro:
    "MG AutoTech hilft Werkstaetten, Tuning- und Diagnose-Dateianfragen ueber ein kontrolliertes Portal einzureichen: mit Fahrzeugauswahl, sicherer Dateiuebermittlung, Admin-Pruefung und kundensicheren Statusmeldungen.",
  primaryCta: "Sichere Anfrage starten",
  secondaryCta: "Ablauf ansehen",
  metrics: [
    "Sicheres Kundenportal",
    "Fahrzeugdatenbank fuer die Anfrage",
    "Admin-gepruefter Dateiworkflow",
    "Kundensichere Statusmeldungen",
  ],
  categoriesKicker: "Servicebereiche",
  categoriesTitle: "Dateiservices nach echten Werkstatt-Anfragen geordnet.",
  categoriesText:
    "Der Hub fuehrt Kunden zu den wichtigsten Anfragearten, ohne interne Tuning-Evidenz, private Analysehinweise oder Admin-Metadaten offenzulegen.",
  workflowKicker: "Ablauf",
  workflowTitle: "Ein klarer Portalprozess von Fahrzeugauswahl bis gepruefter Lieferung.",
  workflowText:
    "Kunden uebermitteln Fahrzeugdaten und Dateien ueber das Portal. Admins pruefen den Work Order, den Dateikontext und kommunizieren nur kundensichere Updates.",
  resourcesKicker: "SEO Ressourcen",
  resourcesTitle: "Sinnvolle Einstiegsseiten fuer Dateiservice-Suchen.",
  resourcesText:
    "Diese Seiten erklaeren den Ablauf fuer Kunden und geben Suchmaschinen eine klare Struktur fuer MG AutoTech Dateiservice-Themen.",
  safetyKicker: "Sicherheitsgrenzen",
  safetyTitle: "Professioneller Support ohne private Interna.",
  safetyText:
    "Die oeffentliche Website beschreibt den Serviceprozess. Technische Evidenz, private Quellen, Dateipfade und Admin-Notizen bleiben in geschuetzten Staff-Tools.",
  faqKicker: "FAQ",
  faqTitle: "Dateiservice-Fragen vor dem Start.",
  finalTitle: "Bereit fuer eine Dateiservice-Anfrage?",
  finalText:
    "Nutze den sicheren Anfrageprozess, damit MG AutoTech Fahrzeug, Service und Dateikontext vor Arbeitsbeginn pruefen kann.",
  serviceCategories: [
    {
      title: "Stage 1 Dateiservice",
      text: "Strukturierte Anfrage fuer Performance-Dateien mit Fahrzeugdaten, Serviceauswahl und sicherem Upload.",
      href: "/services/stage-1",
      action: "Stage 1 oeffnen",
      tag: "Performance",
    },
    {
      title: "DPF, EGR und AdBlue Support",
      text: "Gefuehrte Serviceauswahl fuer haeufige Werkstatt-Anfragen, immer mit Admin-Pruefung.",
      href: "/services/dpf-off",
      action: "Service oeffnen",
      tag: "Werkstatt",
    },
    {
      title: "TCU und Getriebe-Support",
      text: "Anfragepfad fuer getriebebezogene Dateiarbeit und Drehmoment-Kontext, wo unterstuetzt.",
      href: "/ecu-platforms/transmission-control-units",
      action: "TCU oeffnen",
      tag: "TCU",
    },
  ],
  workflowSteps: [
    {
      title: "Fahrzeug auswaehlen",
      text: "Marke, Modell, Generation und Motor aus dem Fahrzeugkatalog waehlen oder Details manuell ergaenzen.",
    },
    {
      title: "Service waehlen",
      text: "Gewuenschten Dateiservice auswaehlen und kundensichere Hinweise zum Werkstattziel ergaenzen.",
    },
    {
      title: "Sicher hochladen",
      text: "Dateien werden ueber den geschuetzten Anfrageprozess eingereicht und im Admin Work Order geprueft.",
    },
    {
      title: "Status verfolgen",
      text: "Kunden sehen Status und kundensichtbare Nachrichten, waehrend interne Pruefungen geschuetzt bleiben.",
    },
  ],
  linkedResources: [
    {
      title: "MG AutoTech Ablauf",
      text: "Kundenfreundliche Erklaerung von Anfrage, Pruefung, Upload und Lieferung.",
      href: "/how-it-works",
      action: "Ablauf lesen",
      tag: "Guide",
    },
    {
      title: "Fahrzeugabdeckung",
      text: "Unterstuetzte Marken und Fahrzeugpfade fuer Dateiservice-Anfragen ansehen.",
      href: "/brands",
      action: "Marken ansehen",
      tag: "Katalog",
    },
    {
      title: "ECU Plattformen",
      text: "Haeufige ECU Plattformbegriffe im professionellen Dateiservice verstehen.",
      href: "/ecu-platforms",
      action: "Plattformen oeffnen",
      tag: "Technik SEO",
    },
    {
      title: "Werkstatt Tools",
      text: "Kundensichere Tools und Referenzen fuer den Dateiservice-Workflow.",
      href: "/tools",
      action: "Tools oeffnen",
      tag: "Ressourcen",
    },
  ],
  safetyBoundaries: [
    "Kundenseiten zeigen keine Admin-Notizen, private Evidenz, Quellen oder interne Review-Daten.",
    "Die oeffentliche Website zeigt keine geschuetzten Uploadpfade, privaten Dateimetadaten oder Staff-Analysen.",
    "AI- und Dataset-Intelligence bleiben admin-gepruefte Support-Systeme, keine automatische Kundendatei-Erzeugung.",
    "Payment- und Anfrage-Status bleiben von oeffentlichen SEO-Inhalten getrennt.",
  ],
  faq: [
    {
      question: "Was ist ein ECU oder TCU Dateiservice?",
      answer:
        "Ein Spezialisten-Workflow, bei dem eine Werkstatt Fahrzeugdaten, Serviceauswahl und eine Datei ueber ein geschuetztes Portal einreicht.",
    },
    {
      question: "Kann ich meine Anfrage online verfolgen?",
      answer:
        "Ja. Kunden koennen im Dashboard den Status verfolgen und kundensichtbare Nachrichten von MG AutoTech sehen.",
    },
    {
      question: "Zeigt die Website private technische Daten?",
      answer:
        "Nein. Oeffentliche und Kunden-Seiten verbergen interne Notizen, private Evidenz, Quellen und Staff-Analysen.",
    },
    {
      question: "Wo startet eine Werkstatt?",
      answer:
        "Mit dem sicheren Anfrageformular: Fahrzeug und Service waehlen, dann die relevante Datei im Portal einreichen.",
    },
  ],
};

const tr: FileServiceHubCopy = {
  ...en,
  pageTitle: "ECU ve TCU Dosya Servisi Merkezi",
  description:
    "MG AutoTech dosya servisi merkezi: ECU tuning dosyalari, TCU destek talepleri, guvenli yukleme ve profesyonel atelye sureci.",
  nav: {
    fileService: "Dosya servisi",
    services: "Servisler",
    howItWorks: "Nasil calisir",
    login: "Giris",
    startRequest: "Talep baslat",
  },
  eyebrow: "Profesyonel dosya servisi",
  title: "Guvenli uzman sureci isteyen atelyeler icin ECU ve TCU dosya servisi.",
  intro:
    "MG AutoTech, atelyelerin tuning ve diagnostik dosya taleplerini kontrollu bir portal uzerinden gondermesine yardim eder: arac secimi, guvenli yukleme, admin incelemesi ve musteriye uygun durum guncellemeleri ile.",
  primaryCta: "Guvenli talep baslat",
  secondaryCta: "Sureci incele",
  metrics: [
    "Guvenli musteri portali",
    "Arac veritabani destekli talep",
    "Admin incelemeli dosya sureci",
    "Musteriye uygun durum guncellemeleri",
  ],
  categoriesKicker: "Servis kategorileri",
  categoriesTitle: "Gercek atelye taleplerine gore duzenlenmis dosya servisleri.",
  categoriesText:
    "Bu merkez, musterileri ana talep turlerine yonlendirir; dahili tuning kanitlari, ozel analiz notlari ve admin metadatalari disari acilmaz.",
  workflowKicker: "Surec",
  workflowTitle: "Arac seciminden incelenmis teslimata kadar net portal akisi.",
  workflowText:
    "Musteriler arac bilgilerini ve dosyayi portal uzerinden gonderir. Adminler is emrini, dosya baglamini ve musteriye uygun mesajlari kontrol eder.",
  resourcesKicker: "SEO kaynak haritasi",
  resourcesTitle: "Dosya servisi aramalari icin guclu giris sayfalari.",
  resourcesText:
    "Bu sayfalar musterilere platformu anlatir ve arama motorlarina MG AutoTech dosya servisi konulari icin temiz bir yapi verir.",
  safetyKicker: "Guvenlik sinirlari",
  safetyTitle: "Ozel detaylari acmadan profesyonel destek.",
  safetyText:
    "Herkese acik website servis surecini anlatir. Teknik kanitlar, ozel kaynaklar, dosya yollari ve admin notlari korumali staff araclarinda kalir.",
  faqKicker: "SSS",
  faqTitle: "Baslamadan once sorulan dosya servisi sorulari.",
  finalTitle: "Dosya servisi talebi gondermeye hazir misin?",
  finalText:
    "MG AutoTech'in arac, secilen servis ve dosya baglamini is baslamadan once inceleyebilmesi icin guvenli talep akisini kullan.",
  serviceCategories: [
    {
      title: "Stage 1 dosya servisi",
      text: "Performans dosya talepleri icin arac bilgisi, servis secimi ve guvenli yukleme ile duzenli talep akisi.",
      href: "/services/stage-1",
      action: "Stage 1 ac",
      tag: "Performans",
    },
    {
      title: "DPF, EGR ve AdBlue destek",
      text: "Yaygin atelye destek talepleri icin rehberli servis secimi, her zaman admin incelemesi ile.",
      href: "/services/dpf-off",
      action: "Servis sayfasi",
      tag: "Atelye",
    },
    {
      title: "TCU ve sanziman destek",
      text: "Desteklenen durumlarda sanziman odakli dosya calismasi ve tork baglami icin talep yolu.",
      href: "/ecu-platforms/transmission-control-units",
      action: "TCU sayfasi",
      tag: "TCU",
    },
  ],
  workflowSteps: [
    {
      title: "Arac sec",
      text: "Marka, model, nesil ve motoru arac katalogundan sec veya gerekli durumlarda bilgileri manuel ekle.",
    },
    {
      title: "Servis sec",
      text: "Istenen dosya servisini sec ve atelye hedefini anlatan musteriye uygun notlari ekle.",
    },
    {
      title: "Guvenli yukle",
      text: "Dosyalar korumali talep akisi uzerinden gonderilir ve admin is emri sisteminde incelenir.",
    },
    {
      title: "Durumu takip et",
      text: "Musteriler talep durumunu ve musteriye acik mesajlari gorur; dahili kontroller korunur.",
    },
  ],
  linkedResources: [
    {
      title: "MG AutoTech nasil calisir",
      text: "Talep, inceleme, yukleme ve teslimat surecinin musteriye uygun anlatimi.",
      href: "/how-it-works",
      action: "Sureci oku",
      tag: "Rehber",
    },
    {
      title: "Arac kapsami",
      text: "Desteklenen markalari ve dosya servisi arac talep yollarini incele.",
      href: "/brands",
      action: "Markalari gor",
      tag: "Katalog",
    },
    {
      title: "ECU platformlari",
      text: "Profesyonel dosya servisinde kullanilan yaygin ECU platform terimlerini anla.",
      href: "/ecu-platforms",
      action: "Platformlari ac",
      tag: "Teknik SEO",
    },
    {
      title: "Atelye araclari",
      text: "Dosya servisi surecini destekleyen musteriye uygun araclar ve referanslar.",
      href: "/tools",
      action: "Araclari ac",
      tag: "Kaynaklar",
    },
  ],
  safetyBoundaries: [
    "Musteri sayfalari admin notlarini, ozel kanitlari, kaynaklari veya dahili inceleme verilerini gostermez.",
    "Herkese acik site korumali yukleme yollarini, ozel dosya metadatalarini veya staff analizlerini acmaz.",
    "AI ve dataset intelligence admin incelemeli destek sistemleridir; otomatik musteri dosyasi uretimi degildir.",
    "Odeme ve talep durumlari herkese acik SEO iceriklerinden ayridir.",
  ],
  faq: [
    {
      question: "ECU veya TCU dosya servisi nedir?",
      answer:
        "Atelyenin arac bilgilerini, servis secimini ve dosyayi korumali portal uzerinden gonderdigi uzman destek surecidir.",
    },
    {
      question: "Talebimi online takip edebilir miyim?",
      answer:
        "Evet. Musteriler dashboard uzerinden talep durumunu ve MG AutoTech tarafindan paylasilan musteriye acik mesajlari gorebilir.",
    },
    {
      question: "Website ozel teknik verileri gosterir mi?",
      answer:
        "Hayir. Herkese acik ve musteri sayfalari dahili notlari, ozel kanitlari, kaynaklari ve staff analizlerini gizler.",
    },
    {
      question: "Bir atelye nereden baslamali?",
      answer:
        "Guvenli talep formu ile basla: araci ve servisi sec, sonra ilgili dosyayi portal uzerinden gonder.",
    },
  ],
};

const localizedCopy: Record<LocaleCode, FileServiceHubCopy> = {
  en,
  de,
  tr,
  fr: {
    ...en,
    pageTitle: "Hub de service fichier ECU et TCU",
    title: "Service fichier ECU et TCU pour ateliers avec workflow securise.",
    eyebrow: "Service fichier professionnel",
    primaryCta: "Demarrer une demande",
    secondaryCta: "Voir le workflow",
    nav: { ...en.nav, fileService: "Service fichier", howItWorks: "Fonctionnement", startRequest: "Demarrer" },
  },
  es: {
    ...en,
    pageTitle: "Centro de servicio de archivos ECU y TCU",
    title: "Servicio de archivos ECU y TCU para talleres con flujo seguro.",
    eyebrow: "Servicio profesional de archivos",
    primaryCta: "Iniciar solicitud",
    secondaryCta: "Ver el flujo",
    nav: { ...en.nav, fileService: "Servicio de archivos", howItWorks: "Como funciona", startRequest: "Iniciar" },
  },
  it: {
    ...en,
    pageTitle: "Hub servizio file ECU e TCU",
    title: "Servizio file ECU e TCU per officine con workflow sicuro.",
    eyebrow: "Servizio file professionale",
    primaryCta: "Avvia richiesta",
    secondaryCta: "Vedi workflow",
    nav: { ...en.nav, fileService: "Servizio file", howItWorks: "Come funziona", startRequest: "Avvia" },
  },
  nl: {
    ...en,
    pageTitle: "ECU en TCU file service hub",
    title: "ECU en TCU file service voor werkplaatsen met een veilig proces.",
    eyebrow: "Professionele file service",
    primaryCta: "Start aanvraag",
    secondaryCta: "Bekijk proces",
    nav: { ...en.nav, fileService: "File service", howItWorks: "Hoe het werkt", startRequest: "Start aanvraag" },
  },
  pl: {
    ...en,
    pageTitle: "Centrum uslug plikow ECU i TCU",
    title: "Usluga plikow ECU i TCU dla warsztatow z bezpiecznym procesem.",
    eyebrow: "Profesjonalna usluga plikow",
    primaryCta: "Rozpocznij zgloszenie",
    secondaryCta: "Zobacz proces",
    nav: { ...en.nav, fileService: "Usluga plikow", howItWorks: "Jak to dziala", startRequest: "Start" },
  },
  pt: {
    ...en,
    pageTitle: "Hub de servico de ficheiros ECU e TCU",
    title: "Servico de ficheiros ECU e TCU para oficinas com fluxo seguro.",
    eyebrow: "Servico profissional de ficheiros",
    primaryCta: "Iniciar pedido",
    secondaryCta: "Ver processo",
    nav: { ...en.nav, fileService: "Servico de ficheiros", howItWorks: "Como funciona", startRequest: "Iniciar" },
  },
  ru: {
    ...en,
    pageTitle: "ECU and TCU File Service Hub",
    title: "Secure ECU and TCU file service workflow for workshops.",
    eyebrow: "Professional file service",
    primaryCta: "Start request",
    secondaryCta: "See workflow",
  },
  zh: {
    ...en,
    pageTitle: "ECU and TCU File Service Hub",
    title: "Secure ECU and TCU file service workflow for workshops.",
    eyebrow: "Professional file service",
    primaryCta: "Start request",
    secondaryCta: "See workflow",
  },
  sq: {
    ...en,
    pageTitle: "ECU and TCU File Service Hub",
    title: "Secure ECU and TCU file service workflow for workshops.",
    eyebrow: "Professional file service",
    primaryCta: "Start request",
    secondaryCta: "See workflow",
  },
};

export function getFileServiceCopy(locale: LocaleCode): FileServiceHubCopy {
  return localizedCopy[locale] ?? localizedCopy.en;
}

function fileServiceHrefUrl(locale: LocaleCode, href: string) {
  const [segment, slug] = href.split("/").filter(Boolean);

  if (href === "/file-service" || href === "/how-it-works") {
    return localizedUrl(locale, href);
  }

  if (segment === "services" && slug && isPublicServiceSlug(slug)) {
    return localizedUrl(locale, href);
  }

  return absoluteUrl(href);
}

export function fileServiceJsonLd(locale: LocaleCode, url = localizedUrl(locale, "/file-service")) {
  const copy = getFileServiceCopy(locale);
  const pageId = `${url}#webpage`;
  const serviceId = `${url}#service`;
  const faqId = `${url}#faq`;

  return [
    {
      "@type": "CollectionPage",
      "@id": pageId,
      url,
      inLanguage: hreflangByLocale[locale],
      name: copy.pageTitle,
      headline: copy.title,
      description: copy.description,
      isPartOf: { "@id": absoluteUrl("/#website") },
      about: { "@id": serviceId },
      mainEntity: { "@id": serviceId },
      breadcrumb: { "@id": `${url}#breadcrumbs` },
    },
    {
      "@type": "Service",
      "@id": serviceId,
      name: copy.pageTitle,
      serviceType: "ECU and TCU file service",
      provider: { "@id": absoluteUrl("/#organization") },
      areaServed: ["DE", "AT", "CH", "NL", "BE", "FR", "ES", "IT", "TR"],
      audience: {
        "@type": "Audience",
        audienceType: "Automotive workshops and tuning professionals",
      },
      url,
      description: copy.description,
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "MG AutoTech file service categories",
        itemListElement: copy.serviceCategories.map((item, index) => ({
          "@type": "Offer",
          position: index + 1,
          itemOffered: {
            "@type": "Service",
            name: item.title,
            description: item.text,
            url: fileServiceHrefUrl(locale, item.href),
          },
        })),
      },
    },
    {
      "@type": "FAQPage",
      "@id": faqId,
      mainEntity: copy.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumbs`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "MG AutoTech",
          item: localizedUrl(locale, "/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: copy.nav.fileService,
          item: url,
        },
      ],
    },
    {
      "@type": "ItemList",
      "@id": `${url}#resources`,
      name: copy.resourcesTitle,
      itemListElement: copy.linkedResources.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.title,
        url: fileServiceHrefUrl(locale, item.href),
      })),
    },
  ];
}
