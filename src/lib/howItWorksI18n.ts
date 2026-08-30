import type { LocaleCode } from "@/lib/i18nConfig";
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
    title: "Zo werkt het",
    pageTitle: "Zo werkt het | MG AutoTech",
    description:
      "Bekijk hoe MG AutoTech klanten ECU/TCU-bestandsaanvragen indienen, bestanden veilig uploaden, status volgen en resultaten via het dashboard ontvangen.",
    navLabel: "Zo werkt het",
    eyebrow: "Professionele klantworkflow",
    hero: "Zo werkt de MG AutoTech file service",
    intro:
      "Dien ECU/TCU-bestandsaanvragen veilig in, volg elke stap in uw dashboard en ontvang updates via een professionele workflow voor tuners, werkplaatsen en automotive bedrijven.",
    primaryCta: "Nieuwe aanvraag starten",
    secondaryCta: "Dashboard openen",
    processKicker: "Proces",
    processTitle: "Van account aanmaken tot veilige levering.",
    processText:
      "Het platform houdt klant-, voertuig-, service-, bestands- en berichtgegevens bij elkaar, zodat elke aanvraag zorgvuldig kan worden verwerkt.",
    dashboardKicker: "Voordelen van het dashboard",
    dashboardTitle: "Alle belangrijke informatie blijft aan de aanvraag gekoppeld.",
    securityKicker: "Beveiliging en privacy",
    securityTitle: "Gebouwd rond afgeschermde klantworkflows.",
    securityText:
      "Uploads van klanten worden via afgeschermde processen verwerkt. Klanten hebben alleen toegang tot hun eigen aanvragen; interne beheerdersnotities en verwerkingsdetails verschijnen niet in klantweergaven.",
    audienceKicker: "Voor wie",
    audienceTitle: "Een praktisch platform voor terugkerend file-servicewerk.",
    faqKicker: "Veelgestelde vragen",
    faqTitle: "Veelgestelde vragen",
    finalTitle: "Klaar om een bestandsaanvraag in te dienen?",
    finalText:
      "Begin met de voertuig-, service- en bestandsgegevens en volg daarna alles in uw dashboard.",
    processSteps: [
      { title: "Maak uw account aan", text: "Maak een MG AutoTech-account aan om het dashboard te openen, aanvragen te beheren, credits te bekijken en ingediende bestanden te volgen." },
      { title: "Selecteer uw voertuig", text: "Kies merk, model, generatie en motor in de voertuigselector. Staat het voertuig er niet bij, voer de voertuiggegevens dan handmatig in." },
      { title: "Kies de service", text: "Selecteer de gewenste file service, zoals Stage 1, TCU, VMAX, een DTC-aanvraag, Start/Stop of een andere beschikbare service." },
      { title: "Upload uw ECU/TCU-bestand", text: "Upload ondersteunde bestandsformaten via de beveiligde upload. Bestanden worden aan uw aanvraag gekoppeld en zijn niet openbaar toegankelijk." },
      { title: "Controle en verwerking", text: "MG AutoTech controleert de bestandsinformatie, voertuiggegevens, gekozen service, betaling of credits en klantnotities." },
      { title: "Volg de status", text: "Volg in het dashboard de aanvraagstatus, klantzichtbare berichten, uploadrechten en voortgang tot voltooiing." },
      { title: "Ontvang het resultaat", text: "Zodra het werk is afgerond, wordt het resultaat beschikbaar gesteld via het beveiligde klantdashboard of de ingestelde leveringsworkflow." },
    ],
    dashboardBenefits: [
      { title: "Veilige bestandsverwerking", text: "Uploads van klanten worden aan de juiste aanvraag gekoppeld en blijven buiten openbare downloadstromen." },
      { title: "Aanvraagstatus volgen", text: "Volg elke aanvraag van indiening via controle en verwerking tot afronding." },
      { title: "Klantzichtbare berichten", text: "Belangrijke updates en vragen blijven aan de juiste opdracht gekoppeld." },
      { title: "Overzicht van credits en betaling", text: "Bekijk beschikbare credits en de betaalstatus voordat u met aanvragen doorgaat." },
      { title: "Voertuig- en servicegegevens", text: "Bewaar gekozen voertuiggegevens, servicetype en klantnotities overzichtelijk op één plek." },
      { title: "Aanvullende uploads", text: "Als nog een bestand nodig is, kan MG AutoTech gecontroleerd een extra upload toestaan." },
    ],
    securityItems: [
      "Bestanden worden via afgeschermde klantworkflows verwerkt.",
      "Voor uploads van klanten worden geen openbare downloadlinks gebruikt.",
      "Klanten hebben alleen toegang tot hun eigen aanvragen.",
      "Interne beheerdersnotities en verwerkingsdetails zijn niet zichtbaar voor klanten.",
      "De desktop-app vereist, zodra deze beschikbaar is, online verificatie en een klantlogin.",
    ],
    audiences: [
      "Automotive werkplaatsen",
      "Professionele tuners",
      "Automotive bedrijven",
      "Terugkerende file-serviceklanten",
      "Klanten die een gestructureerde afhandeling van ECU/TCU-aanvragen nodig hebben",
    ],
    faq: [
      { q: "Heb ik een account nodig?", a: "Ja. Een account is nodig om aanvragen in te dienen, bestanden te uploaden, de status te bekijken en resultaten te ontvangen." },
      { q: "Kan ik de website zonder de Windows-app gebruiken?", a: "Ja. Het browserdashboard blijft beschikbaar. De Windows File Upload Assistant is een aanvullende optie voor geselecteerde bètagebruikers." },
      { q: "Welke bestandstypen worden ondersteund?", a: "Gangbare ECU/TCU-formaten zoals .bin, .ori, .mod, .hex, .frf, .sgo en .zip worden ondersteund, afhankelijk van het type aanvraag." },
      { q: "Zijn geüploade bestanden openbaar?", a: "Nee. Klantbestanden worden via afgeschermde aanvraagprocessen verwerkt en niet als openbare downloads aangeboden." },
      { q: "Wat gebeurt er als meer informatie nodig is?", a: "MG AutoTech kan via het dashboard contact opnemen met de klant en om aanvullende informatie of een extra upload vragen." },
      { q: "Wijzigt het systeem bestanden automatisch?", a: "Nee. Klantaanvragen doorlopen de verwerkings- en controleworkflow van MG AutoTech. Het platform is bedoeld om file-serviceaanvragen professioneel te structureren en beheren." },
    ],
    nav: { home: "Home", services: "Services", howItWorks: "Zo werkt het", login: "Inloggen", startRequest: "Aanvraag starten" },
  },
  fr: {
    title: "Fonctionnement",
    pageTitle: "Fonctionnement | MG AutoTech",
    description:
      "Découvrez comment les clients MG AutoTech créent des demandes ECU/TCU, envoient les fichiers en sécurité, suivent le statut et reçoivent le résultat dans le tableau de bord.",
    navLabel: "Fonctionnement",
    eyebrow: "Flux client professionnel",
    hero: "Comment fonctionne le service de fichiers MG AutoTech",
    intro:
      "Envoyez vos demandes de fichiers ECU/TCU en toute sécurité, suivez chaque étape dans votre tableau de bord et recevez les mises à jour dans un flux professionnel conçu pour les préparateurs, les ateliers et les entreprises automobiles.",
    primaryCta: "Créer une demande",
    secondaryCta: "Ouvrir le tableau de bord",
    processKicker: "Processus",
    processTitle: "De la création du compte à la livraison sécurisée.",
    processText:
      "La plateforme relie le client, le véhicule, le service, le fichier et les messages afin que chaque demande soit traitée clairement.",
    dashboardKicker: "Avantages du tableau de bord",
    dashboardTitle: "Toutes les informations importantes restent liées à la demande.",
    securityKicker: "Sécurité et confidentialité",
    securityTitle: "Conçu autour de flux clients privés.",
    securityText:
      "Les fichiers clients sont traités dans des flux privés. Chaque client accède uniquement à ses propres demandes, et les notes internes ou détails de traitement ne sont pas affichés dans les vues client.",
    audienceKicker: "Pour qui",
    audienceTitle: "Une plateforme pratique pour les travaux de fichiers récurrents.",
    faqKicker: "FAQ",
    faqTitle: "Questions fréquentes",
    finalTitle: "Prêt à envoyer une demande de fichier ?",
    finalText:
      "Commencez par les informations du véhicule, du service et du fichier, puis suivez tout depuis votre tableau de bord.",
    processSteps: [
      { title: "Créez votre compte", text: "Créez un compte MG AutoTech pour accéder au tableau de bord, gérer vos demandes, consulter vos crédits et suivre les fichiers envoyés." },
      { title: "Sélectionnez votre véhicule", text: "Choisissez la marque, le modèle, la génération et le moteur dans le sélecteur. Si le véhicule n'est pas répertorié, renseignez ses informations manuellement." },
      { title: "Choisissez le service", text: "Sélectionnez le service de fichiers requis, par exemple Stage 1, TCU, VMAX, une demande DTC, Start/Stop ou un autre service disponible." },
      { title: "Importez votre fichier ECU/TCU", text: "Importez un format pris en charge au moyen du flux sécurisé. Le fichier reste lié à votre demande et n'est pas accessible publiquement." },
      { title: "Contrôle et traitement", text: "MG AutoTech vérifie les informations du fichier, les données du véhicule, le service choisi, le paiement ou les crédits et les notes du client." },
      { title: "Suivez le statut", text: "Suivez dans le tableau de bord le statut, les messages visibles par le client, les autorisations d'envoi et la progression jusqu'à la fin." },
      { title: "Recevez le résultat", text: "Une fois le travail terminé, le résultat est fourni dans le tableau de bord client sécurisé ou par le flux de livraison configuré." },
    ],
    dashboardBenefits: [
      { title: "Gestion sécurisée des fichiers", text: "Les fichiers clients sont rattachés à la bonne demande et exclus de tout téléchargement public." },
      { title: "Suivi du statut", text: "Suivez chaque demande de l'envoi jusqu'à la fin, en passant par le contrôle et le traitement." },
      { title: "Messages visibles par le client", text: "Les mises à jour et questions importantes restent liées à la bonne commande." },
      { title: "Vue des crédits et paiements", text: "Consultez les crédits disponibles et l'état du paiement avant de poursuivre vos demandes." },
      { title: "Détails du véhicule et du service", text: "Conservez les données du véhicule, le type de service et les notes du client de façon structurée au même endroit." },
      { title: "Demandes d'envoi supplémentaire", text: "Si un autre fichier est nécessaire, MG AutoTech peut autoriser un envoi supplémentaire contrôlé." },
    ],
    securityItems: [
      "Les fichiers sont traités dans des flux clients privés.",
      "Aucun lien de téléchargement public n'est utilisé pour les envois des clients.",
      "Les clients accèdent uniquement à leurs propres demandes.",
      "Les notes internes et détails de traitement ne sont pas visibles par les clients.",
      "Lorsqu'elle est disponible, l'application de bureau exige une vérification en ligne et une connexion client.",
    ],
    audiences: [
      "Ateliers automobiles",
      "Préparateurs professionnels",
      "Entreprises automobiles",
      "Clients réguliers du service de fichiers",
      "Clients ayant besoin d'une gestion structurée des demandes ECU/TCU",
    ],
    faq: [
      { q: "Ai-je besoin d'un compte ?", a: "Oui. Un compte est nécessaire pour envoyer des demandes et des fichiers, consulter le statut et recevoir les résultats." },
      { q: "Puis-je utiliser le site sans l'application Windows ?", a: "Oui. Le tableau de bord dans le navigateur reste disponible. Windows File Upload Assistant est une option supplémentaire réservée à certains utilisateurs bêta." },
      { q: "Quels types de fichiers sont pris en charge ?", a: "Les formats ECU/TCU courants tels que .bin, .ori, .mod, .hex, .frf, .sgo et .zip sont pris en charge selon le type de demande." },
      { q: "Les fichiers importés sont-ils publics ?", a: "Non. Les fichiers clients sont traités dans des flux de demande privés et ne sont pas proposés en téléchargement public." },
      { q: "Que se passe-t-il si des informations supplémentaires sont nécessaires ?", a: "MG AutoTech peut contacter le client dans le tableau de bord et demander des informations ou un fichier supplémentaire." },
      { q: "Le système modifie-t-il automatiquement les fichiers ?", a: "Non. Les demandes passent par le flux de traitement et de contrôle de MG AutoTech. La plateforme sert à structurer et gérer professionnellement les demandes de service de fichiers." },
    ],
    nav: { home: "Accueil", services: "Services", howItWorks: "Fonctionnement", login: "Connexion", startRequest: "Créer une demande" },
  },
  it: {
    title: "Come funziona",
    pageTitle: "Come funziona | MG AutoTech",
    description:
      "Scopri come i clienti MG AutoTech inviano richieste ECU/TCU, caricano file in sicurezza, seguono lo stato e ricevono il risultato nel dashboard.",
    navLabel: "Come funziona",
    eyebrow: "Flusso cliente professionale",
    hero: "Come funziona il file service MG AutoTech",
    intro:
      "Invia in sicurezza le richieste di file ECU/TCU, segui ogni fase nella dashboard e ricevi aggiornamenti attraverso un flusso professionale pensato per tuner, officine e aziende automotive.",
    primaryCta: "Crea nuova richiesta",
    secondaryCta: "Apri dashboard",
    processKicker: "Processo",
    processTitle: "Dalla creazione dell'account alla consegna sicura.",
    processText:
      "La piattaforma mantiene collegati cliente, veicolo, servizio, file e messaggi, così ogni richiesta può essere gestita con ordine.",
    dashboardKicker: "Vantaggi della dashboard",
    dashboardTitle: "Tutte le informazioni importanti restano collegate alla richiesta.",
    securityKicker: "Sicurezza e privacy",
    securityTitle: "Progettato per flussi cliente riservati.",
    securityText:
      "I file dei clienti vengono gestiti tramite flussi riservati. Ogni cliente può accedere solo alle proprie richieste; note interne e dettagli di lavorazione non vengono mostrati nelle viste cliente.",
    audienceKicker: "A chi è rivolto",
    audienceTitle: "Una piattaforma pratica per attività di file service ricorrenti.",
    faqKicker: "FAQ",
    faqTitle: "Domande frequenti",
    finalTitle: "Pronto a inviare una richiesta di file?",
    finalText:
      "Inizia dai dati di veicolo, servizio e file, quindi segui tutto nella dashboard.",
    processSteps: [
      { title: "Crea il tuo account", text: "Crea un account MG AutoTech per accedere alla dashboard, gestire le richieste, vedere i crediti e seguire i file inviati." },
      { title: "Seleziona il veicolo", text: "Scegli marca, modello, generazione e motore dal selettore. Se il veicolo non è presente, inserisci manualmente i relativi dati." },
      { title: "Scegli il servizio", text: "Seleziona il file service richiesto, ad esempio Stage 1, TCU, VMAX, richiesta DTC, Start/Stop o un altro servizio disponibile." },
      { title: "Carica il file ECU/TCU", text: "Carica un formato supportato attraverso il flusso sicuro. I file restano collegati alla richiesta e non sono accessibili pubblicamente." },
      { title: "Controllo e lavorazione", text: "MG AutoTech verifica informazioni del file, dati del veicolo, servizio scelto, pagamento o crediti e note del cliente." },
      { title: "Segui lo stato", text: "Dalla dashboard puoi seguire stato della richiesta, messaggi visibili al cliente, autorizzazioni di caricamento e avanzamento." },
      { title: "Ricevi il risultato", text: "Al termine del lavoro, il risultato viene fornito tramite la dashboard cliente sicura o il flusso di consegna configurato." },
    ],
    dashboardBenefits: [
      { title: "Gestione sicura dei file", text: "I file caricati vengono collegati alla richiesta corretta e restano fuori dai download pubblici." },
      { title: "Monitoraggio dello stato", text: "Segui ogni richiesta dall'invio alla verifica, alla lavorazione e al completamento." },
      { title: "Messaggi visibili al cliente", text: "Aggiornamenti e domande importanti restano collegati all'ordine corretto." },
      { title: "Panoramica crediti e pagamenti", text: "Controlla i crediti disponibili e lo stato del pagamento prima di proseguire con le richieste." },
      { title: "Dati di veicolo e servizio", text: "Mantieni organizzati in un unico punto veicolo scelto, tipo di servizio e note del cliente." },
      { title: "Richieste di caricamento aggiuntivo", text: "Se serve un altro file, MG AutoTech può autorizzare un caricamento aggiuntivo controllato." },
    ],
    securityItems: [
      "I file vengono gestiti tramite flussi cliente riservati.",
      "Per i caricamenti dei clienti non vengono utilizzati link di download pubblici.",
      "I clienti possono accedere solo alle proprie richieste.",
      "Le note interne e i dettagli di lavorazione non vengono mostrati ai clienti.",
      "Quando disponibile, l'app desktop richiede verifica online e accesso del cliente.",
    ],
    audiences: [
      "Officine automotive",
      "Tuner professionisti",
      "Aziende automotive",
      "Clienti abituali del file service",
      "Clienti che necessitano di una gestione strutturata delle richieste ECU/TCU",
    ],
    faq: [
      { q: "È necessario un account?", a: "Sì. È necessario un account per inviare richieste e file, vedere lo stato e ricevere i risultati." },
      { q: "Posso usare il sito senza l'app Windows?", a: "Sì. La dashboard nel browser resta disponibile. Windows File Upload Assistant è un'opzione aggiuntiva per utenti beta selezionati." },
      { q: "Quali tipi di file sono supportati?", a: "A seconda della richiesta sono supportati i comuni formati ECU/TCU, tra cui .bin, .ori, .mod, .hex, .frf, .sgo e .zip." },
      { q: "I file caricati sono pubblici?", a: "No. I file dei clienti vengono gestiti attraverso flussi di richiesta riservati e non sono esposti come download pubblici." },
      { q: "Cosa succede se servono altre informazioni?", a: "MG AutoTech può contattare il cliente tramite la dashboard e richiedere informazioni o un ulteriore caricamento." },
      { q: "Il sistema modifica automaticamente i file?", a: "No. Le richieste passano attraverso il flusso di lavorazione e controllo di MG AutoTech. La piattaforma è progettata per strutturare e gestire professionalmente le richieste di file service." },
    ],
    nav: { home: "Home", services: "Servizi", howItWorks: "Come funziona", login: "Login", startRequest: "Avvia richiesta" },
  },
  ru: {
    title: "Как это работает",
    pageTitle: "Как это работает | MG AutoTech",
    description:
      "Как клиенты MG AutoTech создают заявки ECU/TCU, безопасно загружают файлы, отслеживают статус и получают результат в панели.",
    navLabel: "Как это работает",
    eyebrow: "Профессиональный клиентский процесс",
    hero: "Как работает файловый сервис MG AutoTech",
    intro:
      "Безопасно отправляйте заявки на файлы ECU/TCU, отслеживайте каждый этап в личном кабинете и получайте обновления в рамках профессионального процесса для тюнеров, мастерских и автомобильных компаний.",
    primaryCta: "Создать заявку",
    secondaryCta: "Открыть панель",
    processKicker: "Процесс",
    processTitle: "От создания аккаунта до безопасной выдачи результата.",
    processText:
      "Платформа связывает данные клиента, автомобиля, услуги, файла и переписку, чтобы каждая заявка обрабатывалась последовательно.",
    dashboardKicker: "Возможности личного кабинета",
    dashboardTitle: "Вся важная информация остается связанной с заявкой.",
    securityKicker: "Безопасность и конфиденциальность",
    securityTitle: "Создано для закрытых клиентских процессов.",
    securityText:
      "Клиентские файлы обрабатываются в закрытых процессах. Клиенты имеют доступ только к своим заявкам, а внутренние заметки администраторов и детали обработки не отображаются в клиентской части.",
    audienceKicker: "Для кого",
    audienceTitle: "Практичная платформа для регулярной работы с файлами.",
    faqKicker: "Вопросы и ответы",
    faqTitle: "Частые вопросы",
    finalTitle: "Готовы отправить заявку на файл?",
    finalText:
      "Укажите автомобиль, услугу и данные файла, а затем отслеживайте весь процесс в личном кабинете.",
    processSteps: [
      { title: "Создайте аккаунт", text: "Создайте аккаунт MG AutoTech, чтобы пользоваться личным кабинетом, управлять заявками, видеть кредиты и отслеживать отправленные файлы." },
      { title: "Выберите автомобиль", text: "Выберите марку, модель, поколение и двигатель. Если автомобиля нет в списке, укажите его данные вручную." },
      { title: "Выберите услугу", text: "Выберите нужную файловую услугу: Stage 1, TCU, VMAX, запрос DTC, Start/Stop или другую доступную услугу." },
      { title: "Загрузите файл ECU/TCU", text: "Загрузите поддерживаемый формат через защищенный интерфейс. Файл будет связан с заявкой и не станет общедоступным." },
      { title: "Проверка и обработка", text: "MG AutoTech проверяет сведения о файле, данные автомобиля, выбранную услугу, оплату или кредиты и примечания клиента." },
      { title: "Отслеживайте статус", text: "В личном кабинете отображаются статус заявки, сообщения для клиента, разрешения на загрузку и ход выполнения." },
      { title: "Получите результат", text: "После завершения работы результат предоставляется в защищенном личном кабинете или через настроенный процесс выдачи." },
    ],
    dashboardBenefits: [
      { title: "Безопасная работа с файлами", text: "Клиентские файлы прикрепляются к нужной заявке и не попадают в открытый доступ." },
      { title: "Отслеживание заявки", text: "Следите за заявкой от отправки и проверки до обработки и завершения." },
      { title: "Сообщения для клиента", text: "Важные обновления и вопросы остаются привязаны к нужному заказу." },
      { title: "Обзор кредитов и оплаты", text: "Проверяйте доступные кредиты и состояние оплаты перед продолжением работы с заявками." },
      { title: "Данные автомобиля и услуги", text: "Храните выбранные данные автомобиля, тип услуги и примечания клиента в одном структурированном месте." },
      { title: "Дополнительная загрузка", text: "Если потребуется еще один файл, MG AutoTech может разрешить контролируемую дополнительную загрузку." },
    ],
    securityItems: [
      "Файлы обрабатываются в закрытых клиентских процессах.",
      "Для клиентских загрузок не используются общедоступные ссылки.",
      "Клиенты могут просматривать только свои заявки.",
      "Внутренние заметки и детали обработки не показываются клиентам.",
      "Когда настольное приложение доступно, для него требуются онлайн-проверка и вход клиента.",
    ],
    audiences: [
      "Автомобильные мастерские",
      "Профессиональные тюнеры",
      "Автомобильные компании",
      "Постоянные клиенты файлового сервиса",
      "Клиенты, которым нужна структурированная обработка заявок ECU/TCU",
    ],
    faq: [
      { q: "Нужен ли аккаунт?", a: "Да. Аккаунт необходим, чтобы создавать заявки, загружать файлы, смотреть статус и получать результаты." },
      { q: "Можно ли пользоваться сайтом без приложения Windows?", a: "Да. Личный кабинет в браузере остается доступным. Windows File Upload Assistant — дополнительная возможность для отдельных участников бета-тестирования." },
      { q: "Какие типы файлов поддерживаются?", a: "В зависимости от типа заявки поддерживаются распространенные форматы ECU/TCU: .bin, .ori, .mod, .hex, .frf, .sgo и .zip." },
      { q: "Загруженные файлы общедоступны?", a: "Нет. Клиентские файлы обрабатываются в закрытых процессах и не публикуются для свободного скачивания." },
      { q: "Что произойдет, если нужны дополнительные сведения?", a: "MG AutoTech может связаться с клиентом через личный кабинет и запросить дополнительные сведения или еще один файл." },
      { q: "Система изменяет файлы автоматически?", a: "Нет. Заявки проходят обработку и проверку MG AutoTech. Платформа предназначена для профессиональной организации и управления файловыми заявками." },
    ],
    nav: { home: "Главная", services: "Услуги", howItWorks: "Как это работает", login: "Вход", startRequest: "Создать заявку" },
  },
  es: {
    title: "Cómo funciona",
    pageTitle: "Cómo funciona | MG AutoTech",
    description:
      "Aprende cómo los clientes de MG AutoTech crean solicitudes ECU/TCU, suben archivos de forma segura, siguen el estado y reciben resultados en el panel.",
    navLabel: "Cómo funciona",
    eyebrow: "Flujo profesional para clientes",
    hero: "Cómo funciona el servicio de archivos MG AutoTech",
    intro:
      "Envía solicitudes de archivos ECU/TCU de forma segura, sigue cada paso en tu panel y recibe actualizaciones mediante un flujo profesional diseñado para preparadores, talleres y empresas de automoción.",
    primaryCta: "Crear solicitud",
    secondaryCta: "Abrir panel",
    processKicker: "Proceso",
    processTitle: "Desde la creación de la cuenta hasta la entrega segura.",
    processText:
      "La plataforma mantiene conectados el cliente, el vehículo, el servicio, el archivo y los mensajes para que cada solicitud se gestione con claridad.",
    dashboardKicker: "Ventajas del panel",
    dashboardTitle: "Toda la información importante permanece vinculada a la solicitud.",
    securityKicker: "Seguridad y privacidad",
    securityTitle: "Diseñado en torno a flujos privados para clientes.",
    securityText:
      "Los archivos de clientes se gestionan mediante flujos privados. Cada cliente solo puede acceder a sus propias solicitudes; las notas internas y los detalles de procesamiento no se muestran en las vistas del cliente.",
    audienceKicker: "Para quién",
    audienceTitle: "Una plataforma práctica para trabajos recurrentes de servicio de archivos.",
    faqKicker: "Preguntas frecuentes",
    faqTitle: "Preguntas habituales",
    finalTitle: "¿Listo para enviar una solicitud de archivo?",
    finalText:
      "Empieza por los datos del vehículo, el servicio y el archivo, y después sigue todo desde tu panel.",
    processSteps: [
      { title: "Crea tu cuenta", text: "Crea una cuenta de MG AutoTech para acceder al panel, gestionar solicitudes, consultar créditos y seguir los archivos enviados." },
      { title: "Selecciona tu vehículo", text: "Elige marca, modelo, generación y motor en el selector. Si el vehículo no aparece, introduce sus datos manualmente." },
      { title: "Elige el servicio", text: "Selecciona el servicio de archivos necesario, como Stage 1, TCU, VMAX, una solicitud DTC, Start/Stop u otro servicio disponible." },
      { title: "Sube tu archivo ECU/TCU", text: "Sube un formato compatible mediante el flujo seguro. Los archivos quedan vinculados a tu solicitud y no son de acceso público." },
      { title: "Revisión y procesamiento", text: "MG AutoTech revisa la información del archivo, los datos del vehículo, el servicio elegido, el pago o los créditos y las notas del cliente." },
      { title: "Sigue el estado", text: "Consulta en el panel el estado de la solicitud, los mensajes visibles para el cliente, los permisos de subida y el progreso." },
      { title: "Recibe el resultado", text: "Cuando finaliza el trabajo, el resultado se entrega en el panel seguro del cliente o mediante el flujo de entrega configurado." },
    ],
    dashboardBenefits: [
      { title: "Gestión segura de archivos", text: "Los archivos de clientes se vinculan a la solicitud correcta y quedan fuera de las descargas públicas." },
      { title: "Seguimiento de solicitudes", text: "Sigue cada solicitud desde el envío hasta la revisión, el procesamiento y la finalización." },
      { title: "Mensajes visibles para el cliente", text: "Las actualizaciones y preguntas importantes permanecen vinculadas al pedido correcto." },
      { title: "Resumen de créditos y pagos", text: "Consulta los créditos disponibles y el estado del pago antes de continuar con las solicitudes." },
      { title: "Datos del vehículo y del servicio", text: "Mantén organizados en un solo lugar el vehículo elegido, el tipo de servicio y las notas del cliente." },
      { title: "Solicitudes de subida adicional", text: "Si se necesita otro archivo, MG AutoTech puede habilitar una subida adicional controlada." },
    ],
    securityItems: [
      "Los archivos se gestionan mediante flujos privados para clientes.",
      "No se utilizan enlaces de descarga públicos para las subidas de clientes.",
      "Los clientes solo pueden acceder a sus propias solicitudes.",
      "Las notas internas y los detalles de procesamiento no se muestran a los clientes.",
      "Cuando está disponible, la aplicación de escritorio requiere verificación en línea e inicio de sesión del cliente.",
    ],
    audiences: [
      "Talleres de automoción",
      "Preparadores profesionales",
      "Empresas de automoción",
      "Clientes recurrentes del servicio de archivos",
      "Clientes que necesitan una gestión estructurada de solicitudes ECU/TCU",
    ],
    faq: [
      { q: "¿Necesito una cuenta?", a: "Sí. Se necesita una cuenta para enviar solicitudes y archivos, consultar el estado y recibir resultados." },
      { q: "¿Puedo usar la web sin la aplicación de Windows?", a: "Sí. El panel del navegador sigue disponible. Windows File Upload Assistant es una opción adicional para determinados usuarios beta." },
      { q: "¿Qué tipos de archivo se admiten?", a: "Según el tipo de solicitud, se admiten formatos ECU/TCU habituales como .bin, .ori, .mod, .hex, .frf, .sgo y .zip." },
      { q: "¿Los archivos subidos son públicos?", a: "No. Los archivos de clientes se gestionan mediante flujos privados y no se ofrecen como descargas públicas." },
      { q: "¿Qué ocurre si hace falta más información?", a: "MG AutoTech puede contactar con el cliente a través del panel y pedir información o una subida adicional." },
      { q: "¿El sistema modifica los archivos automáticamente?", a: "No. Las solicitudes pasan por el flujo de procesamiento y revisión de MG AutoTech. La plataforma está diseñada para estructurar y gestionar profesionalmente las solicitudes de servicio de archivos." },
    ],
    nav: { home: "Inicio", services: "Servicios", howItWorks: "Cómo funciona", login: "Acceder", startRequest: "Iniciar solicitud" },
  },
  pt: {
    title: "Como funciona",
    pageTitle: "Como funciona | MG AutoTech",
    description:
      "Saiba como os clientes MG AutoTech criam pedidos ECU/TCU, carregam ficheiros com segurança, acompanham o estado e recebem resultados no painel.",
    navLabel: "Como funciona",
    eyebrow: "Fluxo profissional para clientes",
    hero: "Como funciona o serviço de ficheiros MG AutoTech",
    intro:
      "Envie pedidos de ficheiros ECU/TCU em segurança, acompanhe cada etapa no painel e receba atualizações através de um fluxo profissional criado para preparadores, oficinas e empresas do setor automóvel.",
    primaryCta: "Criar pedido",
    secondaryCta: "Abrir painel",
    processKicker: "Processo",
    processTitle: "Da criação da conta à entrega segura.",
    processText:
      "A plataforma mantém ligados o cliente, o veículo, o serviço, o ficheiro e as mensagens, para que cada pedido seja tratado de forma organizada.",
    dashboardKicker: "Vantagens do painel",
    dashboardTitle: "Toda a informação importante permanece ligada ao pedido.",
    securityKicker: "Segurança e privacidade",
    securityTitle: "Concebido em torno de fluxos privados para clientes.",
    securityText:
      "Os ficheiros dos clientes são tratados em fluxos privados. Cada cliente acede apenas aos próprios pedidos; as notas internas e os detalhes de processamento não aparecem nas áreas de cliente.",
    audienceKicker: "Para quem",
    audienceTitle: "Uma plataforma prática para trabalhos recorrentes de serviço de ficheiros.",
    faqKicker: "Perguntas frequentes",
    faqTitle: "Perguntas comuns",
    finalTitle: "Pronto para enviar um pedido de ficheiro?",
    finalText:
      "Comece pelos dados do veículo, do serviço e do ficheiro e acompanhe depois todo o processo no painel.",
    processSteps: [
      { title: "Crie a sua conta", text: "Crie uma conta MG AutoTech para aceder ao painel, gerir pedidos, consultar créditos e acompanhar os ficheiros enviados." },
      { title: "Selecione o veículo", text: "Escolha a marca, o modelo, a geração e o motor no seletor. Se o veículo não estiver listado, introduza os dados manualmente." },
      { title: "Escolha o serviço", text: "Selecione o serviço de ficheiros necessário, como Stage 1, TCU, VMAX, pedido DTC, Start/Stop ou outro serviço disponível." },
      { title: "Carregue o ficheiro ECU/TCU", text: "Carregue um formato suportado através do fluxo seguro. O ficheiro fica ligado ao pedido e não é acessível publicamente." },
      { title: "Revisão e processamento", text: "A MG AutoTech verifica as informações do ficheiro, os dados do veículo, o serviço escolhido, o pagamento ou os créditos e as notas do cliente." },
      { title: "Acompanhe o estado", text: "Acompanhe no painel o estado do pedido, as mensagens visíveis para o cliente, as permissões de carregamento e o progresso." },
      { title: "Receba o resultado", text: "Quando o trabalho estiver concluído, o resultado é disponibilizado no painel seguro do cliente ou através do fluxo de entrega configurado." },
    ],
    dashboardBenefits: [
      { title: "Gestão segura de ficheiros", text: "Os ficheiros dos clientes são associados ao pedido correto e ficam fora de downloads públicos." },
      { title: "Acompanhamento do pedido", text: "Acompanhe cada pedido desde o envio, passando pela revisão e processamento, até à conclusão." },
      { title: "Mensagens visíveis para o cliente", text: "As atualizações e questões importantes permanecem ligadas à encomenda correta." },
      { title: "Resumo de créditos e pagamentos", text: "Consulte os créditos disponíveis e o estado do pagamento antes de prosseguir com os pedidos." },
      { title: "Dados do veículo e do serviço", text: "Mantenha organizados num só local o veículo escolhido, o tipo de serviço e as notas do cliente." },
      { title: "Pedidos de carregamento adicional", text: "Se for necessário outro ficheiro, a MG AutoTech pode autorizar um carregamento adicional controlado." },
    ],
    securityItems: [
      "Os ficheiros são tratados através de fluxos privados para clientes.",
      "Não são usados links de download públicos para os carregamentos dos clientes.",
      "Os clientes só podem aceder aos próprios pedidos.",
      "As notas internas e os detalhes de processamento não são apresentados aos clientes.",
      "Quando disponível, a aplicação para computador exige verificação online e início de sessão do cliente.",
    ],
    audiences: [
      "Oficinas automóveis",
      "Preparadores profissionais",
      "Empresas do setor automóvel",
      "Clientes regulares do serviço de ficheiros",
      "Clientes que precisam de uma gestão estruturada de pedidos ECU/TCU",
    ],
    faq: [
      { q: "Preciso de uma conta?", a: "Sim. É necessária uma conta para enviar pedidos e ficheiros, consultar o estado e receber os resultados." },
      { q: "Posso utilizar o site sem a aplicação Windows?", a: "Sim. O painel no navegador continua disponível. O Windows File Upload Assistant é uma opção adicional para determinados utilizadores beta." },
      { q: "Que tipos de ficheiro são suportados?", a: "Consoante o tipo de pedido, são suportados formatos ECU/TCU comuns como .bin, .ori, .mod, .hex, .frf, .sgo e .zip." },
      { q: "Os ficheiros carregados são públicos?", a: "Não. Os ficheiros dos clientes são tratados em fluxos de pedido privados e não são disponibilizados como downloads públicos." },
      { q: "O que acontece se forem necessárias mais informações?", a: "A MG AutoTech pode contactar o cliente através do painel e pedir informações ou um carregamento adicional." },
      { q: "O sistema modifica os ficheiros automaticamente?", a: "Não. Os pedidos passam pelo fluxo de processamento e revisão da MG AutoTech. A plataforma foi criada para estruturar e gerir profissionalmente pedidos de serviço de ficheiros." },
    ],
    nav: { home: "Início", services: "Serviços", howItWorks: "Como funciona", login: "Entrar", startRequest: "Iniciar pedido" },
  },
  zh: {
    title: "工作流程",
    pageTitle: "工作流程 | MG AutoTech",
    description:
      "了解 MG AutoTech 客户如何提交 ECU/TCU 文件请求、安全上传文件、跟踪状态并在仪表板中接收结果。",
    navLabel: "工作流程",
    eyebrow: "专业客户流程",
    hero: "MG AutoTech 文件服务如何工作",
    intro:
      "安全提交 ECU/TCU 文件请求，在客户面板中跟踪每一个步骤，并通过面向调校技师、维修厂和汽车企业的专业流程接收更新。",
    primaryCta: "创建新请求",
    secondaryCta: "打开仪表板",
    processKicker: "处理流程",
    processTitle: "从创建账户到安全交付。",
    processText:
      "平台将客户、车辆、服务、文件和消息信息关联起来，使每项请求都能得到清晰有序的处理。",
    dashboardKicker: "客户面板优势",
    dashboardTitle: "所有重要信息始终与对应请求关联。",
    securityKicker: "安全与隐私",
    securityTitle: "围绕私密客户流程构建。",
    securityText:
      "客户文件通过私密流程处理。客户只能访问自己的请求，内部管理员备注和处理细节不会显示在客户界面中。",
    audienceKicker: "适用对象",
    audienceTitle: "适合持续文件服务工作的实用平台。",
    faqKicker: "常见问题",
    faqTitle: "常见问题解答",
    finalTitle: "准备提交文件请求了吗？",
    finalText:
      "先填写车辆、服务和文件信息，然后在客户面板中跟踪整个过程。",
    processSteps: [
      { title: "创建账户", text: "创建 MG AutoTech 账户，以访问客户面板、管理请求、查看积分并跟踪已提交的文件。" },
      { title: "选择车辆", text: "在车辆选择器中选择品牌、车型、代系和发动机。如果列表中没有对应车辆，请手动填写车辆信息。" },
      { title: "选择服务", text: "选择所需的文件服务，例如 Stage 1、TCU、VMAX、DTC 请求、Start/Stop 或其他可用服务。" },
      { title: "上传 ECU/TCU 文件", text: "通过安全上传流程提交支持的文件格式。文件会与您的请求关联，不会公开访问。" },
      { title: "审核与处理", text: "MG AutoTech 会审核文件信息、车辆数据、所选服务、付款或积分以及客户备注。" },
      { title: "跟踪状态", text: "在客户面板中查看请求状态、客户可见消息、上传权限和完成进度。" },
      { title: "接收结果", text: "工作完成后，结果会通过安全客户面板或已配置的交付流程提供。" },
    ],
    dashboardBenefits: [
      { title: "安全文件处理", text: "客户上传的文件会关联到正确的请求，不会进入公开下载流程。" },
      { title: "请求状态跟踪", text: "从提交、审核和处理到完成，全程跟踪每项请求。" },
      { title: "客户可见消息", text: "重要更新和问题始终与正确的订单关联。" },
      { title: "积分与付款概览", text: "继续提交请求前，可先查看可用积分和付款状态。" },
      { title: "车辆与服务详情", text: "将所选车辆数据、服务类型和客户备注集中整理在一处。" },
      { title: "追加上传请求", text: "如需另一个文件，MG AutoTech 可以授权受控的追加上传。" },
    ],
    securityItems: [
      "文件通过私密客户流程处理。",
      "客户上传不会使用公开下载链接。",
      "客户只能访问自己的请求。",
      "内部管理员备注和处理细节不会向客户显示。",
      "桌面应用可用时，需要在线验证并登录客户账户。",
    ],
    audiences: [
      "汽车维修厂",
      "专业调校技师",
      "汽车相关企业",
      "经常使用文件服务的客户",
      "需要规范处理 ECU/TCU 请求的客户",
    ],
    faq: [
      { q: "我需要账户吗？", a: "需要。提交请求、上传文件、查看状态和接收结果都需要账户。" },
      { q: "没有 Windows 应用也能使用网站吗？", a: "可以。浏览器客户面板仍然可用。Windows File Upload Assistant 是面向部分测试用户的附加选项。" },
      { q: "支持哪些文件类型？", a: "根据请求类型，支持 .bin、.ori、.mod、.hex、.frf、.sgo 和 .zip 等常见 ECU/TCU 文件格式。" },
      { q: "上传的文件会公开吗？", a: "不会。客户文件通过私密请求流程处理，不会作为公开下载提供。" },
      { q: "如果需要更多信息，会怎样处理？", a: "MG AutoTech 可以通过客户面板联系客户，并要求补充信息或再次上传文件。" },
      { q: "系统会自动修改文件吗？", a: "不会。客户请求会经过 MG AutoTech 的处理与审核流程。该平台用于专业地组织和管理文件服务请求。" },
    ],
    nav: { home: "首页", services: "服务", howItWorks: "工作流程", login: "登录", startRequest: "开始请求" },
  },
  pl: {
    title: "Jak to działa",
    pageTitle: "Jak to działa | MG AutoTech",
    description:
      "Zobacz, jak klienci MG AutoTech tworzą zlecenia ECU/TCU, bezpiecznie przesyłają pliki, śledzą status i odbierają wyniki w panelu.",
    navLabel: "Jak to działa",
    eyebrow: "Profesjonalny proces klienta",
    hero: "Jak działa usługa plików MG AutoTech",
    intro:
      "Bezpiecznie wysyłaj zlecenia dotyczące plików ECU/TCU, śledź każdy etap w panelu i otrzymuj aktualizacje w profesjonalnym procesie przygotowanym dla tunerów, warsztatów i firm motoryzacyjnych.",
    primaryCta: "Utwórz zlecenie",
    secondaryCta: "Otwórz panel",
    processKicker: "Proces",
    processTitle: "Od utworzenia konta do bezpiecznego dostarczenia wyniku.",
    processText:
      "Platforma łączy dane klienta, pojazdu, usługi, pliku i wiadomości, aby każde zlecenie mogło być obsłużone w uporządkowany sposób.",
    dashboardKicker: "Zalety panelu",
    dashboardTitle: "Wszystkie ważne informacje pozostają powiązane ze zleceniem.",
    securityKicker: "Bezpieczeństwo i prywatność",
    securityTitle: "System oparty na prywatnych procesach klienta.",
    securityText:
      "Pliki klientów są obsługiwane w prywatnych procesach. Klient ma dostęp wyłącznie do własnych zleceń, a wewnętrzne notatki administratora i szczegóły realizacji nie są widoczne w panelu klienta.",
    audienceKicker: "Dla kogo",
    audienceTitle: "Praktyczna platforma do regularnych zleceń file service.",
    faqKicker: "FAQ",
    faqTitle: "Najczęstsze pytania",
    finalTitle: "Chcesz wysłać zlecenie dotyczące pliku?",
    finalText:
      "Zacznij od danych pojazdu, usługi i pliku, a następnie śledź wszystko w swoim panelu.",
    processSteps: [
      { title: "Utwórz konto", text: "Utwórz konto MG AutoTech, aby korzystać z panelu, zarządzać zleceniami, sprawdzać kredyty i śledzić przesłane pliki." },
      { title: "Wybierz pojazd", text: "Wybierz markę, model, generację i silnik. Jeśli pojazdu nie ma na liście, podaj jego dane ręcznie." },
      { title: "Wybierz usługę", text: "Wskaż wymaganą usługę, na przykład Stage 1, TCU, VMAX, zlecenie DTC, Start/Stop lub inną dostępną usługę." },
      { title: "Prześlij plik ECU/TCU", text: "Prześlij obsługiwany format przez bezpieczny formularz. Plik zostanie powiązany ze zleceniem i nie będzie dostępny publicznie." },
      { title: "Weryfikacja i realizacja", text: "MG AutoTech sprawdza informacje o pliku, dane pojazdu, wybraną usługę, płatność lub kredyty oraz notatki klienta." },
      { title: "Śledź status", text: "W panelu śledź status zlecenia, wiadomości widoczne dla klienta, uprawnienia do przesyłania plików i postęp realizacji." },
      { title: "Odbierz wynik", text: "Po zakończeniu pracy wynik jest udostępniany w bezpiecznym panelu klienta lub przez skonfigurowany sposób dostarczenia." },
    ],
    dashboardBenefits: [
      { title: "Bezpieczna obsługa plików", text: "Pliki klientów są przypisane do właściwego zlecenia i nie trafiają do publicznych pobrań." },
      { title: "Śledzenie statusu", text: "Śledź każde zlecenie od wysłania, przez weryfikację i realizację, aż do zakończenia." },
      { title: "Wiadomości dla klienta", text: "Ważne aktualizacje i pytania pozostają przypisane do właściwego zamówienia." },
      { title: "Podgląd kredytów i płatności", text: "Sprawdź dostępne kredyty i status płatności przed kontynuowaniem zleceń." },
      { title: "Dane pojazdu i usługi", text: "Przechowuj wybrane dane pojazdu, typ usługi i notatki klienta w jednym uporządkowanym miejscu." },
      { title: "Dodatkowe przesyłanie plików", text: "Jeśli potrzebny jest kolejny plik, MG AutoTech może włączyć kontrolowaną dodatkową wysyłkę." },
    ],
    securityItems: [
      "Pliki są obsługiwane w prywatnych procesach klienta.",
      "Do przesyłania plików przez klientów nie używamy publicznych linków pobierania.",
      "Klienci mają dostęp wyłącznie do własnych zleceń.",
      "Wewnętrzne notatki i szczegóły realizacji nie są widoczne dla klientów.",
      "Gdy aplikacja komputerowa jest dostępna, wymaga weryfikacji online i zalogowania klienta.",
    ],
    audiences: [
      "Warsztaty samochodowe",
      "Profesjonalni tunerzy",
      "Firmy motoryzacyjne",
      "Stali klienci file service",
      "Klienci potrzebujący uporządkowanej obsługi zleceń ECU/TCU",
    ],
    faq: [
      { q: "Czy potrzebuję konta?", a: "Tak. Konto jest wymagane do wysyłania zleceń i plików, sprawdzania statusu oraz odbierania wyników." },
      { q: "Czy mogę korzystać ze strony bez aplikacji Windows?", a: "Tak. Panel w przeglądarce pozostaje dostępny. Windows File Upload Assistant jest dodatkową opcją dla wybranych użytkowników wersji beta." },
      { q: "Jakie typy plików są obsługiwane?", a: "Zależnie od rodzaju zlecenia obsługiwane są popularne formaty ECU/TCU, takie jak .bin, .ori, .mod, .hex, .frf, .sgo i .zip." },
      { q: "Czy przesłane pliki są publiczne?", a: "Nie. Pliki klientów są obsługiwane w prywatnych procesach i nie są udostępniane do publicznego pobierania." },
      { q: "Co się stanie, jeśli potrzebne będą dodatkowe informacje?", a: "MG AutoTech może skontaktować się z klientem przez panel i poprosić o dodatkowe informacje lub kolejny plik." },
      { q: "Czy system automatycznie modyfikuje pliki?", a: "Nie. Zlecenia przechodzą przez proces realizacji i weryfikacji MG AutoTech. Platforma służy do profesjonalnego porządkowania i obsługi zleceń file service." },
    ],
    nav: { home: "Start", services: "Usługi", howItWorks: "Jak to działa", login: "Logowanie", startRequest: "Rozpocznij zlecenie" },
  },
  sq: {
    title: "Si funksionon",
    pageTitle: "Si funksionon | MG AutoTech",
    description:
      "Mësoni si klientët e MG AutoTech krijojnë kërkesa ECU/TCU, ngarkojnë skedarë në mënyrë të sigurt, ndjekin statusin dhe marrin rezultatin në panel.",
    navLabel: "Si funksionon",
    eyebrow: "Proces profesional për klientin",
    hero: "Si funksionon shërbimi i skedarëve MG AutoTech",
    intro:
      "Dërgoni në mënyrë të sigurt kërkesat për skedarë ECU/TCU, ndiqni çdo hap në panel dhe merrni përditësime përmes një procesi profesional të ndërtuar për specialistë tuningu, servise dhe biznese automobilistike.",
    primaryCta: "Krijo kërkesë",
    secondaryCta: "Hap panelin",
    processKicker: "Procesi",
    processTitle: "Nga krijimi i llogarisë deri te dorëzimi i sigurt.",
    processText:
      "Platforma mban të lidhura të dhënat e klientit, automjetit, shërbimit, skedarit dhe mesazheve, që çdo kërkesë të trajtohet në mënyrë të rregullt.",
    dashboardKicker: "Përfitimet e panelit",
    dashboardTitle: "Çdo informacion i rëndësishëm mbetet i lidhur me kërkesën.",
    securityKicker: "Siguria dhe privatësia",
    securityTitle: "Ndërtuar rreth proceseve private të klientit.",
    securityText:
      "Skedarët e klientëve trajtohen përmes proceseve private. Klientët mund të hapin vetëm kërkesat e tyre; shënimet e brendshme të administratorit dhe hollësitë e përpunimit nuk shfaqen në pamjet e klientit.",
    audienceKicker: "Për kë është",
    audienceTitle: "Një platformë praktike për punë të përsëritura të shërbimit të skedarëve.",
    faqKicker: "Pyetje të shpeshta",
    faqTitle: "Pyetje të zakonshme",
    finalTitle: "Gati për të dërguar një kërkesë për skedar?",
    finalText:
      "Filloni me të dhënat e automjetit, shërbimit dhe skedarit, pastaj ndiqni gjithçka në panelin tuaj.",
    processSteps: [
      { title: "Krijoni llogarinë", text: "Krijoni një llogari MG AutoTech për të hapur panelin, menaxhuar kërkesat, parë kreditet dhe ndjekur skedarët e dërguar." },
      { title: "Zgjidhni automjetin", text: "Zgjidhni markën, modelin, gjeneratën dhe motorin. Nëse automjeti nuk është në listë, jepni të dhënat manualisht." },
      { title: "Zgjidhni shërbimin", text: "Zgjidhni shërbimin e nevojshëm, si Stage 1, TCU, VMAX, kërkesë DTC, Start/Stop ose një shërbim tjetër të disponueshëm." },
      { title: "Ngarkoni skedarin ECU/TCU", text: "Ngarkoni një format të mbështetur përmes procesit të sigurt. Skedari lidhet me kërkesën dhe nuk është i qasshëm publikisht." },
      { title: "Kontrolli dhe përpunimi", text: "MG AutoTech kontrollon informacionin e skedarit, të dhënat e automjetit, shërbimin e zgjedhur, pagesën ose kreditet dhe shënimet e klientit." },
      { title: "Ndiqni statusin", text: "Në panel mund të ndiqni statusin, mesazhet e dukshme për klientin, lejet e ngarkimit dhe ecurinë deri në përfundim." },
      { title: "Merrni rezultatin", text: "Kur puna përfundon, rezultati ofrohet përmes panelit të sigurt të klientit ose rrjedhës së përcaktuar të dorëzimit." },
    ],
    dashboardBenefits: [
      { title: "Trajtim i sigurt i skedarëve", text: "Skedarët e klientëve lidhen me kërkesën e duhur dhe mbahen jashtë shkarkimeve publike." },
      { title: "Ndjekja e statusit", text: "Ndiqni çdo kërkesë nga dërgimi, kontrolli dhe përpunimi deri në përfundim." },
      { title: "Mesazhe të dukshme për klientin", text: "Përditësimet dhe pyetjet e rëndësishme mbeten të lidhura me porosinë e duhur." },
      { title: "Pasqyrë e krediteve dhe pagesave", text: "Shikoni kreditet në dispozicion dhe gjendjen e pagesës para se të vazhdoni me kërkesat." },
      { title: "Të dhënat e automjetit dhe shërbimit", text: "Mbani të organizuara në një vend të dhënat e automjetit, llojin e shërbimit dhe shënimet e klientit." },
      { title: "Ngarkime shtesë", text: "Nëse nevojitet një skedar tjetër, MG AutoTech mund të lejojë një ngarkim shtesë të kontrolluar." },
    ],
    securityItems: [
      "Skedarët trajtohen përmes proceseve private të klientit.",
      "Për ngarkimet e klientëve nuk përdoren lidhje publike shkarkimi.",
      "Klientët mund të hapin vetëm kërkesat e tyre.",
      "Shënimet e brendshme dhe hollësitë e përpunimit nuk u shfaqen klientëve.",
      "Kur është i disponueshëm, aplikacioni për kompjuter kërkon verifikim online dhe hyrje të klientit.",
    ],
    audiences: [
      "Servise automobilistike",
      "Specialistë profesionistë tuningu",
      "Biznese automobilistike",
      "Klientë të rregullt të shërbimit të skedarëve",
      "Klientë që kanë nevojë për trajtim të strukturuar të kërkesave ECU/TCU",
    ],
    faq: [
      { q: "A më duhet një llogari?", a: "Po. Llogaria nevojitet për të dërguar kërkesa dhe skedarë, për të parë statusin dhe për të marrë rezultatet." },
      { q: "A mund ta përdor faqen pa aplikacionin Windows?", a: "Po. Paneli në shfletues mbetet i disponueshëm. Windows File Upload Assistant është një mundësi shtesë për përdorues të përzgjedhur beta." },
      { q: "Cilat lloje skedarësh mbështeten?", a: "Në varësi të kërkesës, mbështeten formate të zakonshme ECU/TCU si .bin, .ori, .mod, .hex, .frf, .sgo dhe .zip." },
      { q: "A janë publikë skedarët e ngarkuar?", a: "Jo. Skedarët e klientëve trajtohen në procese private dhe nuk ofrohen si shkarkime publike." },
      { q: "Çfarë ndodh nëse nevojiten më shumë të dhëna?", a: "MG AutoTech mund të kontaktojë klientin përmes panelit dhe të kërkojë informacion ose një ngarkim shtesë." },
      { q: "A i ndryshon sistemi automatikisht skedarët?", a: "Jo. Kërkesat kalojnë në procesin e përpunimit dhe kontrollit të MG AutoTech. Platforma është krijuar për të organizuar dhe menaxhuar në mënyrë profesionale kërkesat e shërbimit të skedarëve." },
    ],
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
