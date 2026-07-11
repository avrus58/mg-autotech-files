import type { LocaleCode } from "@/lib/i18n";
import { hreflangByLocale } from "@/lib/seo";

export type HowItWorksItem = {
  title: string;
  text: string;
};

export type HowItWorksFaq = {
  q: string;
  a: string;
};

export type HowItWorksCopy = {
  title: string;
  pageTitle: string;
  description: string;
  navLabel: string;
  eyebrow: string;
  hero: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  processKicker: string;
  processTitle: string;
  processText: string;
  dashboardKicker: string;
  dashboardTitle: string;
  securityKicker: string;
  securityTitle: string;
  securityText: string;
  audienceKicker: string;
  audienceTitle: string;
  faqKicker: string;
  faqTitle: string;
  finalTitle: string;
  finalText: string;
  processSteps: HowItWorksItem[];
  dashboardBenefits: HowItWorksItem[];
  securityItems: string[];
  audiences: string[];
  faq: HowItWorksFaq[];
  nav: {
    home: string;
    services: string;
    howItWorks: string;
    login: string;
    startRequest: string;
  };
};

const en: HowItWorksCopy = {
  title: "How It Works",
  pageTitle: "How It Works | MG AutoTech",
  description:
    "Learn how MG AutoTech customers submit ECU/TCU file requests, upload files securely, track status, and receive completed work through the dashboard.",
  navLabel: "How It Works",
  eyebrow: "Professional customer workflow",
  hero: "How MG AutoTech File Service Works",
  intro:
    "Submit ECU/TCU file requests securely, track every step in your dashboard, and receive updates through a professional workflow built for tuners, workshops, and automotive businesses.",
  primaryCta: "Start a New Request",
  secondaryCta: "Open Dashboard",
  processKicker: "Process",
  processTitle: "From account creation to secure delivery.",
  processText:
    "The platform keeps customer, vehicle, service, file and message context connected so each request can be handled cleanly.",
  dashboardKicker: "Dashboard benefits",
  dashboardTitle: "Everything important stays connected to the request.",
  securityKicker: "Security and privacy",
  securityTitle: "Built around private customer workflows.",
  securityText:
    "Customer uploads are handled through private flows. Customers can access only their own requests, and internal admin notes or processing details are not exposed in customer views.",
  audienceKicker: "Who it is for",
  audienceTitle: "A practical platform for repeat file-service work.",
  faqKicker: "FAQ",
  faqTitle: "Common questions",
  finalTitle: "Ready to submit a file request?",
  finalText:
    "Start with your vehicle, service and file details, then track everything in your dashboard.",
  processSteps: [
    {
      title: "Create your account",
      text: "Create an MG AutoTech account to access the dashboard, manage requests, view credits, and track submitted files.",
    },
    {
      title: "Select your vehicle",
      text: "Choose brand, model, generation and engine from the vehicle selector. If a vehicle is not listed, provide manual vehicle details.",
    },
    {
      title: "Choose the service",
      text: "Select the required file service, such as Stage 1, TCU, VMAX, DTC request, Start/Stop or another available service.",
    },
    {
      title: "Upload your ECU/TCU file",
      text: "Upload supported file formats through the secure upload flow. Files are connected to your request and are not publicly accessible.",
    },
    {
      title: "Review and processing",
      text: "MG AutoTech reviews the file information, vehicle data, selected service, payment or credits, and customer notes.",
    },
    {
      title: "Track status",
      text: "Track request status, customer-visible messages, upload permissions, and completion progress from the dashboard.",
    },
    {
      title: "Receive the result",
      text: "When the work is completed, the result is provided through the secure customer dashboard or the configured delivery workflow.",
    },
  ],
  dashboardBenefits: [
    { title: "Secure file handling", text: "Customer uploads are attached to the correct request and kept out of public download flows." },
    { title: "Request status tracking", text: "Follow each request from submission through review, processing and completion." },
    { title: "Customer-visible messages", text: "Important updates and questions stay connected to the correct order." },
    { title: "Credit and payment overview", text: "View available credits and payment state before continuing with requests." },
    { title: "Vehicle and service details", text: "Keep selected vehicle data, service type and customer notes structured in one place." },
    { title: "Additional upload requests", text: "If another file is needed, MG AutoTech can enable a controlled additional upload." },
  ],
  securityItems: [
    "Files are handled through private customer flows.",
    "Public download links are not used for customer uploads.",
    "Customers can only access their own requests.",
    "Internal admin notes and processing details are not exposed to customers.",
    "The desktop app, when available, requires online verification and customer login.",
  ],
  audiences: [
    "Automotive workshops",
    "Professional tuners",
    "Automotive businesses",
    "Repeat file-service customers",
    "Customers who need structured ECU/TCU request handling",
  ],
  faq: [
    { q: "Do I need an account?", a: "Yes. An account is required to submit requests, upload files, view status and receive results." },
    { q: "Can I still use the website without the Windows app?", a: "Yes. The browser dashboard remains available. The Windows File Upload Assistant is an additional option for selected beta users." },
    { q: "Which file types are supported?", a: "Common ECU/TCU file formats such as .bin, .ori, .mod, .hex, .frf, .sgo and .zip are supported depending on the request type." },
    { q: "Are uploaded files public?", a: "No. Customer files are handled through private request flows and are not exposed as public downloads." },
    { q: "What happens if more information is needed?", a: "MG AutoTech can contact the customer through the dashboard and request additional information or another upload." },
    { q: "Does the system automatically modify files?", a: "No. Customer requests go through MG AutoTech's processing and review workflow. The platform is designed to structure and manage file-service requests professionally." },
  ],
  nav: {
    home: "Home",
    services: "Services",
    howItWorks: "How it works",
    login: "Login",
    startRequest: "Start request",
  },
};

export const howItWorksCopy: Record<LocaleCode, HowItWorksCopy> = {
  en,
  de: {
    ...en,
    title: "So funktioniert es",
    pageTitle: "So funktioniert es | MG AutoTech",
    description:
      "Erfahren Sie, wie Kunden bei MG AutoTech ECU-/TCU-Dateianfragen erstellen, Dateien sicher hochladen, den Status verfolgen und Ergebnisse im Dashboard erhalten.",
    navLabel: "So funktioniert es",
    eyebrow: "Professioneller Kundenablauf",
    hero: "So funktioniert der MG AutoTech File-Service",
    intro:
      "Senden Sie ECU-/TCU-Dateianfragen sicher, verfolgen Sie jeden Schritt im Dashboard und erhalten Sie Updates über einen professionellen Ablauf für Tuner, Werkstätten und Automotive-Unternehmen.",
    primaryCta: "Neue Anfrage starten",
    secondaryCta: "Dashboard öffnen",
    processKicker: "Ablauf",
    processTitle: "Vom Kundenkonto bis zur sicheren Lieferung.",
    processText:
      "Die Plattform verbindet Kunde, Fahrzeug, Service, Datei und Nachrichtenkontext, damit jede Anfrage sauber bearbeitet werden kann.",
    dashboardKicker: "Dashboard-Vorteile",
    dashboardTitle: "Alles Wichtige bleibt mit der Anfrage verbunden.",
    securityKicker: "Sicherheit und Datenschutz",
    securityTitle: "Auf private Kundenabläufe ausgelegt.",
    securityText:
      "Kunden-Uploads laufen über private Prozesse. Kunden sehen nur eigene Anfragen; interne Admin-Notizen oder Bearbeitungsdetails werden nicht in Kundenansichten angezeigt.",
    audienceKicker: "Für wen",
    audienceTitle: "Eine praktische Plattform für wiederkehrende Dateiservice-Arbeit.",
    faqKicker: "FAQ",
    faqTitle: "Häufige Fragen",
    finalTitle: "Bereit für eine Dateianfrage?",
    finalText:
      "Starten Sie mit Fahrzeug, Service und Dateidaten und verfolgen Sie alles im Dashboard.",
    processSteps: [
      { title: "Konto erstellen", text: "Erstellen Sie ein MG AutoTech Konto, um das Dashboard zu nutzen, Anfragen zu verwalten, Credits zu sehen und Dateien zu verfolgen." },
      { title: "Fahrzeug auswählen", text: "Wählen Sie Marke, Modell, Generation und Motor aus dem Fahrzeugselector. Fehlt ein Fahrzeug, können Sie Details manuell angeben." },
      { title: "Service wählen", text: "Wählen Sie den benötigten Dateiservice, etwa Stage 1, TCU, VMAX, DTC-Anfrage, Start/Stop oder einen anderen verfügbaren Service." },
      { title: "ECU-/TCU-Datei hochladen", text: "Laden Sie unterstützte Dateiformate über den sicheren Upload hoch. Dateien bleiben mit Ihrer Anfrage verbunden und sind nicht öffentlich zugänglich." },
      { title: "Prüfung und Bearbeitung", text: "MG AutoTech prüft Dateiinformationen, Fahrzeugdaten, gewählten Service, Zahlung oder Credits und Kundennotizen." },
      { title: "Status verfolgen", text: "Verfolgen Sie Status, kundensichtbare Nachrichten, Upload-Freigaben und Fortschritt im Dashboard." },
      { title: "Ergebnis erhalten", text: "Nach Abschluss wird das Ergebnis über das sichere Kundendashboard oder den vorgesehenen Lieferprozess bereitgestellt." },
    ],
    dashboardBenefits: [
      { title: "Sichere Dateiverarbeitung", text: "Uploads werden der richtigen Anfrage zugeordnet und nicht über öffentliche Downloads bereitgestellt." },
      { title: "Statusverfolgung", text: "Verfolgen Sie jede Anfrage von der Einreichung über Prüfung und Bearbeitung bis zum Abschluss." },
      { title: "Kundensichtbare Nachrichten", text: "Wichtige Updates und Rückfragen bleiben mit dem passenden Auftrag verbunden." },
      { title: "Credits und Zahlung", text: "Prüfen Sie Credits und Zahlungsstatus, bevor Sie mit einer Anfrage fortfahren." },
      { title: "Fahrzeug und Service", text: "Fahrzeugdaten, Serviceart und Kundennotizen bleiben strukturiert an einem Ort." },
      { title: "Zusätzliche Uploads", text: "Wenn eine weitere Datei benötigt wird, kann MG AutoTech einen kontrollierten Zusatz-Upload freigeben." },
    ],
    securityItems: [
      "Dateien werden über private Kundenabläufe verarbeitet.",
      "Für Kunden-Uploads werden keine öffentlichen Downloadlinks genutzt.",
      "Kunden können nur auf eigene Anfragen zugreifen.",
      "Interne Admin-Notizen und Bearbeitungsdetails sind für Kunden nicht sichtbar.",
      "Die Windows-App benötigt, sobald verfügbar, Online-Verifizierung und Kundenlogin.",
    ],
    audiences: ["Werkstätten", "Professionelle Tuner", "Automotive-Unternehmen", "Wiederkehrende Dateiservice-Kunden", "Kunden mit strukturiertem ECU-/TCU-Anfragebedarf"],
    faq: [
      { q: "Benötige ich ein Konto?", a: "Ja. Ein Konto ist erforderlich, um Anfragen zu erstellen, Dateien hochzuladen, den Status zu sehen und Ergebnisse zu erhalten." },
      { q: "Kann ich die Website ohne Windows-App nutzen?", a: "Ja. Das Browser-Dashboard bleibt verfügbar. Die Windows File Upload Assistant App ist eine zusätzliche Option für ausgewählte Beta-Nutzer." },
      { q: "Welche Dateitypen werden unterstützt?", a: "Gängige ECU-/TCU-Formate wie .bin, .ori, .mod, .hex, .frf, .sgo und .zip werden je nach Anfrage unterstützt." },
      { q: "Sind hochgeladene Dateien öffentlich?", a: "Nein. Kundendateien laufen über private Anfrageprozesse und werden nicht als öffentliche Downloads bereitgestellt." },
      { q: "Was passiert, wenn weitere Informationen benötigt werden?", a: "MG AutoTech kann den Kunden über das Dashboard kontaktieren und zusätzliche Informationen oder einen weiteren Upload anfordern." },
      { q: "Ändert das System Dateien automatisch?", a: "Nein. Kundenanfragen laufen über den Bearbeitungs- und Prüfprozess von MG AutoTech. Die Plattform strukturiert und verwaltet Dateiservice-Anfragen professionell." },
    ],
    nav: { home: "Startseite", services: "Services", howItWorks: "So funktioniert es", login: "Login", startRequest: "Anfrage starten" },
  },
  tr: {
    ...en,
    title: "Nasıl Çalışır",
    pageTitle: "Nasıl Çalışır | MG AutoTech",
    description:
      "MG AutoTech müşterilerinin ECU/TCU dosya taleplerini nasıl oluşturduğunu, dosyaları güvenli şekilde nasıl yüklediğini, durumu nasıl takip ettiğini ve sonuçları panelden nasıl aldığını öğrenin.",
    navLabel: "Nasıl Çalışır",
    eyebrow: "Profesyonel müşteri iş akışı",
    hero: "MG AutoTech File Service Nasıl Çalışır",
    intro:
      "ECU/TCU dosya taleplerini güvenli şekilde gönderin, her adımı panelinizden takip edin ve tunerler, servisler ve otomotiv işletmeleri için hazırlanmış profesyonel bir iş akışında güncellemeleri alın.",
    primaryCta: "Yeni Talep Başlat",
    secondaryCta: "Paneli Aç",
    processKicker: "Süreç",
    processTitle: "Hesap oluşturmadan güvenli teslimata kadar.",
    processText:
      "Platform müşteri, araç, servis, dosya ve mesaj bağlamını bir arada tutar; böylece her talep düzenli şekilde yönetilir.",
    dashboardKicker: "Panel avantajları",
    dashboardTitle: "Önemli tüm bilgiler talebe bağlı kalır.",
    securityKicker: "Güvenlik ve gizlilik",
    securityTitle: "Özel müşteri iş akışları üzerine kuruldu.",
    securityText:
      "Müşteri yüklemeleri özel akışlarla yönetilir. Müşteriler yalnızca kendi taleplerine erişebilir; dahili admin notları veya işlem detayları müşteri ekranlarında gösterilmez.",
    audienceKicker: "Kimler için",
    audienceTitle: "Tekrarlı dosya servisi işleri için pratik bir platform.",
    faqKicker: "SSS",
    faqTitle: "Sık sorulan sorular",
    finalTitle: "Dosya talebi göndermeye hazır mısınız?",
    finalText:
      "Araç, servis ve dosya bilgileriyle başlayın; ardından her şeyi panelinizden takip edin.",
    processSteps: [
      { title: "Hesabınızı oluşturun", text: "MG AutoTech hesabı oluşturarak panele erişin, talepleri yönetin, kredileri görün ve gönderilen dosyaları takip edin." },
      { title: "Aracınızı seçin", text: "Araç seçiciden marka, model, jenerasyon ve motoru seçin. Araç listede yoksa manuel araç bilgisi girebilirsiniz." },
      { title: "Servisi seçin", text: "Stage 1, TCU, VMAX, DTC talebi, Start/Stop veya hesabınıza uygun başka bir servis seçin." },
      { title: "ECU/TCU dosyanızı yükleyin", text: "Desteklenen dosya formatlarını güvenli yükleme akışıyla gönderin. Dosyalar talebinize bağlanır ve herkese açık değildir." },
      { title: "Kontrol ve işlem", text: "MG AutoTech dosya bilgilerini, araç verilerini, seçilen servisi, ödeme veya kredileri ve müşteri notlarını kontrol eder." },
      { title: "Durumu takip edin", text: "Talep durumu, müşteriye açık mesajlar, yükleme izinleri ve tamamlanma sürecini panelden takip edin." },
      { title: "Sonucu alın", text: "İş tamamlandığında sonuç güvenli müşteri panelinden veya tanımlı teslimat akışından sağlanır." },
    ],
    dashboardBenefits: [
      { title: "Güvenli dosya yönetimi", text: "Müşteri yüklemeleri doğru talebe bağlanır ve herkese açık indirme akışlarına girmez." },
      { title: "Talep durumu takibi", text: "Her talebi gönderimden kontrol, işlem ve tamamlanmaya kadar izleyin." },
      { title: "Müşteriye açık mesajlar", text: "Önemli güncellemeler ve sorular doğru siparişe bağlı kalır." },
      { title: "Kredi ve ödeme görünümü", text: "Talebe devam etmeden önce mevcut kredileri ve ödeme durumunu görün." },
      { title: "Araç ve servis bilgileri", text: "Seçilen araç, servis tipi ve müşteri notları tek yerde düzenli kalır." },
      { title: "Ek yükleme talepleri", text: "Başka bir dosya gerekirse MG AutoTech kontrollü ek yükleme izni açabilir." },
    ],
    securityItems: [
      "Dosyalar özel müşteri akışlarıyla yönetilir.",
      "Müşteri yüklemeleri için herkese açık indirme linkleri kullanılmaz.",
      "Müşteriler yalnızca kendi taleplerine erişebilir.",
      "Dahili admin notları ve işlem detayları müşterilere gösterilmez.",
      "Windows uygulaması, kullanıma açıldığında online doğrulama ve müşteri girişi ister.",
    ],
    audiences: ["Otomotiv servisleri", "Profesyonel tunerlar", "Otomotiv işletmeleri", "Düzenli dosya servisi müşterileri", "Yapılandırılmış ECU/TCU talep yönetimi isteyen müşteriler"],
    faq: [
      { q: "Hesap gerekli mi?", a: "Evet. Talep oluşturmak, dosya yüklemek, durumu görmek ve sonuçları almak için hesap gereklidir." },
      { q: "Windows uygulaması olmadan web sitesini kullanabilir miyim?", a: "Evet. Tarayıcı paneli kullanılmaya devam eder. Windows File Upload Assistant seçili beta kullanıcılar için ek bir seçenektir." },
      { q: "Hangi dosya türleri desteklenir?", a: "Talep türüne göre .bin, .ori, .mod, .hex, .frf, .sgo ve .zip gibi yaygın ECU/TCU formatları desteklenir." },
      { q: "Yüklenen dosyalar herkese açık mı?", a: "Hayır. Müşteri dosyaları özel talep akışlarıyla işlenir ve herkese açık indirme olarak sunulmaz." },
      { q: "Ek bilgi gerekirse ne olur?", a: "MG AutoTech müşteriye panel üzerinden ulaşabilir ve ek bilgi veya yeni yükleme isteyebilir." },
      { q: "Sistem dosyaları otomatik değiştirir mi?", a: "Hayır. Müşteri talepleri MG AutoTech işlem ve kontrol akışından geçer. Platform dosya servisi taleplerini profesyonel şekilde düzenlemek için tasarlanmıştır." },
    ],
    nav: { home: "Ana sayfa", services: "Servisler", howItWorks: "Nasıl çalışır", login: "Giriş", startRequest: "Talep başlat" },
  },
  nl: {
    ...en,
    title: "Zo werkt het",
    pageTitle: "Zo werkt het | MG AutoTech",
    description:
      "Bekijk hoe MG AutoTech klanten ECU/TCU-bestandsaanvragen indienen, bestanden veilig uploaden, status volgen en resultaten via het dashboard ontvangen.",
    navLabel: "Zo werkt het",
    eyebrow: "Professionele klantworkflow",
    hero: "Zo werkt de MG AutoTech file service",
    primaryCta: "Nieuwe aanvraag starten",
    secondaryCta: "Dashboard openen",
    nav: { home: "Home", services: "Services", howItWorks: "Zo werkt het", login: "Inloggen", startRequest: "Aanvraag starten" },
  },
  fr: {
    ...en,
    title: "Fonctionnement",
    pageTitle: "Fonctionnement | MG AutoTech",
    description:
      "Découvrez comment les clients MG AutoTech créent des demandes ECU/TCU, envoient les fichiers en sécurité, suivent le statut et reçoivent le résultat dans le tableau de bord.",
    navLabel: "Fonctionnement",
    eyebrow: "Flux client professionnel",
    hero: "Comment fonctionne le service de fichiers MG AutoTech",
    primaryCta: "Créer une demande",
    secondaryCta: "Ouvrir le tableau de bord",
    nav: { home: "Accueil", services: "Services", howItWorks: "Fonctionnement", login: "Connexion", startRequest: "Créer une demande" },
  },
  it: {
    ...en,
    title: "Come funziona",
    pageTitle: "Come funziona | MG AutoTech",
    description:
      "Scopri come i clienti MG AutoTech inviano richieste ECU/TCU, caricano file in sicurezza, seguono lo stato e ricevono il risultato nel dashboard.",
    navLabel: "Come funziona",
    eyebrow: "Flusso cliente professionale",
    hero: "Come funziona il file service MG AutoTech",
    primaryCta: "Crea nuova richiesta",
    secondaryCta: "Apri dashboard",
    nav: { home: "Home", services: "Servizi", howItWorks: "Come funziona", login: "Login", startRequest: "Avvia richiesta" },
  },
  ru: {
    ...en,
    title: "Как это работает",
    pageTitle: "Как это работает | MG AutoTech",
    description:
      "Как клиенты MG AutoTech создают заявки ECU/TCU, безопасно загружают файлы, отслеживают статус и получают результат в панели.",
    navLabel: "Как это работает",
    eyebrow: "Профессиональный клиентский процесс",
    hero: "Как работает файловый сервис MG AutoTech",
    primaryCta: "Создать заявку",
    secondaryCta: "Открыть панель",
    nav: { home: "Главная", services: "Услуги", howItWorks: "Как это работает", login: "Вход", startRequest: "Создать заявку" },
  },
  es: {
    ...en,
    title: "Cómo funciona",
    pageTitle: "Cómo funciona | MG AutoTech",
    description:
      "Aprende cómo los clientes de MG AutoTech crean solicitudes ECU/TCU, suben archivos de forma segura, siguen el estado y reciben resultados en el panel.",
    navLabel: "Cómo funciona",
    eyebrow: "Flujo profesional para clientes",
    hero: "Cómo funciona el servicio de archivos MG AutoTech",
    primaryCta: "Crear solicitud",
    secondaryCta: "Abrir panel",
    nav: { home: "Inicio", services: "Servicios", howItWorks: "Cómo funciona", login: "Acceder", startRequest: "Iniciar solicitud" },
  },
  pt: {
    ...en,
    title: "Como funciona",
    pageTitle: "Como funciona | MG AutoTech",
    description:
      "Saiba como os clientes MG AutoTech criam pedidos ECU/TCU, carregam ficheiros com segurança, acompanham o estado e recebem resultados no painel.",
    navLabel: "Como funciona",
    eyebrow: "Fluxo profissional para clientes",
    hero: "Como funciona o serviço de ficheiros MG AutoTech",
    primaryCta: "Criar pedido",
    secondaryCta: "Abrir painel",
    nav: { home: "Início", services: "Serviços", howItWorks: "Como funciona", login: "Entrar", startRequest: "Iniciar pedido" },
  },
  zh: {
    ...en,
    title: "工作流程",
    pageTitle: "工作流程 | MG AutoTech",
    description:
      "了解 MG AutoTech 客户如何提交 ECU/TCU 文件请求、安全上传文件、跟踪状态并在仪表板中接收结果。",
    navLabel: "工作流程",
    eyebrow: "专业客户流程",
    hero: "MG AutoTech 文件服务如何工作",
    primaryCta: "创建新请求",
    secondaryCta: "打开仪表板",
    nav: { home: "首页", services: "服务", howItWorks: "工作流程", login: "登录", startRequest: "开始请求" },
  },
  pl: {
    ...en,
    title: "Jak to działa",
    pageTitle: "Jak to działa | MG AutoTech",
    description:
      "Zobacz, jak klienci MG AutoTech tworzą zlecenia ECU/TCU, bezpiecznie przesyłają pliki, śledzą status i odbierają wyniki w panelu.",
    navLabel: "Jak to działa",
    eyebrow: "Profesjonalny proces klienta",
    hero: "Jak działa usługa plików MG AutoTech",
    primaryCta: "Utwórz zlecenie",
    secondaryCta: "Otwórz panel",
    nav: { home: "Start", services: "Usługi", howItWorks: "Jak to działa", login: "Logowanie", startRequest: "Rozpocznij zlecenie" },
  },
  sq: {
    ...en,
    title: "Si funksionon",
    pageTitle: "Si funksionon | MG AutoTech",
    description:
      "Mësoni si klientët e MG AutoTech krijojnë kërkesa ECU/TCU, ngarkojnë skedarë në mënyrë të sigurt, ndjekin statusin dhe marrin rezultatin në panel.",
    navLabel: "Si funksionon",
    eyebrow: "Proces profesional për klientin",
    hero: "Si funksionon shërbimi i skedarëve MG AutoTech",
    primaryCta: "Krijo kërkesë",
    secondaryCta: "Hap panelin",
    nav: { home: "Kryefaqja", services: "Shërbime", howItWorks: "Si funksionon", login: "Hyrje", startRequest: "Nis kërkesë" },
  },
};

export function getHowItWorksCopy(locale: LocaleCode) {
  return howItWorksCopy[locale] ?? howItWorksCopy.en;
}

export function howItWorksJsonLd(locale: LocaleCode, url: string) {
  const copy = getHowItWorksCopy(locale);

  return {
    page: {
      "@type": "WebPage",
      "@id": `${url}#page`,
      name: copy.title,
      description: copy.description,
      url,
      inLanguage: hreflangByLocale[locale],
    },
    faq: {
      "@type": "FAQPage",
      inLanguage: hreflangByLocale[locale],
      mainEntity: copy.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    },
  };
}
