import { absoluteUrl, hreflangByLocale, isPublicServiceSlug, localizedUrl } from "@/lib/seo";
import type { LocaleCode } from "@/lib/i18nConfig";
import { businessAudienceTypeByLocale } from "@/lib/structuredDataI18n";

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
      tag: "Ratgeber",
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
  pageTitle: "ECU und TCU Dateiservice Hub",
  description:
    "MG AutoTech Dateiservice Hub für ECU Tuning Files, TCU Support, Diagnose-Anfragen, sichere Uploads und Werkstatt Workflows.",
  nav: {
    fileService: "Dateiservice",
    services: "Services",
    howItWorks: "Ablauf",
    login: "Login",
    startRequest: "Anfrage starten",
  },
  eyebrow: "Professioneller Dateiservice",
  title: "ECU und TCU Dateiservice für Werkstätten mit sicherem Spezialisten-Workflow.",
  intro:
    "MG AutoTech hilft Werkstätten, Tuning- und Diagnose-Dateianfragen über ein kontrolliertes Portal einzureichen: mit Fahrzeugauswahl, sicherer Dateiübermittlung, Admin-Prüfung und kundensicheren Statusmeldungen.",
  primaryCta: "Sichere Anfrage starten",
  secondaryCta: "Ablauf ansehen",
  metrics: [
    "Sicheres Kundenportal",
    "Fahrzeugdatenbank für die Anfrage",
    "Admin-geprüfter Dateiworkflow",
    "Kundensichere Statusmeldungen",
  ],
  categoriesKicker: "Servicebereiche",
  categoriesTitle: "Dateiservices nach echten Werkstatt-Anfragen geordnet.",
  categoriesText:
    "Der Hub führt Kunden zu den wichtigsten Anfragearten, ohne interne Tuning-Evidenz, private Analysehinweise oder Admin-Metadaten offenzulegen.",
  workflowKicker: "Ablauf",
  workflowTitle: "Ein klarer Portalprozess von Fahrzeugauswahl bis geprüfter Lieferung.",
  workflowText:
    "Kunden übermitteln Fahrzeugdaten und Dateien über das Portal. Admins prüfen den Work Order, den Dateikontext und kommunizieren nur kundensichere Updates.",
  resourcesKicker: "SEO Ressourcen",
  resourcesTitle: "Sinnvolle Einstiegsseiten für Dateiservice-Suchen.",
  resourcesText:
    "Diese Seiten erklären den Ablauf für Kunden und geben Suchmaschinen eine klare Struktur für MG AutoTech Dateiservice-Themen.",
  safetyKicker: "Sicherheitsgrenzen",
  safetyTitle: "Professioneller Support ohne private Interna.",
  safetyText:
    "Die öffentliche Website beschreibt den Serviceprozess. Technische Evidenz, private Quellen, Dateipfade und Admin-Notizen bleiben in geschützten Staff-Tools.",
  faqKicker: "FAQ",
  faqTitle: "Dateiservice-Fragen vor dem Start.",
  finalTitle: "Bereit für eine Dateiservice-Anfrage?",
  finalText:
    "Nutze den sicheren Anfrageprozess, damit MG AutoTech Fahrzeug, Service und Dateikontext vor Arbeitsbeginn prüfen kann.",
  serviceCategories: [
    {
      title: "Stage 1 Dateiservice",
      text: "Strukturierte Anfrage für Performance-Dateien mit Fahrzeugdaten, Serviceauswahl und sicherem Upload.",
      href: "/services/stage-1",
      action: "Stage 1 öffnen",
      tag: "Performance",
    },
    {
      title: "DPF, EGR und AdBlue Support",
      text: "Geführte Serviceauswahl für häufige Werkstatt-Anfragen, immer mit Admin-Prüfung.",
      href: "/services/dpf-off",
      action: "Service öffnen",
      tag: "Werkstatt",
    },
    {
      title: "TCU und Getriebe-Support",
      text: "Anfragepfad für getriebebezogene Dateiarbeit und Drehmoment-Kontext, wo unterstützt.",
      href: "/ecu-platforms/transmission-control-units",
      action: "TCU öffnen",
      tag: "TCU",
    },
  ],
  workflowSteps: [
    {
      title: "Fahrzeug auswählen",
      text: "Marke, Modell, Generation und Motor aus dem Fahrzeugkatalog wählen oder Details manuell ergänzen.",
    },
    {
      title: "Service wählen",
      text: "Gewünschten Dateiservice auswählen und kundensichere Hinweise zum Werkstattziel ergänzen.",
    },
    {
      title: "Sicher hochladen",
      text: "Dateien werden über den geschützten Anfrageprozess eingereicht und im Admin Work Order geprüft.",
    },
    {
      title: "Status verfolgen",
      text: "Kunden sehen Status und kundensichtbare Nachrichten, während interne Prüfungen geschützt bleiben.",
    },
  ],
  linkedResources: [
    {
      title: "MG AutoTech Ablauf",
      text: "Kundenfreundliche Erklärung von Anfrage, Prüfung, Upload und Lieferung.",
      href: "/how-it-works",
      action: "Ablauf lesen",
      tag: "Guide",
    },
    {
      title: "Fahrzeugabdeckung",
      text: "Unterstützte Marken und Fahrzeugpfade für Dateiservice-Anfragen ansehen.",
      href: "/brands",
      action: "Marken ansehen",
      tag: "Katalog",
    },
    {
      title: "ECU Plattformen",
      text: "Häufige ECU Plattformbegriffe im professionellen Dateiservice verstehen.",
      href: "/ecu-platforms",
      action: "Plattformen öffnen",
      tag: "Technik SEO",
    },
    {
      title: "Werkstatt Tools",
      text: "Kundensichere Tools und Referenzen für den Dateiservice-Workflow.",
      href: "/tools",
      action: "Tools öffnen",
      tag: "Ressourcen",
    },
  ],
  safetyBoundaries: [
    "Kundenseiten zeigen keine Admin-Notizen, private Evidenz, Quellen oder interne Review-Daten.",
    "Die öffentliche Website zeigt keine geschützten Uploadpfade, privaten Dateimetadaten oder Staff-Analysen.",
    "AI- und Dataset-Intelligence bleiben admin-geprüfte Support-Systeme, keine automatische Kundendatei-Erzeugung.",
    "Payment- und Anfrage-Status bleiben von öffentlichen SEO-Inhalten getrennt.",
  ],
  faq: [
    {
      question: "Was ist ein ECU oder TCU Dateiservice?",
      answer:
        "Ein Spezialisten-Workflow, bei dem eine Werkstatt Fahrzeugdaten, Serviceauswahl und eine Datei über ein geschütztes Portal einreicht.",
    },
    {
      question: "Kann ich meine Anfrage online verfolgen?",
      answer:
        "Ja. Kunden können im Dashboard den Status verfolgen und kundensichtbare Nachrichten von MG AutoTech sehen.",
    },
    {
      question: "Zeigt die Website private technische Daten?",
      answer:
        "Nein. Öffentliche und Kunden-Seiten verbergen interne Notizen, private Evidenz, Quellen und Staff-Analysen.",
    },
    {
      question: "Wo startet eine Werkstatt?",
      answer:
        "Mit dem sicheren Anfrageformular: Fahrzeug und Service wählen, dann die relevante Datei im Portal einreichen.",
    },
  ],
};

const tr: FileServiceHubCopy = {
  pageTitle: "ECU ve TCU Dosya Servisi Merkezi",
  description:
    "MG AutoTech dosya servisi merkezi: ECU tuning dosyaları, TCU destek talepleri, güvenli yükleme ve profesyonel atölye süreci.",
  nav: {
    fileService: "Dosya servisi",
    services: "Servisler",
    howItWorks: "Nasıl çalışır",
    login: "Giriş",
    startRequest: "Talep başlat",
  },
  eyebrow: "Profesyonel dosya servisi",
  title: "Güvenli uzman süreci isteyen atölyeler için ECU ve TCU dosya servisi.",
  intro:
    "MG AutoTech, atölyelerin tuning ve diagnostik dosya taleplerini kontrollü bir portal üzerinden göndermesine yardım eder: araç seçimi, güvenli yükleme, admin incelemesi ve müşteriye uygun durum güncellemeleri ile.",
  primaryCta: "Güvenli talep başlat",
  secondaryCta: "Süreci incele",
  metrics: [
    "Güvenli müşteri portalı",
    "Araç veritabanı destekli talep",
    "Admin incelemeli dosya süreci",
    "Müşteriye uygun durum güncellemeleri",
  ],
  categoriesKicker: "Servis kategorileri",
  categoriesTitle: "Gerçek atölye taleplerine göre düzenlenmiş dosya servisleri.",
  categoriesText:
    "Bu merkez, müşterileri ana talep türlerine yönlendirir; dahili tuning kanıtları, özel analiz notları ve admin metadataları dışarı açılmaz.",
  workflowKicker: "Süreç",
  workflowTitle: "Araç seçiminden incelenmiş teslimata kadar net portal akışı.",
  workflowText:
    "Müşteriler araç bilgilerini ve dosyayı portal üzerinden gönderir. Adminler iş emrini, dosya bağlamını ve müşteriye uygun mesajları kontrol eder.",
  resourcesKicker: "SEO kaynak haritası",
  resourcesTitle: "Dosya servisi aramaları için güçlü giriş sayfaları.",
  resourcesText:
    "Bu sayfalar müşterilere platformu anlatır ve arama motorlarına MG AutoTech dosya servisi konuları için temiz bir yapı verir.",
  safetyKicker: "Güvenlik sınırları",
  safetyTitle: "Özel detayları açmadan profesyonel destek.",
  safetyText:
    "Herkese açık web sitesi servis sürecini anlatır. Teknik kanıtlar, özel kaynaklar, dosya yolları ve admin notları korumalı personel araçlarında kalır.",
  faqKicker: "SSS",
  faqTitle: "Başlamadan önce sorulan dosya servisi soruları.",
  finalTitle: "Dosya servisi talebi göndermeye hazır mısın?",
  finalText:
    "MG AutoTech'in araç, seçilen servis ve dosya bağlamını iş başlamadan önce inceleyebilmesi için güvenli talep akışını kullan.",
  serviceCategories: [
    {
      title: "Stage 1 dosya servisi",
      text: "Performans dosya talepleri için araç bilgisi, servis seçimi ve güvenli yükleme ile düzenli talep akışı.",
      href: "/services/stage-1",
      action: "Stage 1 aç",
      tag: "Performans",
    },
    {
      title: "DPF, EGR ve AdBlue destek",
      text: "Yaygın atölye destek talepleri için rehberli servis seçimi, her zaman admin incelemesi ile.",
      href: "/services/dpf-off",
      action: "Servis sayfası",
      tag: "Atölye",
    },
    {
      title: "TCU ve şanzıman destek",
      text: "Desteklenen durumlarda şanzıman odaklı dosya çalışması ve tork bağlamı için talep yolu.",
      href: "/ecu-platforms/transmission-control-units",
      action: "TCU sayfası",
      tag: "TCU",
    },
  ],
  workflowSteps: [
    {
      title: "Araç seç",
      text: "Marka, model, nesil ve motoru araç kataloğundan seç veya gerekli durumlarda bilgileri manuel ekle.",
    },
    {
      title: "Servis seç",
      text: "İstenen dosya servisini seç ve atölye hedefini anlatan müşteriye uygun notları ekle.",
    },
    {
      title: "Güvenli yükle",
      text: "Dosyalar korumalı talep akışı üzerinden gönderilir ve admin iş emri sisteminde incelenir.",
    },
    {
      title: "Durumu takip et",
      text: "Müşteriler talep durumunu ve müşteriye açık mesajları görür; dahili kontroller korunur.",
    },
  ],
  linkedResources: [
    {
      title: "MG AutoTech nasıl çalışır",
      text: "Talep, inceleme, yükleme ve teslimat sürecinin müşteriye uygun anlatımı.",
      href: "/how-it-works",
      action: "Süreci oku",
      tag: "Rehber",
    },
    {
      title: "Araç kapsamı",
      text: "Desteklenen markaları ve dosya servisi araç talep yollarını incele.",
      href: "/brands",
      action: "Markaları gör",
      tag: "Katalog",
    },
    {
      title: "ECU platformları",
      text: "Profesyonel dosya servisinde kullanılan yaygın ECU platform terimlerini anla.",
      href: "/ecu-platforms",
      action: "Platformları aç",
      tag: "Teknik SEO",
    },
    {
      title: "Atölye araçları",
      text: "Dosya servisi sürecini destekleyen müşteriye uygun araçlar ve referanslar.",
      href: "/tools",
      action: "Araçları aç",
      tag: "Kaynaklar",
    },
  ],
  safetyBoundaries: [
    "Müşteri sayfaları admin notlarını, özel kanıtları, kaynakları veya dahili inceleme verilerini göstermez.",
    "Herkese açık site korumalı yükleme yollarını, özel dosya metadatalarını veya personel analizlerini açmaz.",
    "AI ve dataset intelligence admin incelemeli destek sistemleridir; otomatik müşteri dosyası üretimi değildir.",
    "Ödeme ve talep durumları herkese açık SEO içeriklerinden ayrıdır.",
  ],
  faq: [
    {
      question: "ECU veya TCU dosya servisi nedir?",
      answer:
        "Atölyenin araç bilgilerini, servis seçimini ve dosyayı korumalı portal üzerinden gönderdiği uzman destek sürecidir.",
    },
    {
      question: "Talebimi online takip edebilir miyim?",
      answer:
        "Evet. Müşteriler dashboard üzerinden talep durumunu ve MG AutoTech tarafından paylaşılan müşteriye açık mesajları görebilir.",
    },
    {
      question: "Website özel teknik verileri gösterir mi?",
      answer:
        "Hayır. Herkese açık ve müşteri sayfaları dahili notları, özel kanıtları, kaynakları ve staff analizlerini gizler.",
    },
    {
      question: "Bir atölye nereden başlamalı?",
      answer:
        "Güvenli talep formu ile başla: araçi ve servisi seç, sonra ilgili dosyayı portal üzerinden gönder.",
    },
  ],
};

const localizedCopy: Record<LocaleCode, FileServiceHubCopy> = {
  en,
  de,
  tr,
  fr: {
    pageTitle: "Hub de service de fichiers ECU et TCU",
    description: "Hub MG AutoTech pour les fichiers de réglage ECU, l'assistance TCU, les demandes de diagnostic, les envois sécurisés et les flux de fichiers des ateliers.",
    nav: { fileService: "Service de fichiers", services: "Services", howItWorks: "Fonctionnement", login: "Connexion", startRequest: "Créer une demande" },
    eyebrow: "Service de fichiers professionnel",
    title: "Service de fichiers ECU et TCU pour les ateliers qui ont besoin d'un flux spécialisé et sécurisé.",
    intro: "MG AutoTech aide les ateliers à envoyer leurs demandes de réglage et de diagnostic dans un portail contrôlé avec sélection du véhicule, transfert sécurisé, contrôle administratif et étapes de livraison adaptées au client.",
    primaryCta: "Créer une demande sécurisée",
    secondaryCta: "Voir le processus",
    metrics: ["Portail client sécurisé", "Saisie assistée par la base de véhicules", "Flux de fichiers contrôlé par un administrateur", "Mises à jour adaptées au client"],
    categoriesKicker: "Catégories de services",
    categoriesTitle: "Des services de fichiers organisés autour des demandes réelles des ateliers.",
    categoriesText: "Le hub guide les clients vers les principaux types de demandes sans révéler les éléments techniques internes, les notes d'analyse privées ni les métadonnées réservées aux administrateurs.",
    workflowKicker: "Processus",
    workflowTitle: "Un parcours clair, de la sélection du véhicule à la livraison contrôlée.",
    workflowText: "Les clients transmettent les données du véhicule et les fichiers par le portail. Les administrateurs contrôlent l'ordre de travail, le contexte du fichier et ne communiquent que des mises à jour adaptées au client.",
    resourcesKicker: "Ressources",
    resourcesTitle: "Des pages d'accès utiles pour les recherches sur le service de fichiers.",
    resourcesText: "Ces pages expliquent la plateforme aux clients tout en offrant aux moteurs de recherche une structure claire autour des sujets de service de fichiers MG AutoTech.",
    safetyKicker: "Limites de sécurité",
    safetyTitle: "Une assistance professionnelle sans exposer les informations privées.",
    safetyText: "Le site public décrit le processus de service. Les éléments techniques, références privées, chemins de fichiers et notes administratives restent dans les outils protégés du personnel.",
    faqKicker: "FAQ",
    faqTitle: "Questions posées avant de commencer un service de fichiers.",
    finalTitle: "Prêt à envoyer une demande de service de fichiers ?",
    finalText: "Utilisez le parcours sécurisé afin que MG AutoTech puisse contrôler le véhicule, le service choisi et le contexte du fichier avant le début du travail.",
    serviceCategories: [
      { title: "Service de fichiers Stage 1", text: "Saisie structurée des demandes de performance avec données du véhicule, service choisi et transfert de fichier sécurisé.", href: "/services/stage-1", action: "Ouvrir Stage 1", tag: "Performance" },
      { title: "Assistance DPF, EGR et AdBlue", text: "Sélection guidée pour les demandes courantes des ateliers, toujours soumise au contrôle d'un administrateur.", href: "/services/dpf-off", action: "Ouvrir la page du service", tag: "Assistance atelier" },
      { title: "Assistance TCU et boîte de vitesses", text: "Un parcours de demande pour le travail sur les fichiers de transmission et le contexte de couple, lorsque cela est pris en charge.", href: "/ecu-platforms/transmission-control-units", action: "Ouvrir la page TCU", tag: "TCU" },
    ],
    workflowSteps: [
      { title: "Sélectionner le véhicule", text: "Choisissez la marque, le modèle, la génération et le moteur dans le catalogue public ou renseignez-les manuellement si nécessaire." },
      { title: "Choisir le service", text: "Sélectionnez le service demandé et ajoutez des notes adaptées au client qui précisent l'objectif de l'atelier." },
      { title: "Transférer en sécurité", text: "Les fichiers sont envoyés dans le parcours protégé puis contrôlés dans le système d'ordres de travail des administrateurs." },
      { title: "Suivre l'avancement", text: "Les clients voient le statut et les messages qui leur sont destinés, tandis que les contrôles internes restent protégés." },
    ],
    linkedResources: [
      { title: "Fonctionnement de MG AutoTech", text: "Une explication claire du processus de demande, de contrôle, d'envoi et de livraison.", href: "/how-it-works", action: "Lire le processus", tag: "Guide" },
      { title: "Couverture des véhicules", text: "Découvrez les marques prises en charge et les parcours de saisie des véhicules.", href: "/brands", action: "Voir les marques", tag: "Catalogue" },
      { title: "Plateformes ECU", text: "Comprenez les termes courants des plateformes ECU utilisés dans le service professionnel de fichiers.", href: "/ecu-platforms", action: "Ouvrir les plateformes", tag: "Référence technique" },
      { title: "Outils pour ateliers", text: "Des outils et références adaptés au client pour accompagner le processus de service de fichiers.", href: "/tools", action: "Ouvrir les outils", tag: "Ressources" },
    ],
    safetyBoundaries: [
      "Les pages client n'affichent jamais les notes administratives, éléments privés, références de source ou données internes de contrôle.",
      "Le site public n'expose ni chemins de transfert protégés, ni métadonnées privées des fichiers, ni détails d'analyse réservés au personnel.",
      "L'intelligence artificielle et les données restent des systèmes d'assistance contrôlés par les administrateurs, et non une génération automatique de fichiers client.",
      "Le paiement et le statut des demandes restent séparés du contenu SEO public.",
    ],
    faq: [
      { question: "Qu'est-ce qu'un service de fichiers ECU ou TCU ?", answer: "C'est un processus spécialisé dans lequel un atelier transmet les données du véhicule, le service choisi et un fichier par un portail protégé afin que MG AutoTech puisse contrôler et traiter la demande." },
      { question: "Puis-je suivre ma demande en ligne ?", answer: "Oui. Les clients peuvent suivre le statut et consulter dans le tableau de bord les messages de MG AutoTech qui leur sont destinés." },
      { question: "Le site public affiche-t-il des données techniques privées ?", answer: "Non. Les pages publiques et client sont conçues pour masquer les notes internes, éléments privés, références de source et détails d'analyse réservés au personnel." },
      { question: "Par où un atelier doit-il commencer ?", answer: "Commencez par le formulaire sécurisé, sélectionnez le véhicule et le service, puis transférez le fichier concerné dans le portail." },
    ],
  },
  es: {
    pageTitle: "Centro de servicio de archivos ECU y TCU",
    description: "Centro MG AutoTech para archivos de ajuste ECU, asistencia TCU, solicitudes de diagnóstico, subidas seguras y flujos de archivos de taller.",
    nav: { fileService: "Servicio de archivos", services: "Servicios", howItWorks: "Cómo funciona", login: "Acceder", startRequest: "Iniciar solicitud" },
    eyebrow: "Servicio profesional de archivos",
    title: "Servicio de archivos ECU y TCU para talleres que necesitan un flujo especializado y seguro.",
    intro: "MG AutoTech ayuda a los talleres a enviar solicitudes de ajuste y diagnóstico mediante un portal controlado con selección del vehículo, subida segura, revisión administrativa y entrega adaptada al cliente.",
    primaryCta: "Iniciar solicitud segura", secondaryCta: "Ver el proceso",
    metrics: ["Portal seguro para clientes", "Entrada asistida por la base de vehículos", "Flujo revisado por administradores", "Actualizaciones adecuadas para clientes"],
    categoriesKicker: "Categorías de servicio", categoriesTitle: "Servicios organizados según solicitudes reales de los talleres.", categoriesText: "El centro dirige a cada cliente al tipo de solicitud adecuado sin mostrar pruebas internas, notas privadas ni metadatos reservados a administradores.",
    workflowKicker: "Proceso", workflowTitle: "Un recorrido claro desde la selección del vehículo hasta la entrega revisada.", workflowText: "El cliente envía los datos y archivos en el portal. Los administradores revisan la orden y el contexto, y solo comunican actualizaciones adecuadas para el cliente.",
    resourcesKicker: "Recursos", resourcesTitle: "Rutas útiles para buscar servicios de archivos.", resourcesText: "Estas páginas explican la plataforma y ofrecen a los buscadores una estructura clara sobre los servicios de archivos de MG AutoTech.",
    safetyKicker: "Límites de seguridad", safetyTitle: "Asistencia profesional sin exponer información privada.", safetyText: "La web pública explica el proceso. Las pruebas técnicas, fuentes privadas, rutas de archivos y notas administrativas permanecen en herramientas protegidas.",
    faqKicker: "Preguntas frecuentes", faqTitle: "Preguntas antes de iniciar un servicio de archivos.", finalTitle: "¿Listo para enviar una solicitud de servicio de archivos?", finalText: "Usa el flujo seguro para que MG AutoTech revise el vehículo, el servicio elegido y el contexto del archivo antes de empezar.",
    serviceCategories: [
      { title: "Servicio de archivos Stage 1", text: "Entrada estructurada para solicitudes de rendimiento con datos del vehículo, servicio elegido y subida segura.", href: "/services/stage-1", action: "Abrir Stage 1", tag: "Rendimiento" },
      { title: "Asistencia DPF, EGR y AdBlue", text: "Selección guiada para solicitudes habituales de taller, siempre sometida a revisión administrativa.", href: "/services/dpf-off", action: "Abrir servicio", tag: "Asistencia de taller" },
      { title: "Asistencia TCU y transmisión", text: "Ruta para trabajos de archivos de transmisión y contexto de par cuando sea compatible.", href: "/ecu-platforms/transmission-control-units", action: "Abrir página TCU", tag: "TCU" },
    ],
    workflowSteps: [
      { title: "Seleccionar vehículo", text: "Elige marca, modelo, generación y motor en el catálogo público o introduce los datos manualmente." },
      { title: "Elegir servicio", text: "Selecciona el servicio y añade notas adecuadas para el cliente que expliquen el objetivo del taller." },
      { title: "Subir de forma segura", text: "Los archivos se envían mediante el flujo protegido y se revisan en el sistema administrativo de órdenes." },
      { title: "Seguir el progreso", text: "El cliente ve el estado y sus mensajes mientras las comprobaciones internas permanecen protegidas." },
    ],
    linkedResources: [
      { title: "Cómo funciona MG AutoTech", text: "Explicación clara del proceso de solicitud, revisión, subida y entrega.", href: "/how-it-works", action: "Leer el proceso", tag: "Guía" },
      { title: "Cobertura de vehículos", text: "Consulta las marcas compatibles y las rutas de entrada de vehículos.", href: "/brands", action: "Ver marcas", tag: "Catálogo" },
      { title: "Plataformas ECU", text: "Conoce los términos habituales de plataformas ECU usados en el servicio profesional.", href: "/ecu-platforms", action: "Abrir plataformas", tag: "Referencia técnica" },
      { title: "Herramientas de taller", text: "Herramientas y referencias adecuadas para clientes que apoyan el proceso.", href: "/tools", action: "Abrir herramientas", tag: "Recursos" },
    ],
    safetyBoundaries: ["Las páginas de clientes nunca muestran notas administrativas, pruebas privadas, fuentes ni datos internos de revisión.", "La web pública no expone rutas protegidas, metadatos privados ni análisis reservados al personal.", "La IA y los datos siguen siendo sistemas de apoyo revisados por administradores, no generación automática de archivos para clientes.", "El pago y el estado de la solicitud permanecen separados del contenido SEO público."],
    faq: [
      { question: "¿Qué es un servicio de archivos ECU o TCU?", answer: "Es un flujo especializado en el que un taller envía los datos del vehículo, el servicio y un archivo mediante un portal protegido para que MG AutoTech revise y procese la solicitud." },
      { question: "¿Puedo seguir mi solicitud en línea?", answer: "Sí. El cliente puede seguir el estado y ver en el panel los mensajes de MG AutoTech destinados a él." },
      { question: "¿La web pública muestra datos técnicos privados?", answer: "No. Las páginas públicas y de clientes ocultan notas internas, pruebas privadas, fuentes y análisis reservados al personal." },
      { question: "¿Por dónde debe empezar un taller?", answer: "Empieza con el formulario seguro, selecciona el vehículo y el servicio y sube el archivo correspondiente en el portal." },
    ],
  },
  it: {
    pageTitle: "Hub servizio file ECU e TCU",
    description: "Hub MG AutoTech per file di tuning ECU, supporto TCU, richieste diagnostiche, caricamenti sicuri e flussi file per officine.",
    nav: { fileService: "Servizio file", services: "Servizi", howItWorks: "Come funziona", login: "Accedi", startRequest: "Avvia richiesta" },
    eyebrow: "Servizio file professionale",
    title: "Servizio file ECU e TCU per officine che richiedono un flusso specialistico e sicuro.",
    intro: "MG AutoTech aiuta le officine a inviare richieste di tuning e diagnostica tramite un portale controllato con selezione veicolo, caricamento sicuro, revisione amministrativa e consegna adatta al cliente.",
    primaryCta: "Avvia richiesta sicura", secondaryCta: "Vedi il processo",
    metrics: ["Portale cliente sicuro", "Inserimento assistito dal database veicoli", "Flusso file revisionato dagli amministratori", "Aggiornamenti adatti al cliente"],
    categoriesKicker: "Categorie di servizio", categoriesTitle: "Servizi file organizzati intorno alle reali richieste delle officine.", categoriesText: "L'hub indirizza i clienti verso le principali richieste senza esporre prove interne, note private o metadati riservati agli amministratori.",
    workflowKicker: "Processo", workflowTitle: "Un percorso chiaro dalla scelta del veicolo alla consegna revisionata.", workflowText: "Il cliente invia dati e file nel portale. Gli amministratori controllano l'ordine e il contesto, comunicando solo aggiornamenti adatti al cliente.",
    resourcesKicker: "Risorse", resourcesTitle: "Percorsi utili per le ricerche sul servizio file.", resourcesText: "Queste pagine spiegano la piattaforma e offrono ai motori di ricerca una struttura chiara sui servizi file MG AutoTech.",
    safetyKicker: "Limiti di sicurezza", safetyTitle: "Supporto professionale senza esporre informazioni private.", safetyText: "Il sito pubblico descrive il processo. Prove tecniche, fonti private, percorsi file e note amministrative restano negli strumenti protetti dello staff.",
    faqKicker: "FAQ", faqTitle: "Domande prima di avviare un servizio file.", finalTitle: "Pronto a inviare una richiesta di servizio file?", finalText: "Usa il percorso sicuro affinché MG AutoTech possa controllare veicolo, servizio e contesto del file prima dell'inizio del lavoro.",
    serviceCategories: [
      { title: "Servizio file Stage 1", text: "Inserimento strutturato per richieste prestazionali con dati veicolo, servizio scelto e caricamento sicuro.", href: "/services/stage-1", action: "Apri Stage 1", tag: "Prestazioni" },
      { title: "Supporto DPF, EGR e AdBlue", text: "Scelta guidata per richieste comuni di officina, sempre sottoposta a revisione amministrativa.", href: "/services/dpf-off", action: "Apri servizio", tag: "Supporto officina" },
      { title: "Supporto TCU e cambio", text: "Percorso per lavori su file trasmissione e contesto di coppia, dove supportato.", href: "/ecu-platforms/transmission-control-units", action: "Apri pagina TCU", tag: "TCU" },
    ],
    workflowSteps: [
      { title: "Seleziona il veicolo", text: "Scegli marca, modello, generazione e motore dal catalogo pubblico o inserisci i dati manualmente." },
      { title: "Scegli il servizio", text: "Seleziona il servizio e aggiungi note adatte al cliente che descrivano l'obiettivo dell'officina." },
      { title: "Carica in sicurezza", text: "I file vengono inviati nel flusso protetto e revisionati nel sistema amministrativo degli ordini." },
      { title: "Segui l'avanzamento", text: "Il cliente vede stato e messaggi dedicati, mentre i controlli interni restano protetti." },
    ],
    linkedResources: [
      { title: "Come funziona MG AutoTech", text: "Spiegazione chiara del processo di richiesta, revisione, caricamento e consegna.", href: "/how-it-works", action: "Leggi il processo", tag: "Guida" },
      { title: "Copertura veicoli", text: "Esplora i marchi supportati e i percorsi di inserimento dei veicoli.", href: "/brands", action: "Vedi marchi", tag: "Catalogo" },
      { title: "Piattaforme ECU", text: "Comprendi i termini comuni delle piattaforme ECU usati nel servizio professionale.", href: "/ecu-platforms", action: "Apri piattaforme", tag: "Riferimento tecnico" },
      { title: "Strumenti per officine", text: "Strumenti e riferimenti adatti ai clienti che supportano il processo.", href: "/tools", action: "Apri strumenti", tag: "Risorse" },
    ],
    safetyBoundaries: ["Le pagine cliente non mostrano note amministrative, prove private, fonti o dati interni di revisione.", "Il sito pubblico non espone percorsi protetti, metadati privati o analisi riservate allo staff.", "IA e dati restano sistemi di supporto revisionati dagli amministratori, non generazione automatica di file cliente.", "Pagamento e stato della richiesta restano separati dai contenuti SEO pubblici."],
    faq: [
      { question: "Cos'è un servizio file ECU o TCU?", answer: "È un flusso specialistico in cui un'officina invia dati del veicolo, servizio e file in un portale protetto perché MG AutoTech possa controllare e lavorare la richiesta." },
      { question: "Posso seguire la richiesta online?", answer: "Sì. Il cliente può seguire lo stato e vedere nella dashboard i messaggi di MG AutoTech a lui destinati." },
      { question: "Il sito pubblico mostra dati tecnici privati?", answer: "No. Le pagine pubbliche e cliente nascondono note interne, prove private, fonti e analisi riservate allo staff." },
      { question: "Da dove deve iniziare un'officina?", answer: "Inizia dal modulo sicuro, seleziona veicolo e servizio, quindi carica il file pertinente nel portale." },
    ],
  },
  nl: {
    pageTitle: "ECU en TCU file service hub",
    description: "MG AutoTech-hub voor ECU-tuningbestanden, TCU-ondersteuning, diagnoseaanvragen, veilige uploads en bestandsworkflows voor werkplaatsen.",
    nav: { fileService: "Bestandsservice", services: "Services", howItWorks: "Zo werkt het", login: "Inloggen", startRequest: "Aanvraag starten" },
    eyebrow: "Professionele file service",
    title: "ECU- en TCU-file service voor werkplaatsen die een veilige specialistische workflow nodig hebben.",
    intro: "MG AutoTech helpt werkplaatsen tuning- en diagnoseaanvragen in te dienen via een beheerd portaal met voertuigselectie, veilige upload, controle door een beheerder en klantveilige levering.",
    primaryCta: "Veilige aanvraag starten", secondaryCta: "Bekijk de workflow",
    metrics: ["Veilig klantportaal", "Invoer met hulp van de voertuigdatabase", "Door beheerder gecontroleerde bestandsworkflow", "Klantveilige statusupdates"],
    categoriesKicker: "Servicecategorieën", categoriesTitle: "File services ingedeeld rond echte werkplaatsaanvragen.", categoriesText: "De hub leidt klanten naar de belangrijkste aanvraagtypen zonder interne onderbouwing, privé-analysenotities of beheerdersmetadata openbaar te maken.",
    workflowKicker: "Proces", workflowTitle: "Een duidelijk portaalproces van voertuigselectie tot gecontroleerde levering.", workflowText: "Klanten sturen voertuiggegevens en bestanden via het portaal. Beheerders controleren de werkorder en bestandscontext en delen alleen klantveilige updates.",
    resourcesKicker: "Bronnen", resourcesTitle: "Handige startpagina's voor zoekopdrachten naar file services.", resourcesText: "Deze pagina's leggen het platform uit en geven zoekmachines een heldere structuur voor MG AutoTech-file-servicethema's.",
    safetyKicker: "Veiligheidsgrenzen", safetyTitle: "Professionele ondersteuning zonder privégegevens bloot te leggen.", safetyText: "De openbare website beschrijft de workflow. Technische onderbouwing, privébronnen, bestandspaden en beheerdersnotities blijven in afgeschermde personeelstools.",
    faqKicker: "Veelgestelde vragen", faqTitle: "Vragen voordat u een file service start.", finalTitle: "Klaar om een file-serviceaanvraag in te dienen?", finalText: "Gebruik de beveiligde aanvraag, zodat MG AutoTech het voertuig, de service en de bestandscontext kan controleren voordat het werk begint.",
    serviceCategories: [
      { title: "Stage 1-file service", text: "Gestructureerde invoer voor prestatieaanvragen met voertuiggegevens, gekozen service en veilige upload.", href: "/services/stage-1", action: "Stage 1 openen", tag: "Prestaties" },
      { title: "DPF-, EGR- en AdBlue-ondersteuning", text: "Begeleide keuze voor veelvoorkomende werkplaatsaanvragen, altijd gecontroleerd door een beheerder.", href: "/services/dpf-off", action: "Open servicepagina", tag: "Werkplaatsondersteuning" },
      { title: "TCU- en versnellingsbakondersteuning", text: "Aanvraagroute voor transmissiebestanden en koppelcontext waar dit wordt ondersteund.", href: "/ecu-platforms/transmission-control-units", action: "Open TCU-pagina", tag: "TCU" },
    ],
    workflowSteps: [
      { title: "Selecteer het voertuig", text: "Kies merk, model, generatie en motor in de openbare catalogus of vul de gegevens handmatig in." },
      { title: "Kies de service", text: "Selecteer de gewenste service en voeg klantveilige notities over het doel van de werkplaats toe." },
      { title: "Upload veilig", text: "Bestanden worden via de beveiligde aanvraag ingediend en in het beheerderssysteem gecontroleerd." },
      { title: "Volg de voortgang", text: "Klanten zien de status en hun berichten, terwijl interne controles afgeschermd blijven." },
    ],
    linkedResources: [
      { title: "Zo werkt MG AutoTech", text: "Een duidelijke uitleg van aanvraag, controle, upload en levering.", href: "/how-it-works", action: "Lees de workflow", tag: "Handleiding" },
      { title: "Voertuigdekking", text: "Bekijk ondersteunde merken en invoerroutes voor voertuigen.", href: "/brands", action: "Bekijk merken", tag: "Catalogus" },
      { title: "ECU-platforms", text: "Leer gangbare ECU-platformtermen kennen die in professionele file service worden gebruikt.", href: "/ecu-platforms", action: "Platforms openen", tag: "Technische informatie" },
      { title: "Werkplaatstools", text: "Klantveilige hulpmiddelen en informatie ter ondersteuning van de workflow.", href: "/tools", action: "Tools openen", tag: "Bronnen" },
    ],
    safetyBoundaries: ["Klantpagina's tonen nooit beheerdersnotities, privé-onderbouwing, bronverwijzingen of interne controlegegevens.", "De openbare site toont geen beveiligde uploadpaden, privébestandsmetadata of personeelsanalyses.", "AI en gegevensintelligentie blijven door beheerders gecontroleerde ondersteuningssystemen en genereren niet automatisch klantbestanden.", "Betaling en aanvraagstatus blijven gescheiden van openbare SEO-inhoud."],
    faq: [
      { question: "Wat is een ECU- of TCU-file service?", answer: "Het is een specialistische workflow waarin een werkplaats voertuiggegevens, de gekozen service en een bestand via een beveiligd portaal indient, waarna MG AutoTech de aanvraag controleert en verwerkt." },
      { question: "Kan ik mijn aanvraag online volgen?", answer: "Ja. Klanten kunnen in het dashboard de status volgen en de voor hen bestemde berichten van MG AutoTech bekijken." },
      { question: "Toont de openbare site technische privégegevens?", answer: "Nee. Openbare en klantpagina's verbergen interne notities, privé-onderbouwing, bronverwijzingen en analyses voor personeel." },
      { question: "Waar begint een werkplaats?", answer: "Begin met het beveiligde formulier, kies voertuig en service en upload daarna het relevante bestand in het portaal." },
    ],
  },
  pl: {
    pageTitle: "Centrum obsługi plików ECU i TCU",
    description: "Centrum MG AutoTech dla plików tuningu ECU, wsparcia TCU, zleceń diagnostycznych, bezpiecznego przesyłania i procesów plikowych warsztatów.",
    nav: { fileService: "Obsługa plików", services: "Usługi", howItWorks: "Jak to działa", login: "Logowanie", startRequest: "Rozpocznij zlecenie" },
    eyebrow: "Profesjonalna obsługa plików", title: "Obsługa plików ECU i TCU dla warsztatów potrzebujących bezpiecznego procesu specjalistycznego.",
    intro: "MG AutoTech pomaga warsztatom przesyłać zlecenia tuningu i diagnostyki przez kontrolowany portal z wyborem pojazdu, bezpiecznym przesyłaniem, weryfikacją administratora i dostarczeniem odpowiednim dla klienta.",
    primaryCta: "Rozpocznij bezpieczne zlecenie", secondaryCta: "Zobacz proces",
    metrics: ["Bezpieczny panel klienta", "Wprowadzanie z pomocą bazy pojazdów", "Proces plikowy weryfikowany przez administratora", "Aktualizacje odpowiednie dla klienta"],
    categoriesKicker: "Kategorie usług", categoriesTitle: "Usługi uporządkowane według rzeczywistych potrzeb warsztatów.", categoriesText: "Centrum kieruje klientów do głównych rodzajów zleceń bez ujawniania wewnętrznych dowodów, prywatnych notatek analitycznych ani metadanych administratora.",
    workflowKicker: "Proces", workflowTitle: "Jasna droga od wyboru pojazdu do zweryfikowanego dostarczenia.", workflowText: "Klienci przesyłają dane i pliki w portalu. Administratorzy weryfikują zlecenie i kontekst pliku oraz przekazują wyłącznie informacje odpowiednie dla klienta.",
    resourcesKicker: "Materiały", resourcesTitle: "Przydatne strony dla wyszukiwań usług plikowych.", resourcesText: "Strony wyjaśniają platformę i tworzą czytelną strukturę tematów MG AutoTech dla wyszukiwarek.",
    safetyKicker: "Granice bezpieczeństwa", safetyTitle: "Profesjonalne wsparcie bez ujawniania prywatnych informacji.", safetyText: "Publiczna strona opisuje proces. Dowody techniczne, prywatne źródła, ścieżki plików i notatki administratora pozostają w chronionych narzędziach personelu.",
    faqKicker: "FAQ", faqTitle: "Pytania przed rozpoczęciem obsługi pliku.", finalTitle: "Chcesz wysłać zlecenie dotyczące pliku?", finalText: "Użyj bezpiecznego formularza, aby MG AutoTech zweryfikowało pojazd, usługę i kontekst pliku przed rozpoczęciem pracy.",
    serviceCategories: [
      { title: "Obsługa plików Stage 1", text: "Uporządkowane zlecenie osiągów z danymi pojazdu, wybraną usługą i bezpiecznym przesyłaniem.", href: "/services/stage-1", action: "Otwórz Stage 1", tag: "Osiągi" },
      { title: "Wsparcie DPF, EGR i AdBlue", text: "Prowadzony wybór dla typowych zleceń warsztatowych, zawsze weryfikowany przez administratora.", href: "/services/dpf-off", action: "Otwórz usługę", tag: "Wsparcie warsztatu" },
      { title: "Wsparcie TCU i skrzyni biegów", text: "Ścieżka zleceń plików przekładni i kontekstu momentu, gdy jest to obsługiwane.", href: "/ecu-platforms/transmission-control-units", action: "Otwórz stronę TCU", tag: "TCU" },
    ],
    workflowSteps: [
      { title: "Wybierz pojazd", text: "Wybierz markę, model, generację i silnik z katalogu lub podaj dane ręcznie." },
      { title: "Wybierz usługę", text: "Wskaż usługę i dodaj bezpieczne dla klienta notatki opisujące cel warsztatu." },
      { title: "Prześlij bezpiecznie", text: "Pliki trafiają przez chroniony formularz do administracyjnego systemu zleceń." },
      { title: "Śledź postęp", text: "Klient widzi status i przeznaczone dla niego wiadomości, a kontrole wewnętrzne pozostają chronione." },
    ],
    linkedResources: [
      { title: "Jak działa MG AutoTech", text: "Czytelne wyjaśnienie zlecenia, weryfikacji, przesyłania i dostarczenia.", href: "/how-it-works", action: "Przeczytaj proces", tag: "Poradnik" },
      { title: "Zakres pojazdów", text: "Poznaj obsługiwane marki i ścieżki wprowadzania pojazdów.", href: "/brands", action: "Zobacz marki", tag: "Katalog" },
      { title: "Platformy ECU", text: "Poznaj typowe terminy platform ECU używane w profesjonalnej obsłudze plików.", href: "/ecu-platforms", action: "Otwórz platformy", tag: "Wiedza techniczna" },
      { title: "Narzędzia warsztatowe", text: "Bezpieczne dla klienta narzędzia i materiały wspierające proces.", href: "/tools", action: "Otwórz narzędzia", tag: "Materiały" },
    ],
    safetyBoundaries: ["Strony klienta nie pokazują notatek administratora, prywatnych dowodów, źródeł ani wewnętrznych danych weryfikacji.", "Publiczna strona nie ujawnia chronionych ścieżek, prywatnych metadanych ani analiz personelu.", "AI i dane pozostają systemami wsparcia kontrolowanymi przez administratora, a nie automatycznym generowaniem plików klienta.", "Płatność i status zlecenia pozostają oddzielone od publicznej treści SEO."],
    faq: [
      { question: "Czym jest obsługa plików ECU lub TCU?", answer: "To specjalistyczny proces, w którym warsztat przesyła dane pojazdu, usługę i plik przez chroniony portal, aby MG AutoTech mogło zweryfikować i zrealizować zlecenie." },
      { question: "Czy mogę śledzić zlecenie online?", answer: "Tak. Klient może śledzić status i widzieć w panelu wiadomości MG AutoTech przeznaczone dla niego." },
      { question: "Czy publiczna strona pokazuje prywatne dane techniczne?", answer: "Nie. Strony publiczne i klienta ukrywają notatki wewnętrzne, prywatne dowody, źródła i analizy personelu." },
      { question: "Od czego powinien zacząć warsztat?", answer: "Zacznij od bezpiecznego formularza, wybierz pojazd i usługę, a potem prześlij właściwy plik w portalu." },
    ],
  },
  pt: {
    pageTitle: "Hub de serviço de ficheiros ECU e TCU",
    description: "Hub MG AutoTech para ficheiros de tuning ECU, apoio TCU, pedidos de diagnóstico, carregamentos seguros e fluxos de ficheiros de oficinas.",
    nav: { fileService: "Serviço de ficheiros", services: "Serviços", howItWorks: "Como funciona", login: "Entrar", startRequest: "Iniciar pedido" },
    eyebrow: "Serviço profissional de ficheiros", title: "Serviço de ficheiros ECU e TCU para oficinas que precisam de um fluxo especializado e seguro.",
    intro: "A MG AutoTech ajuda oficinas a enviar pedidos de tuning e diagnóstico num portal controlado, com seleção do veículo, carregamento seguro, revisão administrativa e entrega adequada ao cliente.",
    primaryCta: "Iniciar pedido seguro", secondaryCta: "Ver o processo",
    metrics: ["Portal seguro para clientes", "Entrada assistida pela base de veículos", "Fluxo revisto por administradores", "Atualizações adequadas ao cliente"],
    categoriesKicker: "Categorias de serviço", categoriesTitle: "Serviços organizados em torno de pedidos reais das oficinas.", categoriesText: "O hub encaminha os clientes para os principais pedidos sem expor elementos técnicos internos, notas privadas ou metadados reservados aos administradores.",
    workflowKicker: "Processo", workflowTitle: "Um percurso claro da seleção do veículo à entrega revista.", workflowText: "Os clientes enviam dados e ficheiros no portal. Os administradores revêm a ordem e o contexto, comunicando apenas atualizações adequadas ao cliente.",
    resourcesKicker: "Recursos", resourcesTitle: "Páginas úteis para pesquisas sobre serviços de ficheiros.", resourcesText: "Estas páginas explicam a plataforma e oferecem aos motores de pesquisa uma estrutura clara sobre os serviços MG AutoTech.",
    safetyKicker: "Limites de segurança", safetyTitle: "Apoio profissional sem expor informação privada.", safetyText: "O site público descreve o processo. Elementos técnicos, fontes privadas, caminhos de ficheiros e notas administrativas ficam nas ferramentas protegidas da equipa.",
    faqKicker: "Perguntas frequentes", faqTitle: "Perguntas antes de iniciar um serviço de ficheiros.", finalTitle: "Pronto para enviar um pedido de serviço de ficheiros?", finalText: "Use o percurso seguro para a MG AutoTech rever o veículo, o serviço e o contexto do ficheiro antes do início do trabalho.",
    serviceCategories: [
      { title: "Serviço de ficheiros Stage 1", text: "Entrada estruturada para pedidos de desempenho com dados do veículo, serviço escolhido e carregamento seguro.", href: "/services/stage-1", action: "Abrir Stage 1", tag: "Desempenho" },
      { title: "Apoio DPF, EGR e AdBlue", text: "Seleção orientada para pedidos comuns de oficinas, sempre sujeita a revisão administrativa.", href: "/services/dpf-off", action: "Abrir serviço", tag: "Apoio à oficina" },
      { title: "Apoio TCU e caixa de velocidades", text: "Percurso para trabalhos em ficheiros de transmissão e contexto de binário, quando suportado.", href: "/ecu-platforms/transmission-control-units", action: "Abrir página TCU", tag: "TCU" },
    ],
    workflowSteps: [
      { title: "Selecionar veículo", text: "Escolha marca, modelo, geração e motor no catálogo ou introduza os dados manualmente." },
      { title: "Escolher serviço", text: "Selecione o serviço e adicione notas adequadas ao cliente que expliquem o objetivo da oficina." },
      { title: "Carregar em segurança", text: "Os ficheiros são enviados pelo fluxo protegido e revistos no sistema administrativo de ordens." },
      { title: "Acompanhar o progresso", text: "O cliente vê o estado e as mensagens que lhe são destinadas, enquanto os controlos internos ficam protegidos." },
    ],
    linkedResources: [
      { title: "Como funciona a MG AutoTech", text: "Explicação clara do pedido, revisão, carregamento e entrega.", href: "/how-it-works", action: "Ler o processo", tag: "Guia" },
      { title: "Cobertura de veículos", text: "Explore as marcas suportadas e os percursos de entrada de veículos.", href: "/brands", action: "Ver marcas", tag: "Catálogo" },
      { title: "Plataformas ECU", text: "Conheça termos comuns de plataformas ECU usados no serviço profissional.", href: "/ecu-platforms", action: "Abrir plataformas", tag: "Referência técnica" },
      { title: "Ferramentas para oficinas", text: "Ferramentas e referências adequadas aos clientes que apoiam o processo.", href: "/tools", action: "Abrir ferramentas", tag: "Recursos" },
    ],
    safetyBoundaries: ["As páginas de clientes não mostram notas administrativas, elementos privados, fontes ou dados internos de revisão.", "O site público não expõe caminhos protegidos, metadados privados nem análises reservadas à equipa.", "A IA e os dados continuam a ser sistemas de apoio revistos por administradores, não geração automática de ficheiros de clientes.", "O pagamento e o estado do pedido ficam separados do conteúdo SEO público."],
    faq: [
      { question: "O que é um serviço de ficheiros ECU ou TCU?", answer: "É um processo especializado em que uma oficina envia dados do veículo, serviço e ficheiro num portal protegido para a MG AutoTech rever e tratar o pedido." },
      { question: "Posso acompanhar o pedido online?", answer: "Sim. O cliente pode seguir o estado e ver no painel as mensagens da MG AutoTech que lhe são destinadas." },
      { question: "O site público mostra dados técnicos privados?", answer: "Não. As páginas públicas e de cliente ocultam notas internas, elementos privados, fontes e análises reservadas à equipa." },
      { question: "Por onde deve começar uma oficina?", answer: "Comece pelo formulário seguro, selecione o veículo e o serviço e carregue o ficheiro relevante no portal." },
    ],
  },
  ru: {
    pageTitle: "Центр файлового сервиса ECU и TCU",
    description: "Центр MG AutoTech для файлов тюнинга ECU, поддержки TCU, диагностических заявок, безопасной загрузки и рабочих процессов мастерских.",
    nav: { fileService: "Файловый сервис", services: "Услуги", howItWorks: "Как это работает", login: "Вход", startRequest: "Создать заявку" },
    eyebrow: "Профессиональный файловый сервис", title: "Файловый сервис ECU и TCU для мастерских, которым нужен безопасный процесс со специалистами.",
    intro: "MG AutoTech помогает мастерским отправлять заявки на тюнинг и диагностику через контролируемый портал с выбором автомобиля, безопасной загрузкой, проверкой администратора и выдачей результата клиенту.",
    primaryCta: "Создать безопасную заявку", secondaryCta: "Посмотреть процесс",
    metrics: ["Безопасный личный кабинет", "Ввод с помощью базы автомобилей", "Проверка файлов администратором", "Обновления, предназначенные для клиента"],
    categoriesKicker: "Категории услуг", categoriesTitle: "Услуги, организованные вокруг реальных заявок мастерских.", categoriesText: "Центр направляет клиентов к основным типам заявок, не раскрывая внутренние технические данные, закрытые заметки и метаданные администратора.",
    workflowKicker: "Процесс", workflowTitle: "Понятный путь от выбора автомобиля до проверенной выдачи результата.", workflowText: "Клиенты отправляют данные и файлы через портал. Администраторы проверяют заказ и контекст файла и сообщают только предназначенную клиенту информацию.",
    resourcesKicker: "Материалы", resourcesTitle: "Полезные страницы для поиска файловых услуг.", resourcesText: "Эти страницы объясняют платформу клиентам и создают понятную структуру тем MG AutoTech для поисковых систем.",
    safetyKicker: "Границы безопасности", safetyTitle: "Профессиональная поддержка без раскрытия закрытой информации.", safetyText: "Публичный сайт описывает процесс. Технические материалы, закрытые источники, пути файлов и заметки администратора остаются в защищенных инструментах персонала.",
    faqKicker: "Вопросы и ответы", faqTitle: "Вопросы перед началом работы с файлом.", finalTitle: "Готовы отправить заявку на файловую услугу?", finalText: "Используйте защищенную форму, чтобы MG AutoTech проверила автомобиль, услугу и контекст файла до начала работы.",
    serviceCategories: [
      { title: "Файловый сервис Stage 1", text: "Структурированная заявка на производительность с данными автомобиля, выбранной услугой и безопасной загрузкой.", href: "/services/stage-1", action: "Открыть Stage 1", tag: "Производительность" },
      { title: "Поддержка DPF, EGR и AdBlue", text: "Пошаговый выбор для частых заявок мастерских с обязательной проверкой администратора.", href: "/services/dpf-off", action: "Открыть услугу", tag: "Поддержка мастерской" },
      { title: "Поддержка TCU и трансмиссии", text: "Путь для заявок по файлам трансмиссии и контексту крутящего момента, если это поддерживается.", href: "/ecu-platforms/transmission-control-units", action: "Открыть страницу TCU", tag: "TCU" },
    ],
    workflowSteps: [
      { title: "Выберите автомобиль", text: "Выберите марку, модель, поколение и двигатель в каталоге или введите данные вручную." },
      { title: "Выберите услугу", text: "Укажите услугу и добавьте предназначенные для клиента заметки о цели мастерской." },
      { title: "Загрузите безопасно", text: "Файлы отправляются через защищенную форму и проверяются в административной системе заказов." },
      { title: "Следите за ходом работы", text: "Клиент видит статус и свои сообщения, а внутренние проверки остаются закрытыми." },
    ],
    linkedResources: [
      { title: "Как работает MG AutoTech", text: "Понятное описание заявки, проверки, загрузки и выдачи результата.", href: "/how-it-works", action: "Прочитать процесс", tag: "Руководство" },
      { title: "Охват автомобилей", text: "Посмотрите поддерживаемые марки и способы ввода данных автомобиля.", href: "/brands", action: "Посмотреть марки", tag: "Каталог" },
      { title: "Платформы ECU", text: "Изучите распространенные термины платформ ECU, используемые в профессиональном сервисе.", href: "/ecu-platforms", action: "Открыть платформы", tag: "Техническая справка" },
      { title: "Инструменты мастерской", text: "Безопасные для клиента инструменты и материалы, поддерживающие процесс.", href: "/tools", action: "Открыть инструменты", tag: "Материалы" },
    ],
    safetyBoundaries: ["Клиентские страницы не показывают заметки администратора, закрытые материалы, источники и внутренние данные проверки.", "Публичный сайт не раскрывает защищенные пути, закрытые метаданные и анализы персонала.", "ИИ и данные остаются проверяемыми администратором средствами поддержки, а не автоматической генерацией клиентских файлов.", "Оплата и статус заявки отделены от публичного SEO-контента."],
    faq: [
      { question: "Что такое файловый сервис ECU или TCU?", answer: "Это специализированный процесс, в котором мастерская отправляет данные автомобиля, услугу и файл через защищенный портал, чтобы MG AutoTech проверила и обработала заявку." },
      { question: "Можно ли отслеживать заявку онлайн?", answer: "Да. Клиент может следить за статусом и видеть в личном кабинете предназначенные для него сообщения MG AutoTech." },
      { question: "Показывает ли сайт закрытые технические данные?", answer: "Нет. Публичные и клиентские страницы скрывают внутренние заметки, закрытые материалы, источники и анализы персонала." },
      { question: "С чего начать мастерской?", answer: "Откройте защищенную форму, выберите автомобиль и услугу, затем загрузите нужный файл в портал." },
    ],
  },
  zh: {
    pageTitle: "ECU 与 TCU 文件服务中心",
    description: "MG AutoTech 文件服务中心提供 ECU 调校文件、TCU 支持、诊断请求、安全上传和维修厂文件工作流程。",
    nav: { fileService: "文件服务", services: "服务", howItWorks: "工作流程", login: "登录", startRequest: "开始请求" },
    eyebrow: "专业文件服务", title: "为需要安全专业流程的维修厂提供 ECU 与 TCU 文件服务。",
    intro: "MG AutoTech 帮助维修厂通过受控门户提交调校和诊断请求，包括车辆选择、安全上传、管理员审核和适合客户的交付步骤。",
    primaryCta: "开始安全请求", secondaryCta: "查看工作流程",
    metrics: ["安全客户门户", "车辆数据库辅助填写", "管理员审核文件流程", "适合客户查看的状态更新"],
    categoriesKicker: "服务类别", categoriesTitle: "围绕维修厂实际请求组织的文件服务。", categoriesText: "服务中心引导客户选择主要请求类型，同时不公开内部技术依据、私密分析备注或仅限管理员查看的元数据。",
    workflowKicker: "工作流程", workflowTitle: "从车辆选择到审核后交付的清晰门户流程。", workflowText: "客户通过门户提交车辆信息和文件。管理员审核工单与文件背景，只向客户传达适合其查看的更新。",
    resourcesKicker: "相关资源", resourcesTitle: "便于查找文件服务的实用页面。", resourcesText: "这些页面帮助客户了解平台，也为搜索引擎提供清晰的 MG AutoTech 文件服务内容结构。",
    safetyKicker: "安全边界", safetyTitle: "提供专业支持，同时保护私密内部信息。", safetyText: "公开网站仅说明服务流程。技术依据、私密来源、文件路径和管理员备注始终保留在受保护的员工工具中。",
    faqKicker: "常见问题", faqTitle: "开始文件服务前的常见问题。", finalTitle: "准备提交文件服务请求了吗？", finalText: "请使用安全请求流程，以便 MG AutoTech 在开始工作前审核车辆、所选服务和文件背景。",
    serviceCategories: [
      { title: "Stage 1 文件服务", text: "通过车辆信息、所选服务和安全上传，规范接收性能文件请求。", href: "/services/stage-1", action: "打开 Stage 1", tag: "性能" },
      { title: "DPF、EGR 与 AdBlue 支持", text: "针对维修厂常见支持请求提供引导式选择，并始终经过管理员审核。", href: "/services/dpf-off", action: "打开服务页面", tag: "维修厂支持" },
      { title: "TCU 与变速箱支持", text: "在支持的情况下，用于变速箱文件工作和扭矩背景的请求路径。", href: "/ecu-platforms/transmission-control-units", action: "打开 TCU 页面", tag: "TCU" },
    ],
    workflowSteps: [
      { title: "选择车辆", text: "从公开车辆目录选择品牌、车型、代系和发动机，必要时也可手动填写。" },
      { title: "选择服务", text: "选择所需文件服务，并添加适合客户查看的维修厂目标说明。" },
      { title: "安全上传", text: "文件通过受保护的请求流程提交，并在管理员工单系统中审核。" },
      { title: "跟踪进度", text: "客户可以查看请求状态和客户消息，内部审核仍保持受保护。" },
    ],
    linkedResources: [
      { title: "MG AutoTech 工作流程", text: "以客户易懂的方式说明请求、审核、上传和交付流程。", href: "/how-it-works", action: "阅读流程", tag: "指南" },
      { title: "车辆覆盖范围", text: "查看支持的品牌和文件服务车辆填写路径。", href: "/brands", action: "查看品牌", tag: "目录" },
      { title: "ECU 平台", text: "了解专业文件服务中常见的 ECU 平台术语。", href: "/ecu-platforms", action: "打开平台", tag: "技术参考" },
      { title: "维修厂工具", text: "支持文件服务流程、适合客户使用的工具与参考资料。", href: "/tools", action: "打开工具", tag: "资源" },
    ],
    safetyBoundaries: ["客户页面不会显示管理员备注、私密依据、来源引用或内部审核数据。", "公开网站不会暴露受保护的上传路径、私密文件元数据或仅限员工查看的分析详情。", "AI 与数据智能仍是由管理员审核的支持系统，不会自动生成客户文件。", "付款和请求状态与公开 SEO 内容保持分离。"],
    faq: [
      { question: "什么是 ECU 或 TCU 文件服务？", answer: "维修厂通过受保护门户提交车辆信息、所选服务和文件，由 MG AutoTech 审核并处理请求。" },
      { question: "我可以在线跟踪请求吗？", answer: "可以。客户可在面板中跟踪状态并查看 MG AutoTech 向客户发布的消息。" },
      { question: "公开网站会显示私密技术数据吗？", answer: "不会。公开页面和客户页面会隐藏内部备注、私密依据、来源引用和仅限员工查看的分析。" },
      { question: "维修厂应从哪里开始？", answer: "从安全请求表单开始，选择车辆和服务，然后通过门户上传相关文件。" },
    ],
  },
  sq: {
    pageTitle: "Qendra e shërbimit të skedarëve ECU dhe TCU",
    description: "Qendra MG AutoTech për skedarë tuningu ECU, mbështetje TCU, kërkesa diagnostike, ngarkime të sigurta dhe procese skedarësh për servise.",
    nav: { fileService: "Shërbimi i skedarëve", services: "Shërbime", howItWorks: "Si funksionon", login: "Hyrje", startRequest: "Nis kërkesë" },
    eyebrow: "Shërbim profesional skedarësh", title: "Shërbim skedarësh ECU dhe TCU për servise që kanë nevojë për një proces të sigurt specialistësh.",
    intro: "MG AutoTech ndihmon serviset të dërgojnë kërkesa tuningu dhe diagnostike në një portal të kontrolluar, me përzgjedhje automjeti, ngarkim të sigurt, shqyrtim administrativ dhe dorëzim të përshtatshëm për klientin.",
    primaryCta: "Nis kërkesë të sigurt", secondaryCta: "Shiko procesin",
    metrics: ["Portal i sigurt për klientin", "Plotësim me ndihmën e bazës së automjeteve", "Proces skedarësh i shqyrtuar nga administratori", "Përditësime të përshtatshme për klientin"],
    categoriesKicker: "Kategoritë e shërbimit", categoriesTitle: "Shërbime të organizuara rreth kërkesave reale të serviseve.", categoriesText: "Qendra i drejton klientët te llojet kryesore të kërkesave pa ekspozuar prova të brendshme, shënime private analize ose metadata të administratorit.",
    workflowKicker: "Procesi", workflowTitle: "Një rrjedhë e qartë nga zgjedhja e automjetit te dorëzimi i shqyrtuar.", workflowText: "Klientët dërgojnë të dhënat dhe skedarët në portal. Administratorët shqyrtojnë urdhrin dhe kontekstin, duke komunikuar vetëm përditësime të përshtatshme për klientin.",
    resourcesKicker: "Burime", resourcesTitle: "Faqe të dobishme për kërkimin e shërbimeve të skedarëve.", resourcesText: "Këto faqe shpjegojnë platformën dhe u japin motorëve të kërkimit një strukturë të qartë për shërbimet MG AutoTech.",
    safetyKicker: "Kufijtë e sigurisë", safetyTitle: "Mbështetje profesionale pa ekspozuar informacion privat.", safetyText: "Faqja publike përshkruan procesin. Provat teknike, burimet private, shtigjet e skedarëve dhe shënimet e administratorit qëndrojnë në mjetet e mbrojtura të stafit.",
    faqKicker: "Pyetje të shpeshta", faqTitle: "Pyetje para nisjes së një shërbimi skedarësh.", finalTitle: "Gati për të dërguar një kërkesë për shërbim skedarësh?", finalText: "Përdorni procesin e sigurt që MG AutoTech të shqyrtojë automjetin, shërbimin dhe kontekstin e skedarit para fillimit të punës.",
    serviceCategories: [
      { title: "Shërbim skedarësh Stage 1", text: "Kërkesë e strukturuar performance me të dhënat e automjetit, shërbimin e zgjedhur dhe ngarkim të sigurt.", href: "/services/stage-1", action: "Hap Stage 1", tag: "Performancë" },
      { title: "Mbështetje DPF, EGR dhe AdBlue", text: "Përzgjedhje e udhëzuar për kërkesa të zakonshme servisi, gjithmonë e shqyrtuar nga administratori.", href: "/services/dpf-off", action: "Hap shërbimin", tag: "Mbështetje servisi" },
      { title: "Mbështetje TCU dhe transmisioni", text: "Rrugë kërkese për skedarë transmisioni dhe kontekst çift-rrotullues, kur mbështetet.", href: "/ecu-platforms/transmission-control-units", action: "Hap faqen TCU", tag: "TCU" },
    ],
    workflowSteps: [
      { title: "Zgjidhni automjetin", text: "Zgjidhni markën, modelin, gjeneratën dhe motorin nga katalogu ose plotësoni të dhënat manualisht." },
      { title: "Zgjidhni shërbimin", text: "Zgjidhni shërbimin dhe shtoni shënime të përshtatshme për klientin që shpjegojnë objektivin e servisit." },
      { title: "Ngarkoni në mënyrë të sigurt", text: "Skedarët dërgohen përmes procesit të mbrojtur dhe shqyrtohen në sistemin administrativ të urdhrave." },
      { title: "Ndiqni ecurinë", text: "Klienti sheh statusin dhe mesazhet e tij, ndërsa kontrollet e brendshme mbeten të mbrojtura." },
    ],
    linkedResources: [
      { title: "Si funksionon MG AutoTech", text: "Shpjegim i qartë i kërkesës, shqyrtimit, ngarkimit dhe dorëzimit.", href: "/how-it-works", action: "Lexo procesin", tag: "Udhëzues" },
      { title: "Mbulimi i automjeteve", text: "Shikoni markat e mbështetura dhe rrugët e plotësimit të automjeteve.", href: "/brands", action: "Shiko markat", tag: "Katalog" },
      { title: "Platformat ECU", text: "Kuptoni termat e zakonshëm të platformave ECU në shërbimin profesional.", href: "/ecu-platforms", action: "Hap platformat", tag: "Referencë teknike" },
      { title: "Mjete për servise", text: "Mjete dhe referenca të përshtatshme për klientin që mbështesin procesin.", href: "/tools", action: "Hap mjetet", tag: "Burime" },
    ],
    safetyBoundaries: ["Faqet e klientit nuk shfaqin shënime administratori, prova private, burime ose të dhëna të brendshme shqyrtimi.", "Faqja publike nuk ekspozon shtigje të mbrojtura, metadata private ose analiza të stafit.", "AI dhe inteligjenca e të dhënave mbeten sisteme mbështetëse të shqyrtuara nga administratori, jo gjenerim automatik skedarësh për klientin.", "Pagesa dhe statusi i kërkesës mbeten të ndara nga përmbajtja publike SEO."],
    faq: [
      { question: "Çfarë është shërbimi i skedarëve ECU ose TCU?", answer: "Është një proces specialistësh ku servisi dërgon të dhënat e automjetit, shërbimin dhe skedarin në një portal të mbrojtur që MG AutoTech ta shqyrtojë dhe përpunojë kërkesën." },
      { question: "A mund ta ndjek kërkesën online?", answer: "Po. Klienti mund të ndjekë statusin dhe të shohë në panel mesazhet e MG AutoTech të destinuara për të." },
      { question: "A shfaq faqja publike të dhëna teknike private?", answer: "Jo. Faqet publike dhe të klientit fshehin shënimet e brendshme, provat private, burimet dhe analizat e stafit." },
      { question: "Ku duhet të fillojë një servis?", answer: "Filloni me formularin e sigurt, zgjidhni automjetin dhe shërbimin, pastaj ngarkoni skedarin përkatës në portal." },
    ],
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
      serviceType: copy.nav.fileService,
      provider: { "@id": absoluteUrl("/#organization") },
      areaServed: ["DE", "AT", "CH", "NL", "BE", "FR", "ES", "IT", "TR"],
      audience: {
        "@type": "Audience",
        audienceType: businessAudienceTypeByLocale[locale],
      },
      url,
      description: copy.description,
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: copy.categoriesTitle,
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
