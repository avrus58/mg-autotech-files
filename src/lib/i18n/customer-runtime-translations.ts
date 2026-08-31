import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";

export const customerRuntimeLocaleOrder = [
  "de",
  "tr",
  "nl",
  "fr",
  "it",
  "es",
  "pt",
  "pl",
  "ru",
  "zh",
  "sq",
] as const satisfies readonly Exclude<LocaleCode, "en">[];

type CustomerRuntimeTranslations = Record<
  string,
  readonly [string, string, string, string, string, string, string, string, string, string, string]
>;

/**
 * Exact copy for shared auth and profile controls that update after hydration.
 * Keep dynamic e-mail addresses, telephone values and country option labels out
 * of this catalog; those values are already locale-aware or user supplied.
 */
export const customerRuntimeTranslations = {
  "Country": [
    "Land",
    "Ülke",
    "Land",
    "Pays",
    "Paese",
    "País",
    "País",
    "Kraj",
    "Страна",
    "国家/地区",
    "Shteti",
  ],
  "Detecting your country...": [
    "Ihr Land wird erkannt...",
    "Ülkeniz tespit ediliyor...",
    "Uw land wordt gedetecteerd...",
    "Détection de votre pays...",
    "Rilevamento del tuo Paese...",
    "Detectando su país...",
    "A detetar o seu país...",
    "Wykrywanie kraju...",
    "Определяем вашу страну...",
    "正在检测您的国家/地区...",
    "Po përcaktohet shteti juaj...",
  ],
  "Select your country": [
    "Wählen Sie Ihr Land",
    "Ülkenizi seçin",
    "Selecteer uw land",
    "Sélectionnez votre pays",
    "Seleziona il tuo Paese",
    "Seleccione su país",
    "Selecione o seu país",
    "Wybierz kraj",
    "Выберите вашу страну",
    "请选择您的国家/地区",
    "Zgjidhni shtetin tuaj",
  ],
  "Security verification is temporarily unavailable. Please try again later.": [
    "Die Sicherheitsüberprüfung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",
    "Güvenlik doğrulaması geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
    "De beveiligingscontrole is tijdelijk niet beschikbaar. Probeer het later opnieuw.",
    "La vérification de sécurité est temporairement indisponible. Veuillez réessayer plus tard.",
    "La verifica di sicurezza è temporaneamente indisponibile. Riprova più tardi.",
    "La verificación de seguridad no está disponible temporalmente. Inténtelo de nuevo más tarde.",
    "A verificação de segurança está temporariamente indisponível. Tente novamente mais tarde.",
    "Weryfikacja bezpieczeństwa jest tymczasowo niedostępna. Spróbuj ponownie później.",
    "Проверка безопасности временно недоступна. Повторите попытку позже.",
    "安全验证暂时不可用。请稍后重试。",
    "Verifikimi i sigurisë është përkohësisht i padisponueshëm. Provoni përsëri më vonë.",
  ],
  "Please complete the security verification before continuing.": [
    "Bitte schließen Sie die Sicherheitsüberprüfung ab, bevor Sie fortfahren.",
    "Devam etmeden önce lütfen güvenlik doğrulamasını tamamlayın.",
    "Voltooi de beveiligingscontrole voordat u verdergaat.",
    "Veuillez terminer la vérification de sécurité avant de continuer.",
    "Completa la verifica di sicurezza prima di continuare.",
    "Complete la verificación de seguridad antes de continuar.",
    "Conclua a verificação de segurança antes de continuar.",
    "Przed kontynuowaniem ukończ weryfikację bezpieczeństwa.",
    "Пройдите проверку безопасности, прежде чем продолжить.",
    "请先完成安全验证，然后再继续。",
    "Përfundoni verifikimin e sigurisë përpara se të vazhdoni.",
  ],
  "Phone Number": [
    "Telefonnummer",
    "Telefon numarası",
    "Telefoonnummer",
    "Numéro de téléphone",
    "Numero di telefono",
    "Número de teléfono",
    "Número de telefone",
    "Numer telefonu",
    "Номер телефона",
    "电话号码",
    "Numri i telefonit",
  ],
  "Phone number": [
    "Telefonnummer",
    "Telefon numarası",
    "Telefoonnummer",
    "Numéro de téléphone",
    "Numero di telefono",
    "Número de teléfono",
    "Número de telefone",
    "Numer telefonu",
    "Номер телефона",
    "电话号码",
    "Numri i telefonit",
  ],
  "Country calling code": [
    "Ländervorwahl",
    "Ülke telefon kodu",
    "Landnummer",
    "Indicatif téléphonique du pays",
    "Prefisso internazionale",
    "Prefijo telefónico del país",
    "Indicativo telefónico do país",
    "Numer kierunkowy kraju",
    "Телефонный код страны",
    "国家/地区电话区号",
    "Kodi telefonik i shtetit",
  ],
  "Select a country calling code": [
    "Ländervorwahl auswählen",
    "Ülke telefon kodunu seçin",
    "Kies een landnummer",
    "Sélectionnez un indicatif téléphonique",
    "Seleziona un prefisso internazionale",
    "Seleccione un prefijo telefónico",
    "Selecione um indicativo telefónico",
    "Wybierz numer kierunkowy kraju",
    "Выберите телефонный код страны",
    "选择国家/地区电话区号",
    "Zgjidhni kodin telefonik të shtetit",
  ],
  "Mobile or landline": [
    "Mobil- oder Festnetznummer",
    "Cep veya sabit telefon",
    "Mobiel of vast nummer",
    "Mobile ou téléphone fixe",
    "Cellulare o rete fissa",
    "Móvil o teléfono fijo",
    "Telemóvel ou telefone fixo",
    "Telefon komórkowy lub stacjonarny",
    "Мобильный или стационарный номер",
    "手机或固定电话号码",
    "Celular ose telefon fiks",
  ],
  "Calling code starts from your country. Enter the local number; special carrier plans may require the full + number.": [
    "Die Vorwahl wird anhand Ihres Landes gewählt. Geben Sie die lokale Nummer ein; besondere Tarife können die vollständige Nummer mit + erfordern.",
    "Telefon kodu ülkenize göre seçilir. Yerel numarayı girin; özel operatör tarifelerinde + ile başlayan tam numara gerekebilir.",
    "De landcode wordt op basis van uw land gekozen. Voer het lokale nummer in; bij speciale providers kan het volledige nummer met + nodig zijn.",
    "L’indicatif est choisi selon votre pays. Saisissez le numéro local ; certains opérateurs peuvent exiger le numéro complet avec +.",
    "Il prefisso viene scelto in base al paese. Inserisci il numero locale; alcuni operatori possono richiedere il numero completo con +.",
    "El prefijo se elige según su país. Introduzca el número local; algunos operadores pueden requerir el número completo con +.",
    "O indicativo é escolhido de acordo com o país. Introduza o número local; alguns operadores podem exigir o número completo com +.",
    "Numer kierunkowy jest wybierany na podstawie kraju. Wpisz numer lokalny; niektórzy operatorzy mogą wymagać pełnego numeru z +.",
    "Код выбирается по вашей стране. Введите местный номер; для некоторых операторов может потребоваться полный номер с +.",
    "区号会根据您的国家/地区选择。请输入本地号码；某些运营商可能要求填写带 + 的完整号码。",
    "Kodi zgjidhet sipas shtetit tuaj. Shkruani numrin lokal; disa operatorë mund të kërkojnë numrin e plotë me +.",
  ],
  "Google sign-in": [
    "Google-Anmeldung",
    "Google ile giriş",
    "Inloggen met Google",
    "Connexion avec Google",
    "Accesso con Google",
    "Inicio de sesión con Google",
    "Início de sessão com Google",
    "Logowanie przez Google",
    "Вход через Google",
    "Google 登录",
    "Hyrje me Google",
  ],
  "Retry Google sign-in": [
    "Google-Anmeldung erneut versuchen",
    "Google ile girişi yeniden deneyin",
    "Opnieuw inloggen met Google",
    "Réessayer la connexion avec Google",
    "Riprova l’accesso con Google",
    "Reintentar el inicio de sesión con Google",
    "Tentar novamente o início de sessão com Google",
    "Ponów logowanie przez Google",
    "Повторить вход через Google",
    "重试 Google 登录",
    "Provo përsëri hyrjen me Google",
  ],
  "Opening Google sign-in...": [
    "Google-Anmeldung wird geöffnet …",
    "Google girişi açılıyor...",
    "Google-login wordt geopend...",
    "Ouverture de la connexion Google…",
    "Apertura dell’accesso Google…",
    "Abriendo el inicio de sesión de Google…",
    "A abrir o início de sessão do Google…",
    "Otwieranie logowania Google…",
    "Открывается вход через Google…",
    "正在打开 Google 登录…",
    "Po hapet hyrja me Google…",
  ],
  "Google sign-in is unavailable. Use e-mail or try again.": [
    "Die Google-Anmeldung ist nicht verfügbar. Verwenden Sie E-Mail oder versuchen Sie es erneut.",
    "Google ile giriş kullanılamıyor. E-posta kullanın veya yeniden deneyin.",
    "Inloggen met Google is niet beschikbaar. Gebruik e-mail of probeer het opnieuw.",
    "La connexion Google est indisponible. Utilisez l’e-mail ou réessayez.",
    "L’accesso con Google non è disponibile. Usa l’e-mail o riprova.",
    "El inicio de sesión con Google no está disponible. Use el correo electrónico o inténtelo de nuevo.",
    "O início de sessão com Google não está disponível. Use o e-mail ou tente novamente.",
    "Logowanie przez Google jest niedostępne. Użyj e-maila lub spróbuj ponownie.",
    "Вход через Google недоступен. Используйте e-mail или повторите попытку.",
    "Google 登录暂不可用。请使用电子邮件或重试。",
    "Hyrja me Google nuk është e disponueshme. Përdorni e-mailin ose provoni përsëri.",
  ],
  "Loading secure Google sign-in...": [
    "Sichere Google-Anmeldung wird geladen …",
    "Güvenli Google girişi yükleniyor...",
    "Beveiligde Google-login wordt geladen...",
    "Chargement de la connexion Google sécurisée…",
    "Caricamento dell’accesso Google sicuro…",
    "Cargando el inicio de sesión seguro de Google…",
    "A carregar o início de sessão seguro do Google…",
    "Ładowanie bezpiecznego logowania Google…",
    "Загружается безопасный вход через Google…",
    "正在加载安全的 Google 登录…",
    "Po ngarkohet hyrja e sigurt me Google…",
  ],
  "Complete the security verification to continue with Google.": [
    "Schließen Sie die Sicherheitsprüfung ab, um mit Google fortzufahren.",
    "Google ile devam etmek için güvenlik doğrulamasını tamamlayın.",
    "Voltooi de beveiligingscontrole om door te gaan met Google.",
    "Terminez la vérification de sécurité pour continuer avec Google.",
    "Completa la verifica di sicurezza per continuare con Google.",
    "Complete la verificación de seguridad para continuar con Google.",
    "Conclua a verificação de segurança para continuar com Google.",
    "Ukończ weryfikację bezpieczeństwa, aby kontynuować przez Google.",
    "Пройдите проверку безопасности, чтобы продолжить через Google.",
    "完成安全验证后即可继续使用 Google。",
    "Përfundoni verifikimin e sigurisë për të vazhduar me Google.",
  ],
  "Retry security verification": [
    "Sicherheitsprüfung erneut versuchen",
    "Güvenlik doğrulamasını yeniden deneyin",
    "Beveiligingscontrole opnieuw proberen",
    "Réessayer la vérification de sécurité",
    "Riprova la verifica di sicurezza",
    "Reintentar la verificación de seguridad",
    "Tentar novamente a verificação de segurança",
    "Ponów weryfikację bezpieczeństwa",
    "Повторить проверку безопасности",
    "重试安全验证",
    "Provo përsëri verifikimin e sigurisë",
  ],
  "Checking secure session...": [
    "Sichere Sitzung wird geprüft …",
    "Güvenli oturum kontrol ediliyor...",
    "Beveiligde sessie wordt gecontroleerd...",
    "Vérification de la session sécurisée…",
    "Verifica della sessione sicura…",
    "Comprobando la sesión segura…",
    "A verificar a sessão segura…",
    "Sprawdzanie bezpiecznej sesji…",
    "Проверяется защищённая сессия…",
    "正在检查安全会话…",
    "Po kontrollohet sesioni i sigurt…",
  ],
  "Restoring secure session...": [
    "Sichere Sitzung wird wiederhergestellt …",
    "Güvenli oturum geri yükleniyor...",
    "Beveiligde sessie wordt hersteld...",
    "Restauration de la session sécurisée…",
    "Ripristino della sessione sicura…",
    "Restaurando la sesión segura…",
    "A restaurar a sessão segura…",
    "Przywracanie bezpiecznej sesji…",
    "Восстанавливается защищённая сессия…",
    "正在恢复安全会话…",
    "Po rikthehet sesioni i sigurt…",
  ],
  "Verifying customer access...": [
    "Kundenzugriff wird geprüft …",
    "Müşteri erişimi doğrulanıyor...",
    "Klanttoegang wordt gecontroleerd...",
    "Vérification de l’accès client…",
    "Verifica dell’accesso cliente…",
    "Verificando el acceso del cliente…",
    "A verificar o acesso do cliente…",
    "Weryfikowanie dostępu klienta…",
    "Проверяется доступ клиента…",
    "正在验证客户访问权限…",
    "Po verifikohet qasja e klientit…",
  ],
  "Customer verification is taking longer": [
    "Die Kundenprüfung dauert länger",
    "Müşteri doğrulaması beklenenden uzun sürüyor",
    "Klantverificatie duurt langer",
    "La vérification du client prend plus de temps",
    "La verifica del cliente richiede più tempo",
    "La verificación del cliente está tardando más",
    "A verificação do cliente está a demorar mais",
    "Weryfikacja klienta trwa dłużej",
    "Проверка клиента занимает больше времени",
    "客户验证耗时较长",
    "Verifikimi i klientit po zgjat më shumë",
  ],
  "Your account remains protected. Check your connection and try the secure session check again.": [
    "Ihr Konto bleibt geschützt. Prüfen Sie Ihre Verbindung und starten Sie die sichere Sitzungsprüfung erneut.",
    "Hesabınız korunmaya devam ediyor. Bağlantınızı kontrol edin ve güvenli oturum kontrolünü yeniden deneyin.",
    "Uw account blijft beveiligd. Controleer uw verbinding en probeer de beveiligde sessiecontrole opnieuw.",
    "Votre compte reste protégé. Vérifiez votre connexion et relancez le contrôle de session sécurisé.",
    "Il tuo account resta protetto. Controlla la connessione e riprova la verifica della sessione sicura.",
    "Su cuenta sigue protegida. Compruebe la conexión y repita la verificación de la sesión segura.",
    "A sua conta continua protegida. Verifique a ligação e repita a verificação da sessão segura.",
    "Twoje konto pozostaje chronione. Sprawdź połączenie i ponów kontrolę bezpiecznej sesji.",
    "Ваша учётная запись остаётся защищённой. Проверьте соединение и повторите проверку безопасной сессии.",
    "您的账户仍受保护。请检查网络连接，然后重试安全会话检查。",
    "Llogaria juaj mbetet e mbrojtur. Kontrolloni lidhjen dhe provoni përsëri kontrollin e sesionit të sigurt.",
  ],
  "Back": [
    "Zurück",
    "Geri",
    "Terug",
    "Retour",
    "Indietro",
    "Atrás",
    "Voltar",
    "Wstecz",
    "Назад",
    "返回",
    "Prapa",
  ],
  "Customer type": [
    "Kundentyp",
    "Müşteri tipi",
    "Klanttype",
    "Type de client",
    "Tipo di cliente",
    "Tipo de cliente",
    "Tipo de cliente",
    "Typ klienta",
    "Тип клиента",
    "客户类型",
    "Lloji i klientit",
  ],
  "E-mail & password": [
    "E-Mail und Passwort",
    "E-posta ve şifre",
    "E-mail en wachtwoord",
    "E-mail et mot de passe",
    "E-mail e password",
    "Correo electrónico y contraseña",
    "E-mail e palavra-passe",
    "E-mail i hasło",
    "E-mail и пароль",
    "电子邮箱和密码",
    "E-mail dhe fjalëkalimi",
  ],
  "Start your file service account": [
    "File-Service-Konto erstellen",
    "Dosya servisi hesabınızı oluşturun",
    "Maak uw file-serviceaccount aan",
    "Créez votre compte de service de fichiers",
    "Crea il tuo account per il servizio file",
    "Cree su cuenta del servicio de archivos",
    "Crie a sua conta de serviço de ficheiros",
    "Utwórz konto w usłudze plikowej",
    "Создайте аккаунт файлового сервиса",
    "创建您的文件服务账户",
    "Krijoni llogarinë tuaj për shërbimin e skedarëve",
  ],
  "Private Customer": [
    "Privatkunde",
    "Bireysel müşteri",
    "Particuliere klant",
    "Client particulier",
    "Cliente privato",
    "Cliente particular",
    "Cliente particular",
    "Klient indywidualny",
    "Частный клиент",
    "个人客户",
    "Klient privat",
  ],
  "E-mail verification is required before the customer dashboard can be used.": [
    "Vor der Nutzung des Kundenportals muss die E-Mail-Adresse bestätigt werden.",
    "Müşteri panelini kullanmadan önce e-posta doğrulaması gereklidir.",
    "E-mailverificatie is vereist voordat het klantportaal kan worden gebruikt.",
    "L’adresse e-mail doit être vérifiée avant de pouvoir utiliser le portail client.",
    "È necessario verificare l’e-mail prima di utilizzare il portale cliente.",
    "Es necesario verificar el correo electrónico antes de utilizar el panel del cliente.",
    "É necessário verificar o e-mail antes de utilizar o painel do cliente.",
    "Przed rozpoczęciem korzystania z panelu klienta należy zweryfikować adres e-mail.",
    "Перед использованием панели клиента необходимо подтвердить адрес электронной почты.",
    "使用客户面板前必须先验证电子邮箱。",
    "Kërkohet verifikimi i e-mailit përpara se të përdorni panelin e klientit.",
  ],
  "Account Setup": [
    "Kontoeinrichtung",
    "Hesap kurulumu",
    "Account instellen",
    "Configuration du compte",
    "Configurazione dell’account",
    "Configuración de la cuenta",
    "Configuração da conta",
    "Konfiguracja konta",
    "Настройка аккаунта",
    "账户设置",
    "Konfigurimi i llogarisë",
  ],
  "Login Details": [
    "Anmeldedaten",
    "Giriş bilgileri",
    "Inloggegevens",
    "Identifiants de connexion",
    "Dati di accesso",
    "Datos de acceso",
    "Dados de acesso",
    "Dane logowania",
    "Данные для входа",
    "登录信息",
    "Të dhënat e hyrjes",
  ],
  "Company details stay attached to requests for cleaner workshop administration.": [
    "Firmendaten bleiben für eine übersichtliche Werkstattverwaltung mit den Anfragen verknüpft.",
    "Firma bilgileri, daha düzenli servis yönetimi için taleplere bağlı kalır.",
    "Bedrijfsgegevens blijven aan aanvragen gekoppeld voor een overzichtelijkere werkplaatsadministratie.",
    "Les informations de l’entreprise restent liées aux demandes afin de simplifier la gestion de l’atelier.",
    "I dati aziendali restano collegati alle richieste per una gestione più ordinata dell’officina.",
    "Los datos de la empresa permanecen vinculados a las solicitudes para facilitar la gestión del taller.",
    "Os dados da empresa permanecem associados aos pedidos para facilitar a gestão da oficina.",
    "Dane firmy pozostają powiązane ze zleceniami, co ułatwia zarządzanie warsztatem.",
    "Данные компании остаются связанными с заявками для более удобного управления мастерской.",
    "公司信息会与请求保持关联，便于维修厂进行规范管理。",
    "Të dhënat e kompanisë mbeten të lidhura me kërkesat për administrim më të rregullt të servisit.",
  ],
  "Invoice details can be completed now or later in account settings.": [
    "Rechnungsdaten können jetzt oder später in den Kontoeinstellungen ergänzt werden.",
    "Fatura bilgileri şimdi veya daha sonra hesap ayarlarından tamamlanabilir.",
    "Factuurgegevens kunnen nu of later in de accountinstellingen worden aangevuld.",
    "Les informations de facturation peuvent être complétées maintenant ou plus tard dans les paramètres du compte.",
    "I dati di fatturazione possono essere completati ora o in seguito nelle impostazioni dell’account.",
    "Los datos de facturación pueden completarse ahora o más adelante en los ajustes de la cuenta.",
    "Os dados de faturação podem ser preenchidos agora ou mais tarde nas definições da conta.",
    "Dane do faktury można uzupełnić teraz lub później w ustawieniach konta.",
    "Данные для выставления счёта можно заполнить сейчас или позже в настройках аккаунта.",
    "发票信息可现在填写，也可稍后在账户设置中补充。",
    "Të dhënat e faturimit mund të plotësohen tani ose më vonë te cilësimet e llogarisë.",
  ],
  "Account summary": [
    "Kontoübersicht",
    "Hesap özeti",
    "Accountoverzicht",
    "Récapitulatif du compte",
    "Riepilogo dell’account",
    "Resumen de la cuenta",
    "Resumo da conta",
    "Podsumowanie konta",
    "Сводка аккаунта",
    "账户摘要",
    "Përmbledhja e llogarisë",
  ],
} as const satisfies CustomerRuntimeTranslations;

export function customerRuntimeExactT(locale: LocaleCode, source: string) {
  if (locale === "en") return source;
  const localeIndex = customerRuntimeLocaleOrder.indexOf(locale);
  if (localeIndex < 0) return source;
  return (customerRuntimeTranslations as CustomerRuntimeTranslations)[source]?.[
    localeIndex
  ] ?? source;
}

type CustomerOrderStatus =
  | "new_request"
  | "file_check"
  | "customer_info_needed"
  | "in_progress"
  | "completed"
  | "revision"
  | "cancelled";

type CreditTransactionType =
  | "purchase"
  | "refund"
  | "admin_topup"
  | "admin_adjustment"
  | "usage";

type FileExpertStatusLabel = "pending" | "processing" | "completed" | "failed";
type FileExpertRiskLabel = "low" | "medium" | "high" | "unknown";
type FileExpertDetectionLabel = "detected" | "probable" | "possible" | "not_detected";
type FileExpertReadinessLabel = "weak" | "usable" | "strong" | "mature" | "none";
type PluralForms = { one: string; other: string; few?: string; many?: string };

type CustomerDynamicCopy = {
  orderStatuses: Record<CustomerOrderStatus, string>;
  statusUnavailable: string;
  creditTransactionTypes: Record<CreditTransactionType, string>;
  creditTransactionFallback: string;
  fileExpertStatuses: Record<FileExpertStatusLabel, string>;
  fileExpertRisks: Record<FileExpertRiskLabel, string>;
  fileExpertDetections: Record<FileExpertDetectionLabel, string>;
  fileExpertReadiness: Record<FileExpertReadinessLabel, string>;
  reviewTemplate: string;
  messageCount: PluralForms;
  newMessageCount: PluralForms;
  jobCount: PluralForms;
};

const customerDynamicCopy = {
  en: {
    orderStatuses: { new_request: "New Request", file_check: "File Check", customer_info_needed: "Customer Info Needed", in_progress: "In Progress", completed: "Completed", revision: "Revision", cancelled: "Cancelled" },
    statusUnavailable: "Status unavailable",
    creditTransactionTypes: { purchase: "Purchase", refund: "Refund", admin_topup: "Manual credit top-up", admin_adjustment: "Credit adjustment", usage: "Credit usage" },
    creditTransactionFallback: "Credit transaction",
    fileExpertStatuses: { pending: "Pending", processing: "Processing", completed: "Completed", failed: "Failed" },
    fileExpertRisks: { low: "Low", medium: "Medium", high: "High", unknown: "Unknown" },
    fileExpertDetections: { detected: "Detected", probable: "Probable", possible: "Possible", not_detected: "Not detected" },
    fileExpertReadiness: { weak: "Weak", usable: "Usable", strong: "Strong", mature: "Mature", none: "No evidence" },
    reviewTemplate: "Review: {risk}",
    messageCount: { one: "{count} message", other: "{count} messages" },
    newMessageCount: { one: "{count} new message", other: "{count} new messages" },
    jobCount: { one: "{count} analysis", other: "{count} analyses" },
  },
  de: {
    orderStatuses: { new_request: "Neue Anfrage", file_check: "Dateiprüfung", customer_info_needed: "Kundenangaben erforderlich", in_progress: "In Bearbeitung", completed: "Abgeschlossen", revision: "Revision", cancelled: "Storniert" },
    statusUnavailable: "Status nicht verfügbar",
    creditTransactionTypes: { purchase: "Kauf", refund: "Erstattung", admin_topup: "Manuelle Credit-Aufladung", admin_adjustment: "Credit-Korrektur", usage: "Credit-Verbrauch" },
    creditTransactionFallback: "Credit-Transaktion",
    fileExpertStatuses: { pending: "Ausstehend", processing: "In Bearbeitung", completed: "Abgeschlossen", failed: "Fehlgeschlagen" },
    fileExpertRisks: { low: "Niedrig", medium: "Mittel", high: "Hoch", unknown: "Unbekannt" },
    fileExpertDetections: { detected: "Erkannt", probable: "Wahrscheinlich", possible: "Möglich", not_detected: "Nicht erkannt" },
    fileExpertReadiness: { weak: "Schwach", usable: "Verwendbar", strong: "Stark", mature: "Ausgereift", none: "Keine Nachweise" },
    reviewTemplate: "Prüfung: {risk}",
    messageCount: { one: "{count} Nachricht", other: "{count} Nachrichten" },
    newMessageCount: { one: "{count} neue Nachricht", other: "{count} neue Nachrichten" },
    jobCount: { one: "{count} Analyse", other: "{count} Analysen" },
  },
  tr: {
    orderStatuses: { new_request: "Yeni talep", file_check: "Dosya kontrolü", customer_info_needed: "Müşteri bilgisi gerekli", in_progress: "İşlemde", completed: "Tamamlandı", revision: "Revizyon", cancelled: "İptal edildi" },
    statusUnavailable: "Durum bilgisi yok",
    creditTransactionTypes: { purchase: "Satın alım", refund: "İade", admin_topup: "Manuel kredi yüklemesi", admin_adjustment: "Kredi düzeltmesi", usage: "Kredi kullanımı" },
    creditTransactionFallback: "Kredi işlemi",
    fileExpertStatuses: { pending: "Beklemede", processing: "İşleniyor", completed: "Tamamlandı", failed: "Başarısız" },
    fileExpertRisks: { low: "Düşük", medium: "Orta", high: "Yüksek", unknown: "Bilinmiyor" },
    fileExpertDetections: { detected: "Tespit edildi", probable: "Muhtemel", possible: "Olası", not_detected: "Tespit edilmedi" },
    fileExpertReadiness: { weak: "Zayıf", usable: "Kullanılabilir", strong: "Güçlü", mature: "Olgun", none: "Kanıt yok" },
    reviewTemplate: "İnceleme: {risk}",
    messageCount: { one: "{count} mesaj", other: "{count} mesaj" },
    newMessageCount: { one: "{count} yeni mesaj", other: "{count} yeni mesaj" },
    jobCount: { one: "{count} analiz", other: "{count} analiz" },
  },
  nl: {
    orderStatuses: { new_request: "Nieuwe aanvraag", file_check: "Bestandscontrole", customer_info_needed: "Klantgegevens nodig", in_progress: "In behandeling", completed: "Voltooid", revision: "Revisie", cancelled: "Geannuleerd" },
    statusUnavailable: "Status niet beschikbaar",
    creditTransactionTypes: { purchase: "Aankoop", refund: "Terugbetaling", admin_topup: "Handmatige creditopwaardering", admin_adjustment: "Creditcorrectie", usage: "Creditverbruik" },
    creditTransactionFallback: "Credittransactie",
    fileExpertStatuses: { pending: "In afwachting", processing: "In behandeling", completed: "Voltooid", failed: "Mislukt" },
    fileExpertRisks: { low: "Laag", medium: "Gemiddeld", high: "Hoog", unknown: "Onbekend" },
    fileExpertDetections: { detected: "Gedetecteerd", probable: "Waarschijnlijk", possible: "Mogelijk", not_detected: "Niet gedetecteerd" },
    fileExpertReadiness: { weak: "Zwak", usable: "Bruikbaar", strong: "Sterk", mature: "Volwassen", none: "Geen bewijs" },
    reviewTemplate: "Beoordeling: {risk}",
    messageCount: { one: "{count} bericht", other: "{count} berichten" },
    newMessageCount: { one: "{count} nieuw bericht", other: "{count} nieuwe berichten" },
    jobCount: { one: "{count} analyse", other: "{count} analyses" },
  },
  fr: {
    orderStatuses: { new_request: "Nouvelle demande", file_check: "Vérification du fichier", customer_info_needed: "Informations client requises", in_progress: "En cours", completed: "Terminé", revision: "Révision", cancelled: "Annulé" },
    statusUnavailable: "Statut indisponible",
    creditTransactionTypes: { purchase: "Achat", refund: "Remboursement", admin_topup: "Ajout manuel de crédits", admin_adjustment: "Ajustement de crédits", usage: "Utilisation des crédits" },
    creditTransactionFallback: "Opération de crédits",
    fileExpertStatuses: { pending: "En attente", processing: "En cours", completed: "Terminé", failed: "Échec" },
    fileExpertRisks: { low: "Faible", medium: "Moyen", high: "Élevé", unknown: "Inconnu" },
    fileExpertDetections: { detected: "Détecté", probable: "Probable", possible: "Possible", not_detected: "Non détecté" },
    fileExpertReadiness: { weak: "Faible", usable: "Exploitable", strong: "Fort", mature: "Abouti", none: "Aucun élément" },
    reviewTemplate: "Examen : {risk}",
    messageCount: { one: "{count} message", other: "{count} messages" },
    newMessageCount: { one: "{count} nouveau message", other: "{count} nouveaux messages" },
    jobCount: { one: "{count} analyse", other: "{count} analyses" },
  },
  it: {
    orderStatuses: { new_request: "Nuova richiesta", file_check: "Verifica file", customer_info_needed: "Informazioni cliente richieste", in_progress: "In lavorazione", completed: "Completato", revision: "Revisione", cancelled: "Annullato" },
    statusUnavailable: "Stato non disponibile",
    creditTransactionTypes: { purchase: "Acquisto", refund: "Rimborso", admin_topup: "Ricarica manuale crediti", admin_adjustment: "Rettifica crediti", usage: "Utilizzo crediti" },
    creditTransactionFallback: "Movimento crediti",
    fileExpertStatuses: { pending: "In attesa", processing: "In lavorazione", completed: "Completato", failed: "Non riuscito" },
    fileExpertRisks: { low: "Basso", medium: "Medio", high: "Alto", unknown: "Sconosciuto" },
    fileExpertDetections: { detected: "Rilevato", probable: "Probabile", possible: "Possibile", not_detected: "Non rilevato" },
    fileExpertReadiness: { weak: "Debole", usable: "Utilizzabile", strong: "Forte", mature: "Maturo", none: "Nessuna evidenza" },
    reviewTemplate: "Revisione: {risk}",
    messageCount: { one: "{count} messaggio", other: "{count} messaggi" },
    newMessageCount: { one: "{count} nuovo messaggio", other: "{count} nuovi messaggi" },
    jobCount: { one: "{count} analisi", other: "{count} analisi" },
  },
  es: {
    orderStatuses: { new_request: "Nueva solicitud", file_check: "Revisión del archivo", customer_info_needed: "Se requiere información del cliente", in_progress: "En curso", completed: "Completado", revision: "Revisión", cancelled: "Cancelado" },
    statusUnavailable: "Estado no disponible",
    creditTransactionTypes: { purchase: "Compra", refund: "Reembolso", admin_topup: "Recarga manual de créditos", admin_adjustment: "Ajuste de créditos", usage: "Uso de créditos" },
    creditTransactionFallback: "Movimiento de créditos",
    fileExpertStatuses: { pending: "Pendiente", processing: "En proceso", completed: "Completado", failed: "Fallido" },
    fileExpertRisks: { low: "Bajo", medium: "Medio", high: "Alto", unknown: "Desconocido" },
    fileExpertDetections: { detected: "Detectado", probable: "Probable", possible: "Posible", not_detected: "No detectado" },
    fileExpertReadiness: { weak: "Débil", usable: "Utilizable", strong: "Fuerte", mature: "Maduro", none: "Sin evidencia" },
    reviewTemplate: "Revisión: {risk}",
    messageCount: { one: "{count} mensaje", other: "{count} mensajes" },
    newMessageCount: { one: "{count} mensaje nuevo", other: "{count} mensajes nuevos" },
    jobCount: { one: "{count} análisis", other: "{count} análisis" },
  },
  pt: {
    orderStatuses: { new_request: "Novo pedido", file_check: "Verificação do ficheiro", customer_info_needed: "Informações do cliente necessárias", in_progress: "Em curso", completed: "Concluído", revision: "Revisão", cancelled: "Cancelado" },
    statusUnavailable: "Estado indisponível",
    creditTransactionTypes: { purchase: "Compra", refund: "Reembolso", admin_topup: "Carregamento manual de créditos", admin_adjustment: "Ajuste de créditos", usage: "Utilização de créditos" },
    creditTransactionFallback: "Movimento de créditos",
    fileExpertStatuses: { pending: "Pendente", processing: "Em processamento", completed: "Concluído", failed: "Falhou" },
    fileExpertRisks: { low: "Baixo", medium: "Médio", high: "Alto", unknown: "Desconhecido" },
    fileExpertDetections: { detected: "Detetado", probable: "Provável", possible: "Possível", not_detected: "Não detetado" },
    fileExpertReadiness: { weak: "Fraco", usable: "Utilizável", strong: "Forte", mature: "Maduro", none: "Sem evidência" },
    reviewTemplate: "Revisão: {risk}",
    messageCount: { one: "{count} mensagem", other: "{count} mensagens" },
    newMessageCount: { one: "{count} nova mensagem", other: "{count} novas mensagens" },
    jobCount: { one: "{count} análise", other: "{count} análises" },
  },
  pl: {
    orderStatuses: { new_request: "Nowe zlecenie", file_check: "Weryfikacja pliku", customer_info_needed: "Wymagane dane klienta", in_progress: "W realizacji", completed: "Zakończone", revision: "Korekta", cancelled: "Anulowane" },
    statusUnavailable: "Status niedostępny",
    creditTransactionTypes: { purchase: "Zakup", refund: "Zwrot", admin_topup: "Ręczne doładowanie kredytów", admin_adjustment: "Korekta kredytów", usage: "Wykorzystanie kredytów" },
    creditTransactionFallback: "Operacja kredytowa",
    fileExpertStatuses: { pending: "Oczekuje", processing: "Przetwarzanie", completed: "Zakończono", failed: "Niepowodzenie" },
    fileExpertRisks: { low: "Niskie", medium: "Średnie", high: "Wysokie", unknown: "Nieznane" },
    fileExpertDetections: { detected: "Wykryto", probable: "Prawdopodobne", possible: "Możliwe", not_detected: "Nie wykryto" },
    fileExpertReadiness: { weak: "Słaba", usable: "Użyteczna", strong: "Silna", mature: "Dojrzała", none: "Brak dowodów" },
    reviewTemplate: "Weryfikacja: {risk}",
    messageCount: { one: "{count} wiadomość", few: "{count} wiadomości", many: "{count} wiadomości", other: "{count} wiadomości" },
    newMessageCount: { one: "{count} nowa wiadomość", few: "{count} nowe wiadomości", many: "{count} nowych wiadomości", other: "{count} nowych wiadomości" },
    jobCount: { one: "{count} analiza", few: "{count} analizy", many: "{count} analiz", other: "{count} analizy" },
  },
  ru: {
    orderStatuses: { new_request: "Новая заявка", file_check: "Проверка файла", customer_info_needed: "Требуются данные клиента", in_progress: "В работе", completed: "Завершено", revision: "Доработка", cancelled: "Отменено" },
    statusUnavailable: "Статус недоступен",
    creditTransactionTypes: { purchase: "Покупка", refund: "Возврат", admin_topup: "Ручное пополнение кредитов", admin_adjustment: "Корректировка кредитов", usage: "Списание кредитов" },
    creditTransactionFallback: "Операция с кредитами",
    fileExpertStatuses: { pending: "Ожидает", processing: "Обрабатывается", completed: "Завершено", failed: "Ошибка" },
    fileExpertRisks: { low: "Низкий", medium: "Средний", high: "Высокий", unknown: "Неизвестно" },
    fileExpertDetections: { detected: "Обнаружено", probable: "Вероятно", possible: "Возможно", not_detected: "Не обнаружено" },
    fileExpertReadiness: { weak: "Слабая", usable: "Пригодная", strong: "Сильная", mature: "Зрелая", none: "Нет данных" },
    reviewTemplate: "Проверка: {risk}",
    messageCount: { one: "{count} сообщение", few: "{count} сообщения", many: "{count} сообщений", other: "{count} сообщения" },
    newMessageCount: { one: "{count} новое сообщение", few: "{count} новых сообщения", many: "{count} новых сообщений", other: "{count} новых сообщения" },
    jobCount: { one: "{count} анализ", few: "{count} анализа", many: "{count} анализов", other: "{count} анализа" },
  },
  zh: {
    orderStatuses: { new_request: "新请求", file_check: "文件检查", customer_info_needed: "需要客户信息", in_progress: "处理中", completed: "已完成", revision: "修订", cancelled: "已取消" },
    statusUnavailable: "状态不可用",
    creditTransactionTypes: { purchase: "购买", refund: "退款", admin_topup: "人工充值额度", admin_adjustment: "额度调整", usage: "额度使用" },
    creditTransactionFallback: "额度交易",
    fileExpertStatuses: { pending: "待处理", processing: "处理中", completed: "已完成", failed: "失败" },
    fileExpertRisks: { low: "低", medium: "中", high: "高", unknown: "未知" },
    fileExpertDetections: { detected: "已检测", probable: "很可能", possible: "可能", not_detected: "未检测到" },
    fileExpertReadiness: { weak: "弱", usable: "可用", strong: "强", mature: "成熟", none: "无证据" },
    reviewTemplate: "审核：{risk}",
    messageCount: { one: "{count} 条消息", other: "{count} 条消息" },
    newMessageCount: { one: "{count} 条新消息", other: "{count} 条新消息" },
    jobCount: { one: "{count} 项分析", other: "{count} 项分析" },
  },
  sq: {
    orderStatuses: { new_request: "Kërkesë e re", file_check: "Kontrolli i skedarit", customer_info_needed: "Kërkohen të dhënat e klientit", in_progress: "Në proces", completed: "Përfunduar", revision: "Rishikim", cancelled: "Anuluar" },
    statusUnavailable: "Gjendja nuk është e disponueshme",
    creditTransactionTypes: { purchase: "Blerje", refund: "Rimbursim", admin_topup: "Ngarkim manual kreditesh", admin_adjustment: "Rregullim kreditesh", usage: "Përdorim kreditesh" },
    creditTransactionFallback: "Transaksion kreditesh",
    fileExpertStatuses: { pending: "Në pritje", processing: "Në përpunim", completed: "Përfunduar", failed: "Dështoi" },
    fileExpertRisks: { low: "I ulët", medium: "Mesatar", high: "I lartë", unknown: "I panjohur" },
    fileExpertDetections: { detected: "U zbulua", probable: "I mundshëm", possible: "I mundur", not_detected: "Nuk u zbulua" },
    fileExpertReadiness: { weak: "E dobët", usable: "E përdorshme", strong: "E fortë", mature: "E pjekur", none: "Pa prova" },
    reviewTemplate: "Shqyrtim: {risk}",
    messageCount: { one: "{count} mesazh", other: "{count} mesazhe" },
    newMessageCount: { one: "{count} mesazh i ri", other: "{count} mesazhe të reja" },
    jobCount: { one: "{count} analizë", other: "{count} analiza" },
  },
} as const satisfies Record<LocaleCode, CustomerDynamicCopy>;

const customerOrderStatusAliases: Record<string, CustomerOrderStatus> = {
  new_request: "new_request",
  file_check: "file_check",
  customer_info_needed: "customer_info_needed",
  in_progress: "in_progress",
  completed: "completed",
  revision: "revision",
  cancelled: "cancelled",
  canceled: "cancelled",
};

const creditTransactionTypeAliases: Record<string, CreditTransactionType> = {
  purchase: "purchase",
  refund: "refund",
  admin_topup: "admin_topup",
  admin_adjustment: "admin_adjustment",
  usage: "usage",
  order_usage: "usage",
  request_usage: "usage",
  credit_usage: "usage",
};

function normalizedKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
}

function hasOwnKey<T extends object>(value: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function formatPlural(locale: LocaleCode, count: number, forms: PluralForms) {
  const category = new Intl.PluralRules(intlLocaleByCode[locale]).select(count);
  const template = forms[category as keyof PluralForms] ?? forms.other;
  return template.replace("{count}", count.toLocaleString(intlLocaleByCode[locale]));
}

export function localizeCustomerOrderStatus(
  locale: LocaleCode,
  status: string | null | undefined
) {
  const key = customerOrderStatusAliases[normalizedKey(status)];
  return key
    ? customerDynamicCopy[locale].orderStatuses[key]
    : customerDynamicCopy[locale].statusUnavailable;
}

export function localizeCreditTransactionType(
  locale: LocaleCode,
  type: string | null | undefined
) {
  const key = creditTransactionTypeAliases[normalizedKey(type)];
  return key
    ? customerDynamicCopy[locale].creditTransactionTypes[key]
    : customerDynamicCopy[locale].creditTransactionFallback;
}

export function localizeFileExpertStatus(locale: LocaleCode, status: string | null | undefined) {
  const key = normalizedKey(status);
  const labels = customerDynamicCopy[locale].fileExpertStatuses;
  return hasOwnKey(labels, key)
    ? labels[key]
    : customerDynamicCopy[locale].statusUnavailable;
}

export function localizeFileExpertRisk(locale: LocaleCode, risk: string | null | undefined) {
  const key = normalizedKey(risk);
  const labels = customerDynamicCopy[locale].fileExpertRisks;
  return hasOwnKey(labels, key)
    ? labels[key]
    : customerDynamicCopy[locale].fileExpertRisks.unknown;
}

export function localizeFileExpertReview(locale: LocaleCode, risk: string | null | undefined) {
  return customerDynamicCopy[locale].reviewTemplate.replace(
    "{risk}",
    localizeFileExpertRisk(locale, risk)
  );
}

export function localizeFileExpertDetection(
  locale: LocaleCode,
  status: string | null | undefined
) {
  const key = normalizedKey(status);
  const labels = customerDynamicCopy[locale].fileExpertDetections;
  return hasOwnKey(labels, key)
    ? labels[key]
    : customerDynamicCopy[locale].fileExpertRisks.unknown;
}

export function localizeFileExpertReadiness(
  locale: LocaleCode,
  status: string | null | undefined
) {
  const key = normalizedKey(status);
  const labels = customerDynamicCopy[locale].fileExpertReadiness;
  return hasOwnKey(labels, key)
    ? labels[key]
    : customerDynamicCopy[locale].fileExpertReadiness.none;
}

export function formatCustomerMessageCount(locale: LocaleCode, count: number) {
  return formatPlural(locale, count, customerDynamicCopy[locale].messageCount);
}

export function formatCustomerNewMessageCount(locale: LocaleCode, count: number) {
  return formatPlural(locale, count, customerDynamicCopy[locale].newMessageCount);
}

export function formatFileExpertJobCount(locale: LocaleCode, count: number) {
  return formatPlural(locale, count, customerDynamicCopy[locale].jobCount);
}
