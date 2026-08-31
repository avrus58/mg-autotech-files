import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  customerPortalLocaleOrder,
  customerPortalLocaleOverrides,
  customerPortalTranslations,
} from "../src/lib/customerPortalTranslations";
import {
  customerSurfaceLocaleOrder,
  customerSurfaceTranslations,
} from "../src/lib/customerSurfaceTranslations";
import { exactTranslations, termTranslations } from "../src/lib/i18n";
import {
  customerWorkflowExactTranslations,
  customerWorkflowLocaleOrder,
  customerWorkflowT,
} from "../src/lib/i18n/customer-workflow-translations";
import {
  customerRuntimeLocaleOrder,
  customerRuntimeTranslations,
  localizeFileExpertDetection,
} from "../src/lib/i18n/customer-runtime-translations";
import { publicCoreTranslations } from "../src/lib/i18n/public-core-translations";
import { publicServicesTranslations } from "../src/lib/i18n/public-services-translations";
import { publicSurfaceLocaleOrder } from "../src/lib/i18n/public-surface-types";
import { publicToolsTranslations } from "../src/lib/i18n/public-tools-translations";
import { publicVehicleTranslations } from "../src/lib/i18n/public-vehicle-translations";
import {
  fileExpertReportLocaleOrder,
  fileExpertReportRows,
} from "../src/lib/i18n/file-expert-report-translations";
import {
  workshopGuideExactTranslations,
  workshopGuideLocaleOrder,
} from "../src/lib/i18n/workshop-guides-translations";
import { logStudioT } from "../src/lib/i18n/log-analysis-studio-translations";
import {
  serviceIntentExactTranslations,
  serviceIntentLocaleOrder,
} from "../src/lib/i18n/service-intent-translations";
import { widgetSiteT } from "../src/lib/i18n/widget-site-translations";

function localizedRecord(
  localeOrder: readonly string[],
  translations: readonly string[],
) {
  return Object.fromEntries(
    localeOrder.map((locale, index) => [locale, translations[index]]),
  );
}

function assertLocalizedGoldens(
  localeOrder: readonly string[],
  catalog: Record<string, readonly string[]>,
  goldens: Record<string, Record<string, string>>,
) {
  for (const [source, expected] of Object.entries(goldens)) {
    const translations = catalog[source];
    assert.ok(translations, `Missing localization source: ${source}`);
    const localized = localizedRecord(localeOrder, translations);
    for (const [locale, value] of Object.entries(expected)) {
      assert.equal(localized[locale], value, `${source}: ${locale}`);
    }
  }
}

const publicCriticalGoldens = {
  Breadcrumb: {
    de: "Brotkrümelnavigation",
    tr: "Sayfa yolu",
    nl: "Kruimelpad",
    fr: "Fil d'Ariane",
    it: "Percorso di navigazione",
    es: "Ruta de navegación",
    pt: "Trilho de navegação",
    pl: "Ścieżka nawigacyjna",
    ru: "Навигационная цепочка",
    zh: "面包屑导航",
    sq: "Shtegu i navigimit",
  },
  "ECU platform guides": {
    de: "ECU-Plattformleitfäden",
    tr: "ECU platform kılavuzları",
    nl: "ECU-platformgidsen",
    fr: "Guides des plateformes ECU",
    it: "Guide alle piattaforme ECU",
    es: "Guías de plataformas ECU",
    pt: "Guias de plataformas ECU",
    pl: "Przewodniki po platformach ECU",
    ru: "Руководства по платформам ECU",
    zh: "ECU 平台指南",
    sq: "Udhëzues për platformat ECU",
  },
  "File readiness check": {
    de: "Prüfung der Dateibereitschaft",
    tr: "Dosya hazırlık kontrolü",
    nl: "Controle van bestandsvoorbereiding",
    fr: "Vérification de la préparation du fichier",
    it: "Verifica della preparazione del file",
    es: "Comprobación de preparación del archivo",
    pt: "Verificação da preparação do ficheiro",
    pl: "Kontrola przygotowania pliku",
    ru: "Проверка готовности файла",
    zh: "文件准备情况检查",
    sq: "Kontrolli i gatishmërisë së skedarit",
  },
  "Prepare a cleaner file-service request": {
    de: "Eine klarere Fileservice-Anfrage vorbereiten",
    tr: "Daha net bir dosya hizmeti talebi hazırlayın",
    nl: "Bereid een duidelijkere fileservice-aanvraag voor",
    fr: "Préparez une demande de service de fichiers plus claire",
    it: "Prepara una richiesta di file service più chiara",
    es: "Prepare una solicitud de servicio de archivos más clara",
    pt: "Prepare um pedido de serviço de ficheiros mais claro",
    pl: "Przygotuj bardziej przejrzyste zlecenie usługi plikowej",
    ru: "Подготовьте более понятную заявку на файловый сервис",
    zh: "准备更清晰的文件服务请求",
    sq: "Përgatitni një kërkesë më të qartë për shërbimin e skedarëve",
  },
  "Request brief builder": {
    de: "Anfrage-Briefing-Generator",
    tr: "Talep özeti oluşturucu",
    nl: "Generator voor aanvraagbriefings",
    fr: "Générateur de résumé de demande",
    it: "Generatore di riepilogo della richiesta",
    es: "Generador de resumen de solicitud",
    pt: "Gerador de resumo do pedido",
    pl: "Generator opisu zlecenia",
    ru: "Конструктор описания заявки",
    zh: "请求简报生成器",
    sq: "Gjeneruesi i përmbledhjes së kërkesës",
  },
  "Workshop Guides": {
    de: "Werkstatt-Leitfäden",
    tr: "Servis Kılavuzları",
    nl: "Werkplaatsgidsen",
    fr: "Guides pour ateliers",
    it: "Guide per officine",
    es: "Guías para talleres",
    pt: "Guias para oficinas",
    pl: "Poradniki warsztatowe",
    ru: "Руководства для мастерских",
    zh: "维修厂指南",
    sq: "Udhëzues për serviset",
  },
} as const;

test("critical public UI and automotive terminology matches reviewed locale goldens", () => {
  for (const [source, expected] of Object.entries(publicCriticalGoldens)) {
    assert.deepEqual(
      localizedRecord(
        publicSurfaceLocaleOrder,
        publicCoreTranslations[source],
      ),
      expected,
      source,
    );
  }

  assert.deepEqual(
    publicServicesTranslations.Breadcrumb,
    publicCoreTranslations.Breadcrumb,
  );
  assert.deepEqual(
    serviceIntentExactTranslations["File readiness check"],
    publicCoreTranslations["File readiness check"],
  );
  assert.deepEqual(
    serviceIntentExactTranslations["Request brief builder"],
    publicCoreTranslations["Request brief builder"],
  );
  assert.deepEqual(serviceIntentLocaleOrder, publicSurfaceLocaleOrder);
});

test("request brief and Stage 1 guide labels never regress to construction or rail meanings", () => {
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicServicesTranslations["Build request brief"],
    ),
    {
      de: "Anfragebriefing erstellen",
      tr: "Talep özetini hazırla",
      nl: "Aanvraagoverzicht opstellen",
      fr: "Préparer le brief de la demande",
      it: "Crea il riepilogo della richiesta",
      es: "Crear el resumen de la solicitud",
      pt: "Criar o resumo do pedido",
      pl: "Przygotuj opis zlecenia",
      ru: "Составить описание заявки",
      zh: "编写请求说明",
      sq: "Përgatit përmbledhjen e kërkesës",
    },
  );

  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicServicesTranslations["Stage 1 ECU platform guides"],
    ),
    {
      de: "Leitfäden zu Stage 1-ECU-Plattformen",
      tr: "Stage 1 ECU platform kılavuzları",
      nl: "Gidsen voor Stage 1-ECU-platforms",
      fr: "Guides des plateformes ECU Stage 1",
      it: "Guide alle piattaforme ECU Stage 1",
      es: "Guías de plataformas ECU para Stage 1",
      pt: "Guias de plataformas ECU para Stage 1",
      pl: "Przewodniki po platformach ECU dla Stage 1",
      ru: "Руководства по платформам ECU для Stage 1",
      zh: "Stage 1 ECU 平台指南",
      sq: "Udhëzues për platformat ECU për Stage 1",
    },
  );

  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations["Build Request Brief"],
    ),
    {
      de: "Anfrage-Briefing erstellen",
      tr: "Talep özeti oluştur",
      nl: "Aanvraagbriefing opstellen",
      fr: "Créer le résumé de la demande",
      it: "Crea il riepilogo della richiesta",
      es: "Crear resumen de solicitud",
      pt: "Criar resumo do pedido",
      pl: "Utwórz opis zlecenia",
      ru: "Составить описание заявки",
      zh: "生成请求简报",
      sq: "Krijo përmbledhjen e kërkesës",
    },
  );

  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations["Cleaner intake"],
    ),
    {
      de: "Klarere Angaben",
      tr: "Daha net bilgiler",
      nl: "Duidelijkere invoer",
      fr: "Informations plus claires",
      it: "Dati più chiari",
      es: "Información más clara",
      pt: "Informação mais clara",
      pl: "Jaśniejsze dane wejściowe",
      ru: "Более понятные исходные данные",
      zh: "更清晰的信息",
      sq: "Të dhëna më të qarta",
    },
  );

  const combined = [
    ...Object.values(publicCoreTranslations),
    ...Object.values(publicServicesTranslations),
    ...Object.values(publicToolsTranslations),
    ...Object.values(publicVehicleTranslations),
    ...Object.values(serviceIntentExactTranslations),
  ].flat().join("\n");

  assert.doesNotMatch(
    combined,
    /Semmelbrösel|Pangrattato|Bułka tarta|Prowadnice|Направляющие|导轨|inşaatçı|строителя|构建者|ndërtues|nettoyeur|челка|flequillo/u,
  );
});

test("workshop terminology never becomes a seminar or generic creative workshop", () => {
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicCoreTranslations["Common workshop questions"],
    ),
    {
      de: "Häufige Fragen aus der Werkstatt",
      tr: "Servislerin sık sorduğu sorular",
      nl: "Veelgestelde vragen van werkplaatsen",
      fr: "Questions fréquentes des ateliers",
      it: "Domande frequenti delle officine",
      es: "Preguntas frecuentes de los talleres",
      pt: "Perguntas frequentes das oficinas",
      pl: "Najczęstsze pytania warsztatów",
      ru: "Частые вопросы мастерских",
      zh: "维修厂常见问题",
      sq: "Pyetje të shpeshta nga serviset",
    },
  );

  const customerWorkshopCopy = [
    ...customerWorkflowExactTranslations["Workshop search navigator"],
    ...customerWorkflowExactTranslations[
      "Workshops often use different wording for the same need. Choose the closest job context below; every search phrase points to one authoritative MG AutoTech route instead of a duplicate landing page."
    ],
  ].join("\n");

  assert.doesNotMatch(
    customerWorkshopCopy,
    /семинар|研讨会|创意工坊|seminarit|workshopnota|I workshop|Os workshops/iu,
  );
});

test("score, character counters and high-traffic recovery copy keep their UI meaning", () => {
  const scoreQuestion = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "Can the score approve a file-service request automatically?"
    ],
  );
  assert.equal(
    scoreQuestion.nl,
    "Kan de score automatisch een bestandsserviceaanvraag goedkeuren?",
  );
  assert.equal(
    scoreQuestion.es,
    "¿Puede la puntuación aprobar automáticamente una solicitud de servicio de archivos?",
  );
  assert.doesNotMatch(`${scoreQuestion.nl}\n${scoreQuestion.es}`, /partituur|partitura/iu);

  assert.deepEqual(
    localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations["characters remaining"],
    ),
    {
      nl: "resterende tekens",
      de: "verbleibende Zeichen",
      fr: "caractères restants",
      it: "caratteri rimanenti",
      ru: "осталось символов",
      es: "caracteres restantes",
      tr: "kalan karakter",
      pt: "carateres restantes",
      zh: "剩余字符数",
      pl: "pozostałe znaki",
      sq: "karaktere të mbetura",
    },
  );

  assert.equal(
    localizedRecord(
      customerRuntimeLocaleOrder,
      customerRuntimeTranslations[
        "Security verification is temporarily unavailable. Please try again later."
      ],
    ).it,
    "La verifica di sicurezza è temporaneamente indisponibile. Riprova più tardi.",
  );
  assert.equal(
    logStudioT("tr", "fileSizeError", { size: "25 MB" }),
    "Bu yerel stüdyo en fazla 25 MB boyutundaki dosyaları kabul eder.",
  );
});

test("German workflow grammar and Portuguese portal copy stay production-ready", () => {
  const germanPublicCopy = [
    ...Object.values(publicCoreTranslations),
    ...Object.values(publicServicesTranslations),
    ...Object.values(publicToolsTranslations),
  ].map((translations) => translations[publicSurfaceLocaleOrder.indexOf("de")]).join("\n");

  assert.doesNotMatch(
    germanPublicCopy,
    /Der komplexe Dateien|Der fertige Datei|Der Datei und|einen Datei|Ist ein Datei|gültiger Datei|Werkstätten benötigt|Status und abgeschlossen Dateien/u,
  );

  const portugueseWorkflow = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations[
      "Your request is being processed. Status and delivery updates will appear here automatically."
    ],
  );
  assert.equal(
    portugueseWorkflow.pt,
    "O seu pedido está a ser processado. As atualizações de estado e de entrega serão apresentadas aqui automaticamente.",
  );
  assert.equal(
    localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations["Your file request has been created."],
    ).pt,
    "O seu pedido de serviço de ficheiros foi criado.",
  );
});

test("Pop and Bangs remains an automotive calibration term in every customer locale", () => {
  assert.deepEqual(
    localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations["Pop and Bangs"],
    ),
    {
      nl: "Pop & Bangs-afstelling",
      de: "Pop-&-Bang-Abstimmung",
      fr: "Réglage Pop & Bangs",
      it: "Taratura Pop & Bangs",
      ru: "Настройка Pop & Bangs",
      es: "Ajuste Pop & Bangs",
      tr: "Pop & Bangs ayarı",
      pt: "Afinação Pop & Bangs",
      zh: "Pop & Bangs 声浪设置",
      pl: "Strojenie Pop & Bangs",
      sq: "Konfigurimi Pop & Bangs",
    },
  );

  for (const source of [
    "Pop and Bangs AC Button",
    "Pop and Bangs Sport Button",
  ]) {
    for (const translation of customerWorkflowExactTranslations[source]) {
      assert.match(translation, /Pop\s*(?:&|and)\s*Bangs/u, source);
      assert.doesNotMatch(translation, /pony|челка|flequillo|franja/u, source);
    }
  }
});

test("critical file extensions stay byte-for-byte intact in every locale", () => {
  const source = "Unsupported file type. Please upload .bin, .ori, .mod, .frf, .hex, .zip or .sgo.";
  const expectedExtensions = [".bin", ".ori", ".mod", ".frf", ".hex", ".zip", ".sgo"];

  for (const translation of customerWorkflowExactTranslations[source]) {
    assert.deepEqual(
      translation.match(/\.[a-z0-9]+/gu),
      expectedExtensions,
      translation,
    );
  }
});

test("customer filters and Turkish public copy keep domain meaning and valid inflection", () => {
  assert.deepEqual(
    localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations["Order updates"],
    ),
    {
      nl: "Bestelupdates",
      de: "Bestellaktualisierungen",
      fr: "Mises à jour des commandes",
      it: "Aggiornamenti sugli ordini",
      ru: "Обновления заказов",
      es: "Actualizaciones de pedidos",
      tr: "Sipariş güncellemeleri",
      pt: "Atualizações dos pedidos",
      zh: "订单更新",
      pl: "Aktualizacje zleceń",
      sq: "Përditësimet e porosive",
    },
  );

  const turkishIndex = publicSurfaceLocaleOrder.indexOf("tr");
  const turkishPublicCopy = [
    ...Object.values(publicCoreTranslations),
    ...Object.values(publicServicesTranslations),
    ...Object.values(publicToolsTranslations),
    ...Object.values(publicVehicleTranslations),
  ].map((translations) => translations[turkishIndex]).join("\n");

  assert.doesNotMatch(
    turkishPublicCopy,
    /(?:dosyalar|dosya|krediler|ünitesi|üniteleri|okuma|servis)'(?:yu|yi|ya|nun|si)|MG AutoTech'(?:ya|ye|nin|nun|den)|(?:DTCs|PS)'(?:yu|yi|ya)|RPM'dan/u,
  );
});

test("safety boundaries keep every upload-assistant action negated", () => {
  const uploadBoundary = localizedRecord(
    publicSurfaceLocaleOrder,
    publicCoreTranslations[
      "The upload assistant does not modify files, generate tuning files, work offline, access unrelated files or expose admin systems. It is only a secure customer upload client."
    ],
  );

  assert.deepEqual(uploadBoundary, {
    de: "Der Upload-Assistent verändert keine Dateien, erstellt keine Tuning-Dateien, funktioniert nicht offline, greift nicht auf nicht zugehörige Dateien zu und legt keine Admin-Systeme offen. Er ist ausschließlich ein sicherer Upload-Client für Kunden.",
    tr: "Yükleme asistanı dosyaları değiştirmez, tuning dosyaları oluşturmaz, çevrimdışı çalışmaz, ilgisiz dosyalara erişmez ve yönetici sistemlerini açığa çıkarmaz. Yalnızca güvenli bir müşteri yükleme istemcisidir.",
    nl: "De uploadassistent wijzigt geen bestanden, genereert geen tuningbestanden, werkt niet offline, opent geen niet-gerelateerde bestanden en stelt geen beheersystemen bloot. Het is uitsluitend een beveiligde uploadclient voor klanten.",
    fr: "L’assistant de téléversement ne modifie aucun fichier, ne génère aucun fichier de tuning, ne fonctionne pas hors ligne, n’accède pas aux fichiers sans rapport et n’expose aucun système d’administration. Il s’agit uniquement d’un client de téléversement sécurisé destiné aux clients.",
    it: "L’assistente di caricamento non modifica file, non genera file di tuning, non funziona offline, non accede a file non pertinenti e non espone sistemi di amministrazione. È esclusivamente un client sicuro per il caricamento dei clienti.",
    es: "El asistente de carga no modifica archivos, no genera archivos de tuning, no funciona sin conexión, no accede a archivos no relacionados ni expone sistemas de administración. Es únicamente un cliente seguro de carga para clientes.",
    pt: "O assistente de carregamento não modifica ficheiros, não gera ficheiros de tuning, não funciona offline, não acede a ficheiros não relacionados nem expõe sistemas de administração. É exclusivamente um cliente seguro de carregamento para clientes.",
    pl: "Asystent przesyłania nie modyfikuje plików, nie generuje plików tuningowych, nie działa offline, nie uzyskuje dostępu do niepowiązanych plików ani nie ujawnia systemów administracyjnych. Jest wyłącznie bezpiecznym klientem do przesyłania plików przez klientów.",
    ru: "Помощник загрузки не изменяет файлы, не создаёт тюнинговые файлы, не работает без подключения к сети, не получает доступ к посторонним файлам и не раскрывает административные системы. Это исключительно защищённый клиент для загрузки файлов пользователем.",
    zh: "上传助手不会修改文件、生成调校文件、离线运行、访问无关文件或暴露管理系统。它只是供客户安全上传文件的客户端。",
    sq: "Asistenti i ngarkimit nuk modifikon skedarë, nuk gjeneron skedarë tuning, nuk punon pa lidhje, nuk hyn në skedarë të palidhur dhe nuk ekspozon sisteme administrimi. Ai është vetëm një klient i sigurt për ngarkimet e klientëve.",
  });

  const advisorBoundary = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "This advisor does not read files, open a file picker, modify binaries or create a request. It only helps you prepare safer information before using the secure MG AutoTech workflow."
    ],
  );
  assert.equal(
    advisorBoundary.pt,
    "Este assistente não lê ficheiros, não abre o seletor de ficheiros, não modifica binários nem cria pedidos. Apenas ajuda a preparar informações mais seguras antes de utilizar o fluxo protegido da MG AutoTech.",
  );

  const briefBoundary = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "This tool does not upload files, inspect binary data, create a request or contact MG AutoTech automatically."
    ],
  );
  assert.equal(
    briefBoundary.it,
    "Questo strumento non carica file, non esamina dati binari, non crea richieste e non contatta automaticamente MG AutoTech.",
  );
  assert.equal(
    briefBoundary.pt,
    "Esta ferramenta não carrega ficheiros, não inspeciona dados binários, não cria pedidos nem contacta automaticamente a MG AutoTech.",
  );
});

test("Stage labels remain automotive calibration terminology in every locale", () => {
  const stageRows = [
    customerWorkflowExactTranslations[
      "Only selected software options without stage tuning."
    ],
    publicServicesTranslations[
      "The stage name is only a starting point. Vehicle condition, ECU software, fuel, gearbox limits and installed hardware determine what can be reviewed for the submitted file. No stage promises a universal result."
    ],
    publicVehicleTranslations[
      "The relevant route can be reviewed after the exact vehicle, ECU software, original file, fuel and hardware setup are supplied. A stage label alone does not confirm compatibility."
    ],
  ];

  for (const translation of stageRows.flat()) {
    assert.match(translation, /\bStage\b/u, translation);
    assert.doesNotMatch(
      translation,
      /Bühne|Künstlername|sahne|podium|artiestennaam|nom de scène|nome d[’']arte|palco|nombre artístico|nome artístico|scenicz|сценическ|этап|艺名|阶段|skenë|skenës/iu,
      translation,
    );
  }
});

test("MAP, Launch Control and DPF labels preserve their automotive meaning", () => {
  for (const translation of customerWorkflowExactTranslations[
    "Map Sensor Calibration"
  ]) {
    assert.match(translation, /\bMAP\b/u, translation);
  }

  const launchControl = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["Launch Control"],
  );
  assert.equal(launchControl.it, "Launch Control");
  assert.equal(launchControl.zh, "起步控制（Launch Control）");
  assert.equal(launchControl.pl, "Kontrola startu (Launch Control)");

  const dpfOff = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["DPF OFF"],
  );
  assert.equal(dpfOff.zh, "DPF OFF（柴油颗粒捕集器关闭）");
  assert.doesNotMatch(dpfOff.zh, /数码相框/u);
});

test("read method stays a noun phrase instead of becoming an instruction", () => {
  const submitDetails = localizedRecord(
    publicSurfaceLocaleOrder,
    publicVehicleTranslations[
      "Submit the original file, read method and diagnostic context so the exact controller can be reviewed."
    ],
  );
  assert.equal(
    submitDetails.nl,
    "Dien het originele bestand, de uitleesmethode en de diagnostische context in, zodat de exacte regeleenheid kan worden beoordeeld.",
  );
  assert.equal(
    submitDetails.it,
    "Invia il file originale, il metodo di lettura e il contesto diagnostico, così da poter verificare la centralina esatta.",
  );
  assert.equal(
    submitDetails.es,
    "Envíe el archivo original, el método de lectura y el contexto de diagnóstico para que se pueda revisar la unidad de control exacta.",
  );
  assert.equal(
    submitDetails.pl,
    "Prześlij oryginalny plik, metodę odczytu i kontekst diagnostyczny, aby można było sprawdzić właściwy sterownik.",
  );

  const supportDetails = localizedRecord(
    publicSurfaceLocaleOrder,
    publicVehicleTranslations[
      "They may be supported when the software match is correct. Submit the identification and read method for review."
    ],
  );
  assert.equal(
    supportDetails.tr,
    "Yazılım eşleşmesi doğruysa desteklenebilirler. İnceleme için kimlik bilgilerini ve okuma yöntemini gönderin.",
  );
  assert.equal(
    supportDetails.it,
    "Possono essere supportati quando il software corrisponde correttamente. Invia l’identificazione e il metodo di lettura per la verifica.",
  );

  assert.doesNotMatch(
    [...Object.values(submitDetails), ...Object.values(supportDetails)].join("\n"),
    /lees de methode|leggi il metodo|lea el método|przeczytaj metodę|yöntemi okuyun/iu,
  );
});

test("aftertreatment and attached-request wording keeps automotive workflow meaning", () => {
  const russianIndex = publicSurfaceLocaleOrder.indexOf("ru");
  const russianAftertreatment = Object.entries(publicServicesTranslations)
    .filter(([source]) => source.toLowerCase().includes("aftertreatment"))
    .map(([, translations]) => translations[russianIndex]);

  assert.ok(russianAftertreatment.length > 0);
  for (const translation of russianAftertreatment) {
    assert.match(translation, /выхлопных газов/u, translation);
    assert.doesNotMatch(translation, /послеоперацион|лечение|медицин/iu, translation);
  }

  const turkishIndex = publicSurfaceLocaleOrder.indexOf("tr");
  for (const source of [
    "Engine, gearbox, read method and current diagnostic condition must stay attached to the request.",
    "Vehicle, engine, ECU or TCU details, read method, exact fault codes and workshop notes stay attached to the request.",
  ]) {
    const translation = publicServicesTranslations[source][turkishIndex];
    assert.match(translation, /talebe bağlı/u, translation);
    assert.doesNotMatch(translation, /isteğe bağlı/u, translation);
  }
});

test("negative compatibility answers cannot lose their No boundary", () => {
  const expectedNegativePattern = {
    de: /^Nein\./u,
    tr: /^Hayır\./u,
    nl: /^Nee\./u,
    fr: /^Non\./u,
    it: /^No\./u,
    es: /^No\./u,
    pt: /^Não\./u,
    pl: /^Nie\./u,
    ru: /^Нет\./u,
    zh: /^(?:不能|否。|不会)/u,
    sq: /^Jo\./u,
  } as const;

  const negativeRows = Object.entries(publicVehicleTranslations).filter(
    ([source]) => source.startsWith("No."),
  );
  negativeRows.push([
    "No. Vehicle model, ECU family, HW/SW identifiers, original-file history, fuel, gearbox and installed hardware can change the correct review context. Similar vehicle descriptions do not make files interchangeable.",
    publicServicesTranslations[
      "No. Vehicle model, ECU family, HW/SW identifiers, original-file history, fuel, gearbox and installed hardware can change the correct review context. Similar vehicle descriptions do not make files interchangeable."
    ],
  ]);

  assert.ok(negativeRows.length >= 12);
  for (const [source, row] of negativeRows) {
    const translations = localizedRecord(
      publicSurfaceLocaleOrder,
      row,
    );
    for (const [locale, pattern] of Object.entries(expectedNegativePattern)) {
      assert.match(translations[locale], pattern, `${source} (${locale})`);
    }
    assert.doesNotMatch(translations.zh, /^不需要/u, source);
  }

  const fileCoverage = localizedRecord(
    publicSurfaceLocaleOrder,
    publicVehicleTranslations[
      "No. File coverage must be checked against the requested work."
    ],
  );
  assert.equal(
    fileCoverage.fr,
    "Non. La couverture du fichier doit être vérifiée par rapport au travail demandé.",
  );
  assert.equal(
    fileCoverage.es,
    "No. La cobertura del archivo debe comprobarse según el trabajo solicitado.",
  );
  assert.equal(
    fileCoverage.sq,
    "Jo. Mbulimi i skedarit duhet të kontrollohet sipas punës së kërkuar.",
  );
});

test("file-export and customer fitment fallbacks use reviewed noun forms", () => {
  const exportWarning = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "The detected RPM, torque or estimated power is outside the supported public-check range. Review the selected channels, units and export before relying on it."
    ],
  );
  assert.equal(
    exportWarning.tr,
    "Algılanan RPM, tork veya tahmini güç, herkese açık kontrolün desteklediği aralığın dışında. Sonuca güvenmeden önce seçilen kanalları, birimleri ve dışa aktarılan dosyayı inceleyin.",
  );
  assert.equal(
    exportWarning.pt,
    "As RPM, o binário ou a potência estimada detetados estão fora do intervalo suportado pela verificação pública. Reveja os canais, as unidades e o ficheiro exportado antes de confiar no resultado.",
  );

  const unreadableFile = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "The file could not be read or analyzed in this browser. Try exporting it again as CSV, TSV, TXT or LOG text."
    ],
  );
  assert.equal(
    unreadableFile.de,
    "Die Datei konnte in diesem Browser nicht gelesen oder analysiert werden. Exportieren Sie sie erneut als CSV-, TSV-, TXT- oder LOG-Textdatei.",
  );
  assert.equal(
    unreadableFile.it,
    "Il file non è stato letto o analizzato in questo browser. Prova a esportarlo nuovamente come file di testo CSV, TSV, TXT o LOG.",
  );
  assert.equal(
    unreadableFile.pl,
    "Nie udało się odczytać ani przeanalizować pliku w tej przeglądarce. Spróbuj ponownie wyeksportować go jako plik tekstowy CSV, TSV, TXT lub LOG.",
  );

  assert.deepEqual(
    localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations[
        "No automatic vehicle application match is available."
      ],
    ),
    {
      nl: "Er is geen automatische overeenkomst voor de voertuigtoepassing beschikbaar.",
      de: "Für die Fahrzeuganwendung wurde keine automatische Zuordnung gefunden.",
      fr: "Aucune correspondance automatique avec l’application véhicule n’est disponible.",
      it: "Non è disponibile alcuna corrispondenza automatica per l’applicazione veicolo.",
      ru: "Автоматическое сопоставление с применяемостью автомобиля недоступно.",
      es: "No hay disponible una coincidencia automática para la aplicación del vehículo.",
      tr: "Araç uyumluluğu için otomatik eşleşme bulunamadı.",
      pt: "Não está disponível uma correspondência automática para a aplicação do veículo.",
      zh: "未找到自动匹配的车辆适用信息。",
      pl: "Brak automatycznego dopasowania zastosowania pojazdu.",
      sq: "Nuk u gjet përputhje automatike për konfigurimin e automjetit.",
    },
  );

  const engineNotSet = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["Engine not set"],
  );
  assert.equal(engineNotSet.fr, "Moteur non renseigné");
  assert.equal(engineNotSet.ru, "Двигатель не указан");
  assert.equal(engineNotSet.tr, "Motor belirtilmedi");
});

test("customer service-option labels keep automotive meanings instead of literal false friends", () => {
  const albanianIndex = customerWorkflowLocaleOrder.indexOf("sq");
  assert.equal(
    customerWorkflowExactTranslations["AdBlue OFF"][albanianIndex],
    "AdBlue i çaktivizuar",
  );
  assert.equal(
    customerWorkflowExactTranslations["EGR OFF"][albanianIndex],
    "EGR i çaktivizuar",
  );

  const italianIndex = customerWorkflowLocaleOrder.indexOf("it");
  assert.equal(
    customerWorkflowExactTranslations["Hot Start Fix"][italianIndex],
    "Correzione dell’avviamento a caldo",
  );

  for (const source of ["Map Switch", "Multi Map Setup"]) {
    for (const translation of customerWorkflowExactTranslations[source]) {
      assert.match(
        translation,
        /kalibr|kennfeld|cartograph.*moteur|calibra|калибров|标定/iu,
        `${source}: ${translation}`,
      );
    }
  }

  const startStop = customerWorkflowExactTranslations["Start / Stop Removal"];
  for (const translation of startStop) {
    assert.match(translation, /Start(?:\s*\/\s*|-)?Stopp?/iu, translation);
    assert.doesNotMatch(
      translation,
      /Démarrer|Avvia|Начать|Iniciar|Başlat|开始|Rozpocznij|Fillimi/iu,
      translation,
    );
  }

  const frenchIndex = customerWorkflowLocaleOrder.indexOf("fr");
  assert.equal(
    customerWorkflowExactTranslations["TVA Removal"][frenchIndex],
    "Désactivation de la fonction TVA",
  );

  for (const translation of customerWorkflowExactTranslations["Upshift Farts"]) {
    assert.match(translation, /^Upshift Pops/u, translation);
    assert.doesNotMatch(
      translation,
      /scheten|Fürze|Pets|Scoregge|Pedos|Osuruk|Peidos|放屁|Pierdnięcia|Pordhët/iu,
      translation,
    );
  }
});

test("stock means factory specification rather than inventory or shares", () => {
  const originalFile = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["Original / stock file request."],
  );
  assert.equal(originalFile.nl, "Aanvraag voor origineel/standaardbestand.");
  assert.equal(originalFile.de, "Anfrage für Original-/Seriendatei.");
  assert.equal(originalFile.zh, "原始/原厂文件请求。");
  assert.equal(originalFile.pl, "Zlecenie pliku oryginalnego/seryjnego.");
  assert.equal(originalFile.sq, "Kërkesë për skedarin origjinal/standard.");

  const stockVehicle = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations[
      "Safe performance optimization for stock vehicles."
    ],
  );
  assert.equal(
    stockVehicle.nl,
    "Veilige prestatie-optimalisatie voor voertuigen in standaarduitvoering.",
  );
  assert.equal(stockVehicle.de, "Sichere Leistungsoptimierung für Serienfahrzeuge.");
  assert.equal(
    stockVehicle.fr,
    "Optimisation sûre des performances pour les véhicules de série.",
  );
  assert.equal(
    stockVehicle.zh,
    "原厂状态车辆的安全性能优化。",
  );
  assert.equal(
    stockVehicle.sq,
    "Optimizim i sigurt i performancës për automjete në konfigurim standard.",
  );

  assert.doesNotMatch(
    [...Object.values(originalFile), ...Object.values(stockVehicle)].join("\n"),
    /voorraad|Lagerbestand|Bestandsfahrzeug|véhicules? de stock|库存|magazyn|aksione/iu,
  );
});

test("Chinese credits remain platform points and Albanian possible remains an adjective", () => {
  const chineseIndex = customerWorkflowLocaleOrder.indexOf("zh");
  const chineseCreditRows = Object.entries(customerWorkflowExactTranslations)
    .filter(([source]) => /credits?/iu.test(source))
    .map(([, translations]) => translations[chineseIndex]);

  assert.ok(chineseCreditRows.length >= 18);
  for (const translation of chineseCreditRows) {
    assert.match(translation, /积分|点数/u, translation);
    assert.doesNotMatch(translation, /信用|信贷|学分|贷款/u, translation);
  }

  assert.equal(localizeFileExpertDetection("sq", "possible"), "I mundur");
});

test("Chinese workshop and calibration copy keeps automotive meaning", () => {
  const chineseIndex = publicSurfaceLocaleOrder.indexOf("zh");
  const chinesePublicCopy = [
    ...Object.values(publicCoreTranslations),
    ...Object.values(publicServicesTranslations),
    ...Object.values(publicToolsTranslations),
    ...Object.values(publicVehicleTranslations),
    ...Object.values(serviceIntentExactTranslations),
  ]
    .map((translations) => translations[chineseIndex])
    .join("\n");
  const chineseCustomerCopy = [
    ...Object.values(customerWorkflowExactTranslations).map(
      (translations) =>
        translations[customerWorkflowLocaleOrder.indexOf("zh")],
    ),
    ...Object.values(customerRuntimeTranslations).map(
      (translations) =>
        translations[customerRuntimeLocaleOrder.indexOf("zh")],
    ),
  ].join("\n");

  assert.doesNotMatch(chinesePublicCopy, /车间|调音/u);
  assert.doesNotMatch(chineseCustomerCopy, /车间/u);
  assert.equal(
    publicCoreTranslations["Stage 1 Tuning"][chineseIndex],
    "Stage 1 调校",
  );
  assert.equal(
    publicCoreTranslations["TCU Tuning"][chineseIndex],
    "TCU 调校",
  );
});

test("transmission and torque terms stay in gearbox context", () => {
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicServicesTranslations.Transmission,
    ),
    {
      de: "Getriebe",
      tr: "Şanzıman",
      nl: "Transmissie",
      fr: "Transmission",
      it: "Trasmissione",
      es: "Transmisión",
      pt: "Transmissão",
      pl: "Skrzynia biegów",
      ru: "Трансмиссия",
      zh: "变速箱",
      sq: "Transmisioni",
    },
  );

  const publicCatalogs = [
    publicCoreTranslations,
    publicServicesTranslations,
    publicToolsTranslations,
    publicVehicleTranslations,
  ];
  const spanishIndex = publicSurfaceLocaleOrder.indexOf("es");
  const italianIndex = publicSurfaceLocaleOrder.indexOf("it");
  for (const catalog of publicCatalogs) {
    for (const [source, translations] of Object.entries(catalog)) {
      if (!/torque/iu.test(source)) continue;
      assert.doesNotMatch(translations[spanishIndex], /torsión/iu, source);
      assert.doesNotMatch(translations[italianIndex], /torsione/iu, source);
    }
  }

  const transmissionCopy = [
    ...publicServicesTranslations.Transmission,
    ...publicServicesTranslations["Transmission workflow"],
  ].join("\n");
  assert.doesNotMatch(
    transmissionCopy,
    /Übertragung|Bulaşma|Передача инфекции|传播|Przenoszenie|Transmetim/iu,
  );
});

test("Portuguese site copy consistently uses Portugal terminology", () => {
  const portugueseIndex = publicSurfaceLocaleOrder.indexOf("pt");
  const publicRows = [
    ...Object.entries(publicCoreTranslations),
    ...Object.entries(publicServicesTranslations),
    ...Object.entries(publicToolsTranslations),
    ...Object.entries(publicVehicleTranslations),
  ] as Array<[string, readonly string[]]>;
  const workflowIndex = customerWorkflowLocaleOrder.indexOf("pt");
  const runtimeIndex = customerRuntimeLocaleOrder.indexOf("pt");
  const portugueseRows: Array<[string, string]> = [
    ...publicRows.map(([source, translations]) => [
      source,
      translations[portugueseIndex],
    ] as [string, string]),
    ...Object.entries(customerWorkflowExactTranslations).map(
      ([source, translations]) => [source, translations[workflowIndex]] as [string, string],
    ),
    ...Object.entries(customerRuntimeTranslations).map(
      ([source, translations]) => [source, translations[runtimeIndex]] as [string, string],
    ),
    ...Object.entries(exactTranslations.pt),
  ];

  for (const [source, translation] of portugueseRows) {
    assert.doesNotMatch(
      translation,
      /\b(?:solicitaç(?:ão|ões)|aplicativos?|equipes?|usuários?|faturamento|registros?|telas?|gerenciamento|gerenciar|salvar|câmbio|torque|status|upload|download)\b/iu,
      source,
    );
    if (/\bfiles?\b/iu.test(source) && !/\barchive\b/iu.test(source)) {
      assert.doesNotMatch(translation, /\barquivos?\b/iu, source);
    }
  }
});

test("binary file copy never falls back to dossier or fascicolo terminology", () => {
  const publicCatalogs = [
    publicCoreTranslations,
    publicServicesTranslations,
    publicToolsTranslations,
    publicVehicleTranslations,
  ];
  const frenchIndex = publicSurfaceLocaleOrder.indexOf("fr");
  const dutchIndex = publicSurfaceLocaleOrder.indexOf("nl");
  const italianIndex = publicSurfaceLocaleOrder.indexOf("it");

  for (const catalog of publicCatalogs) {
    for (const [source, translations] of Object.entries(catalog)) {
      if (!/\bfiles?\b/iu.test(source)) continue;
      const alsoDescribesARequestBrief = /\brequest briefs?\b/iu.test(source);
      if (!alsoDescribesARequestBrief) {
        assert.doesNotMatch(translations[frenchIndex], /\bdossiers?\b/iu, source);
        assert.doesNotMatch(translations[dutchIndex], /\bdossiers?\b/iu, source);
      }
      assert.doesNotMatch(translations[italianIndex], /\bfascicol/iu, source);
    }
  }

  const workflowFileRows = Object.entries(
    customerWorkflowExactTranslations,
  ).filter(([source]) => /\bfiles?\b/iu.test(source));
  for (const [source, translations] of workflowFileRows) {
    assert.doesNotMatch(
      translations[customerWorkflowLocaleOrder.indexOf("fr")],
      /\bdossiers?\b/iu,
      source,
    );
    assert.doesNotMatch(
      translations[customerWorkflowLocaleOrder.indexOf("nl")],
      /\bdossiers?\b/iu,
      source,
    );
    assert.doesNotMatch(
      translations[customerWorkflowLocaleOrder.indexOf("it")],
      /\bfascicol/iu,
      source,
    );
  }
});

test("workshop command desk is native copy in every supported locale", () => {
  const commandDesk = Object.fromEntries(
    Object.entries(exactTranslations)
      .filter(([locale]) => locale !== "en")
      .map(([locale, translations]) => [
        locale,
        translations["Workshop command desk"],
      ]),
  );
  const nativeWorkshopTerms = {
    de: /Werkstatt/u,
    tr: /(?:Atölye|Servis)/u,
    nl: /werkplaats/iu,
    fr: /atelier/iu,
    it: /officin/iu,
    ru: /мастерск/iu,
    es: /taller/iu,
    pt: /oficin/iu,
    zh: /维修厂/u,
    pl: /warsztat/iu,
    sq: /servis/iu,
  } as const;

  for (const [locale, pattern] of Object.entries(nativeWorkshopTerms)) {
    assert.equal(typeof commandDesk[locale], "string", locale);
    assert.match(commandDesk[locale], pattern, locale);
    assert.doesNotMatch(commandDesk[locale], /^Workshop Command Desk$/iu, locale);
  }
});

test("calibration service names keep literal Stage labels and automotive ECO meaning", () => {
  for (const source of [
    "Stage 3",
    "TCU Stage 1",
    "TCU Stage 2",
    "TCU Stage 3",
  ]) {
    for (const translation of customerWorkflowExactTranslations[source]) {
      assert.equal(translation, source, `${source}: ${translation}`);
    }
  }

  const ecoTuning = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["ECO Tuning"],
  );
  assert.equal(ecoTuning.it, "Taratura ECO");
  assert.equal(ecoTuning.es, "Calibración ECO");
  assert.equal(ecoTuning.tr, "ECO kalibrasyonu");
  assert.equal(ecoTuning.zh, "ECO 调校");
  assert.equal(ecoTuning.sq, "Kalibrim ECO");

  assert.equal(
    localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations["Gearbox Torque Limit Adjustment"],
    ).sq,
    "Rregullimi i kufirit të çift-rrotullimit të transmisionit",
  );
});

test("secure source download always identifies a source file rather than source code", () => {
  const sourceDownload = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations[
      "Secure source download could not be prepared."
    ],
  );
  const sourceFileTerms = {
    nl: /bronbestand/iu,
    de: /Quelldatei/iu,
    fr: /fichier source/iu,
    it: /file sorgente/iu,
    ru: /исходного файла/iu,
    es: /archivo de origen/iu,
    tr: /kaynak dosya/iu,
    pt: /ficheiro de origem/iu,
    zh: /源文件/u,
    pl: /pliku źródłowego/iu,
    sq: /skedarit burimor/iu,
  } as const;

  for (const [locale, pattern] of Object.entries(sourceFileTerms)) {
    assert.match(sourceDownload[locale], pattern, locale);
  }
  assert.doesNotMatch(
    Object.values(sourceDownload).join("\n"),
    /broncode|Quellcode|code source|codice sorgente|исходн(?:ый|ого) код|código fuente|kaynak kod|código-fonte|源代码|kod źródłowy|kod burimor/iu,
  );
});

test("French upload and download copy keeps the transfer direction distinct", () => {
  const frenchPublicIndex = publicSurfaceLocaleOrder.indexOf("fr");
  const frenchCustomerIndex = customerWorkflowLocaleOrder.indexOf("fr");
  const uploadCatalogs = [
    publicServicesTranslations,
    publicToolsTranslations,
  ] as const;

  for (const catalog of uploadCatalogs) {
    for (const [source, translations] of Object.entries(catalog)) {
      if (!/upload(?:ed|ing)?/iu.test(source) || /download/iu.test(source)) continue;
      assert.doesNotMatch(
        translations[frenchPublicIndex],
        /télécharg/iu,
        `upload direction regressed for: ${source}`,
      );
    }
  }

  for (const [source, translations] of Object.entries(
    customerWorkflowExactTranslations,
  )) {
    if (!/upload(?:ed|ing)?/iu.test(source) || /download/iu.test(source)) continue;
    assert.doesNotMatch(
      translations[frenchCustomerIndex],
      /télécharg/iu,
      `customer upload direction regressed for: ${source}`,
    );
  }

  assert.equal(
    customerWorkflowT("fr", "notificationAdditionalUploadTitle"),
    "Téléversement de fichier supplémentaire activé",
  );
  assert.equal(
    customerWorkflowExactTranslations["Download uploaded file"][
      frenchCustomerIndex
    ],
    "Télécharger le fichier téléversé",
  );
  assert.equal(
    customerWorkflowExactTranslations[
      "Secure source download could not be prepared."
    ][frenchCustomerIndex],
    "Le téléchargement sécurisé du fichier source n’a pas pu être préparé.",
  );
  assert.equal(
    publicServicesTranslations[
      "Customer downloads the modified file and can request revision if required."
    ][frenchPublicIndex],
    "Le client télécharge le fichier modifié et peut demander une révision si nécessaire.",
  );
});

test("Spanish datalog power checks use automotive power rather than energy", () => {
  const spanishIndex = publicSurfaceLocaleOrder.indexOf("es");
  const expected = {
    "Choose a local datalog for the quick power check":
      "Elija un datalog local para una comprobación rápida de potencia",
    "Local power snapshot": "Instantánea de potencia local",
    "Quick power check": "Comprobación rápida de potencia",
    "This file is too large for the quick power check. Export a text log up to 5 MB, or shorten the capture window.":
      "Este archivo es demasiado grande para la comprobación rápida de potencia. Exporte un datalog de texto de hasta 5 MB o acorte la ventana de captura.",
    "Turn a datalog into a quick power snapshot.":
      "Convierta un datalog en una instantánea rápida de potencia.",
  } as const;

  for (const [source, golden] of Object.entries(expected)) {
    const translation = publicToolsTranslations[source][spanishIndex];
    assert.equal(translation, golden, source);
    assert.match(translation, /potencia/iu, source);
    assert.doesNotMatch(translation, /energía/iu, source);
  }
});

test("public workshop tools description is native in every locale", () => {
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations[
        "Free browser-based preparation, calculation and log-analysis tools for automotive workshops."
      ],
    ),
    {
      de: "Kostenlose browserbasierte Werkzeuge zur Vorbereitung, Berechnung und Datalog-Analyse für Kfz-Werkstätten.",
      tr: "Otomotiv servisleri için ücretsiz, tarayıcı tabanlı hazırlık, hesaplama ve datalog analiz araçları.",
      nl: "Gratis browsertools voor voorbereiding, berekeningen en dataloganalyse in autowerkplaatsen.",
      fr: "Outils gratuits dans le navigateur pour la préparation, le calcul et l’analyse des datalogs en atelier automobile.",
      it: "Strumenti gratuiti nel browser per la preparazione, il calcolo e l’analisi dei datalog nelle officine automobilistiche.",
      es: "Herramientas gratuitas en el navegador para la preparación, el cálculo y el análisis de datalogs en talleres de automoción.",
      pt: "Ferramentas gratuitas no navegador para preparação, cálculo e análise de datalogs em oficinas automóveis.",
      pl: "Bezpłatne narzędzia przeglądarkowe do przygotowania, obliczeń i analizy logów dla warsztatów samochodowych.",
      ru: "Бесплатные браузерные инструменты для подготовки, расчётов и анализа логов в автосервисах.",
      zh: "面向汽车维修厂的免费浏览器工具，用于准备、计算和数据日志分析。",
      sq: "Mjete falas në shfletues për përgatitje, llogaritje dhe analizë të datalogëve në serviset automobilistike.",
    },
  );
});

test("Stage 1 datalog guidance keeps native grammar and the literal stage token", () => {
  const questionSource = "Do I need logs for a Stage 1 file request?";
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicServicesTranslations[questionSource],
    ),
    {
      de: "Benötige ich Datalogs für eine Dateianfrage zu Stage 1?",
      tr: "Stage 1 dosya talebi için datalog gerekli mi?",
      nl: "Heb ik datalogs nodig voor een Stage 1-bestandsaanvraag?",
      fr: "Ai-je besoin de datalogs pour une demande de fichier Stage 1 ?",
      it: "Servono datalog per una richiesta di file Stage 1?",
      es: "¿Necesito datalogs para una solicitud de archivo Stage 1?",
      pt: "São necessários datalogs para um pedido de ficheiro Stage 1?",
      pl: "Czy do zlecenia pliku Stage 1 potrzebne są logi?",
      ru: "Нужны ли логи для заявки на файл Stage 1?",
      zh: "Stage 1 文件请求需要数据日志吗？",
      sq: "A nevojiten datalogë për një kërkesë skedari Stage 1?",
    },
  );
  for (const translation of publicServicesTranslations[questionSource]) {
    assert.match(translation, /Stage 1/u, translation);
  }

  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicServicesTranslations[
        "Not every standard request needs a log before review, but current fault codes and useful workshop observations should be supplied. Logs are important when measured behaviour or a revision needs evidence."
      ],
    ),
    {
      de: "Nicht für jede Standardanfrage wird vor der Prüfung ein Datalog benötigt. Aktuelle Fehlercodes und relevante Werkstattbeobachtungen sollten jedoch mitgesendet werden. Datalogs sind wichtig, wenn Messwerte oder eine Revision belegt werden müssen.",
      tr: "Her standart talep için inceleme öncesinde datalog gerekmez; ancak güncel arıza kodları ve ilgili servis gözlemleri paylaşılmalıdır. Ölçülen davranışın veya bir revizyon talebinin kanıtlanması gerektiğinde dataloglar önemlidir.",
      nl: "Niet voor elke standaardaanvraag is vóór de beoordeling een datalog nodig. Stuur wel actuele foutcodes en relevante werkplaatsbevindingen mee. Datalogs zijn belangrijk wanneer gemeten gedrag of een revisie met gegevens moet worden onderbouwd.",
      fr: "Toutes les demandes standard ne nécessitent pas de datalog avant examen. Il faut toutefois fournir les codes défaut actuels et les observations utiles de l’atelier. Les datalogs sont importants lorsqu’un comportement mesuré ou une demande de révision doit être étayé.",
      it: "Non tutte le richieste standard richiedono un datalog prima della verifica. È comunque necessario fornire i codici guasto attuali e le osservazioni utili dell’officina. I datalog sono importanti quando occorre documentare un comportamento misurato o motivare una revisione.",
      es: "No todas las solicitudes estándar requieren un datalog antes de la revisión. Aun así, deben facilitarse los códigos de avería actuales y las observaciones útiles del taller. Los datalogs son importantes cuando hay que respaldar un comportamiento medido o una revisión.",
      pt: "Nem todos os pedidos padrão precisam de um datalog antes da revisão, mas devem incluir os códigos de avaria atuais e observações úteis da oficina. Os datalogs são importantes quando é necessário documentar o comportamento medido ou fundamentar uma revisão.",
      pl: "Nie każde standardowe zlecenie wymaga logu przed weryfikacją, ale należy przekazać aktualne kody usterek i istotne obserwacje warsztatu. Logi są ważne, gdy trzeba udokumentować zmierzone zachowanie lub uzasadnić korektę.",
      ru: "Не для каждой стандартной заявки нужен лог до проверки, однако следует передать актуальные коды неисправностей и полезные наблюдения сервиса. Логи важны, когда требуется подтвердить измеренное поведение или обосновать доработку.",
      zh: "并非每个标准请求在审核前都需要数据日志，但应提供当前故障码和有用的维修厂观察信息。当需要用数据证明实测表现或修改请求时，数据日志很重要。",
      sq: "Jo çdo kërkesë standarde ka nevojë për datalog para shqyrtimit, por duhet të jepen kodet aktuale të defekteve dhe vëzhgimet e dobishme të servisit. Datalogët janë të rëndësishëm kur duhet të dokumentohet sjellja e matur ose të argumentohet një rishikim.",
    },
  );
});

test("public service catalog copy is not mistranslated as a government service", () => {
  const question = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "Does this public service page upload or modify files?"
    ],
  );
  assert.deepEqual(question, {
    de: "Werden auf dieser öffentlich zugänglichen Serviceseite Dateien hochgeladen oder bearbeitet?",
    tr: "Bu herkese açık hizmet sayfası dosyaları sunucuya yükler ya da değiştirir mi?",
    nl: "Uploadt of wijzigt deze openbaar toegankelijke servicepagina bestanden?",
    fr: "Cette page de service accessible au public téléverse-t-elle ou modifie-t-elle des fichiers ?",
    it: "Questa pagina di servizio accessibile al pubblico carica o modifica file?",
    es: "¿Esta página de servicio de acceso público carga o modifica archivos?",
    pt: "Esta página de serviço de acesso público carrega ou modifica ficheiros?",
    pl: "Czy ta publicznie dostępna strona usługi przesyła lub modyfikuje pliki?",
    ru: "Загружает или изменяет файлы эта общедоступная страница услуги?",
    zh: "此公开服务页面会上传或修改文件吗？",
    sq: "A ngarkon ose modifikon skedarë kjo faqe shërbimi e aksesueshme publikisht?",
  });

  const answer = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "No. This is a public service catalog. File upload, payment, request status and delivery happen only inside the authenticated customer portal."
    ],
  );
  assert.deepEqual(answer, {
    de: "Nein. Dies ist ein öffentlich zugänglicher Leistungskatalog. Dateiupload, Zahlung, Auftragsstatus und Auslieferung erfolgen ausschließlich im angemeldeten Kundenportal.",
    tr: "Hayır. Bu, herkese açık bir hizmet kataloğudur. Dosya yükleme, ödeme, talep durumu takibi ve teslimat yalnızca oturum açılmış müşteri portalında gerçekleşir.",
    nl: "Nee. Dit is een openbaar toegankelijke dienstencatalogus. Bestanden uploaden, betalen, de aanvraagstatus volgen en bestanden ontvangen gebeuren uitsluitend in het geauthenticeerde klantenportaal.",
    fr: "Non. Il s’agit d’un catalogue de services accessible au public. Le téléversement de fichiers, le paiement, le suivi des demandes et la livraison s’effectuent uniquement dans le portail client authentifié.",
    it: "No. Questo è un catalogo di servizi accessibile al pubblico. Il caricamento dei file, il pagamento, lo stato della richiesta e la consegna avvengono esclusivamente nel portale clienti autenticato.",
    es: "No. Este es un catálogo de servicios de acceso público. La carga de archivos, el pago, el seguimiento de solicitudes y la entrega se realizan únicamente en el portal de clientes autenticado.",
    pt: "Não. Este é um catálogo de serviços acessível ao público. O carregamento de ficheiros, o pagamento, o acompanhamento do pedido e a entrega ocorrem apenas no portal autenticado do cliente.",
    pl: "Nie. To jest publicznie dostępny katalog usług. Przesyłanie plików, płatności, śledzenie statusu zlecenia i dostawa odbywają się wyłącznie w uwierzytelnionym portalu klienta.",
    ru: "Нет. Это общедоступный каталог услуг. Загрузка файлов, оплата, отслеживание статуса заявки и доставка выполняются только в авторизованном клиентском портале.",
    zh: "不是。这是公开展示的服务目录。文件上传、付款、请求状态跟踪和交付仅在经过身份验证的客户门户中进行。",
    sq: "Jo. Ky është një katalog shërbimesh i aksesueshëm publikisht. Ngarkimi i skedarëve, pagesa, ndjekja e statusit të kërkesës dhe dorëzimi kryhen vetëm në portalin e autentifikuar të klientit.",
  });
  assert.doesNotMatch(
    [answer.tr, answer.ru, answer.zh].join("\n"),
    /kamu hizmeti|государственных услуг|公益/u,
  );
});

test("reviewed service workflow labels keep native case, articles and logic", () => {
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicServicesTranslations["Modified file delivery"],
    ),
    {
      de: "Auslieferung der bearbeiteten Datei",
      tr: "Düzenlenmiş dosyanın teslimi",
      nl: "Levering van het gewijzigde bestand",
      fr: "Livraison du fichier modifié",
      it: "Consegna del file modificato",
      es: "Entrega del archivo modificado",
      pt: "Entrega do ficheiro modificado",
      pl: "Dostarczenie zmodyfikowanego pliku",
      ru: "Доставка модифицированного файла",
      zh: "已修改文件交付",
      sq: "Dorëzimi i skedarit të modifikuar",
    },
  );
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicServicesTranslations[
        "MG AutoTech workshop file-service search routes"
      ],
    ),
    {
      de: "Suchpfade für MG AutoTech Werkstatt-Fileservices",
      tr: "MG AutoTech servis dosya hizmetleri arama yolları",
      nl: "Zoekpaden voor de MG AutoTech-bestandsservice voor werkplaatsen",
      fr: "Parcours de recherche des services de fichiers MG AutoTech pour ateliers",
      it: "Percorsi di ricerca dei servizi file MG AutoTech per officine",
      es: "Rutas de búsqueda de servicios de archivos de MG AutoTech para talleres",
      pt: "Percursos de pesquisa dos serviços de ficheiros MG AutoTech para oficinas",
      pl: "Ścieżki wyszukiwania usług plikowych MG AutoTech dla warsztatów",
      ru: "Маршруты поиска файловых услуг MG AutoTech для автосервисов",
      zh: "MG AutoTech 维修厂文件服务搜索入口",
      sq: "Rrugët e kërkimit të shërbimeve të skedarëve MG AutoTech për servise",
    },
  );

  const infoNeeded = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "The order can be marked as customer info needed so the workshop knows exactly what to provide."
    ],
  );
  assert.equal(
    infoNeeded.fr,
    "La commande peut être marquée « Informations client requises » afin que l’atelier sache exactement quoi fournir.",
  );
  assert.equal(
    infoNeeded.it,
    "L’ordine può essere contrassegnato come «Informazioni del cliente necessarie», così l’officina sa esattamente cosa fornire.",
  );
  assert.equal(
    infoNeeded.es,
    "El pedido puede marcarse como «Información del cliente necesaria» para que el taller sepa exactamente qué debe facilitar.",
  );
  assert.equal(
    infoNeeded.ru,
    "Заказ можно пометить статусом «Требуется информация от клиента», чтобы в мастерской точно знали, что нужно предоставить.",
  );
  assert.equal(
    infoNeeded.sq,
    "Porosia mund të shënohet si «Nevojitet informacion nga klienti», në mënyrë që servisi të dijë saktësisht çfarë duhet të ofrojë.",
  );

  const completeWorkflow = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "MG AutoTech keeps the complete workflow in the customer portal: submit the untouched original ECU file, record the read method and technical notes, follow customer-visible status, download delivered versions and request a revision when testing or logging provides useful evidence."
    ],
  );
  assert.equal(
    completeWorkflow.tr,
    "MG AutoTech tüm iş akışını müşteri portalında tutar: değiştirilmemiş orijinal ECU dosyasını gönderin, okuma yöntemini ve teknik notları kaydedin, müşteriye gösterilen durumu takip edin, teslim edilen sürümleri indirin ve testler veya dataloglar yararlı kanıt sunduğunda revizyon talep edin.",
  );
  assert.equal(
    completeWorkflow.it,
    "MG AutoTech mantiene l’intero flusso di lavoro nel portale cliente: invia il file ECU originale non modificato, registra il metodo di lettura e le note tecniche, segui lo stato visibile al cliente, scarica le versioni consegnate e richiedi una revisione quando i test o i datalog forniscono elementi utili.",
  );
  assert.equal(
    completeWorkflow.es,
    "MG AutoTech mantiene todo el flujo de trabajo en el portal del cliente: envíe el archivo ECU original sin modificar, registre el método de lectura y las notas técnicas, siga el estado visible para el cliente, descargue las versiones entregadas y solicite una revisión cuando las pruebas o los datalogs aporten información útil.",
  );
  assert.equal(
    completeWorkflow.ru,
    "MG AutoTech ведёт весь рабочий процесс в клиентском портале: отправьте неизменённый исходный файл ECU, укажите метод чтения и технические примечания, отслеживайте видимый клиенту статус, скачивайте выданные версии и запрашивайте доработку, если тесты или логи дают полезные данные.",
  );
  assert.equal(
    completeWorkflow.sq,
    "MG AutoTech e mban të gjithë procesin në portalin e klientit: dërgoni skedarin origjinal të pandryshuar të ECU-së, shënoni metodën e leximit dhe vërejtjet teknike, ndiqni statusin e dukshëm për klientin, shkarkoni versionet e dorëzuara dhe kërkoni rishikim kur testet ose datalogët japin prova të dobishme.",
  );
});

test("French ECU articles and completed-delivery heading stay grammatical", () => {
  const frenchIndex = publicSurfaceLocaleOrder.indexOf("fr");
  const frenchPublicCopy = [
    ...Object.values(publicServicesTranslations),
    ...Object.values(publicToolsTranslations),
    ...Object.values(publicVehicleTranslations),
  ]
    .map((translations) => translations[frenchIndex])
    .join("\n");
  assert.doesNotMatch(frenchPublicCopy, /\bdu ECU\b/u);
  assert.equal(
    exactTranslations.fr["Completed File Delivery"],
    "Livraison du fichier finalisé",
  );
});

test("delivery copy preserves customer-facing direction and download action", () => {
  const delivered = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations[
      "Your delivered file is available in the Files & delivery panel through a secure temporary download link."
    ],
  );
  assert.equal(
    delivered.ru,
    "Доставленный вам файл доступен на панели «Файлы и доставка» по защищённой временной ссылке для скачивания.",
  );
  assert.equal(
    delivered.tr,
    "Teslim edilen dosyanıza, Dosyalar ve teslimat panelindeki güvenli geçici indirme bağlantısından ulaşabilirsiniz.",
  );
  assert.equal(
    delivered.zh,
    "交付给您的文件可在“文件与交付”面板中通过安全的临时下载链接获取。",
  );

  assert.equal(
    localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations[
        "Your modified file is ready to download."
      ],
    ).ru,
    "Ваш изменённый файл готов к скачиванию.",
  );
});

test("readout and virtual-read labels use automotive read terminology", () => {
  const readout = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["Readout Verification"],
  );
  assert.equal(readout.ru, "Проверка считывания");
  assert.equal(readout.zh, "读取验证");

  const virtualRead = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["Virtual Read"],
  );
  assert.equal(virtualRead.nl, "Virtueel uitlezen");
  assert.equal(virtualRead.de, "Virtuelles Auslesen");
  assert.equal(virtualRead.zh, "虚拟读取");
  assert.equal(virtualRead.pl, "Wirtualny odczyt");
});

test("vehicle and controller identification never becomes personal identity", () => {
  const supportCopy = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations[
      "Exact vehicle and controller support is confirmed from the submitted identity, source file, read method and request context."
    ],
  );
  const automotiveTerms = {
    de: [/Steuergerät/iu, /Identifikationsdaten/iu],
    fr: [/calculateur/iu, /données d.identification/iu],
    it: [/centralina/iu, /dati identificativi/iu],
    es: [/unidad de control/iu, /datos de identificación/iu],
    tr: [/kontrol ünitesi/iu, /tanımlama bilgileri/iu],
    zh: [/控制单元/u, /识别信息/u],
    pl: [/sterownik/iu, /danych identyfikacyjnych/iu],
  } as const;

  for (const [locale, patterns] of Object.entries(automotiveTerms)) {
    for (const pattern of patterns) {
      assert.match(supportCopy[locale], pattern, locale);
    }
  }
  assert.doesNotMatch(
    Object.values(supportCopy).join("\n"),
    /\bIdentität\b|\bidentité\b|\bidentità\b|\bidentidad\b|\bkimlik\b|身份|tożsamość|\bidentiteit\b|\bidentidade\b|\bidentitet\b/iu,
  );
});

test("request entities and order-status labels stay consistent in key locales", () => {
  const exactRequestSources = [
    "Request closed",
    "Request Created",
    "Request received",
    "Your request is being processed. Status and delivery updates will appear here automatically.",
  ];
  const requestTerms = {
    nl: /aanvra(?:ag|gen)/iu,
    ru: /заяв(?:к|ок)/iu,
    tr: /tale[bp]/iu,
    pl: /zlece[nń]/iu,
  } as const;

  const auditedLocales = ["nl", "ru", "tr", "pl"] as const;
  for (const source of exactRequestSources) {
    const translations = localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations[source],
    );
    for (const locale of auditedLocales) {
      const pattern = requestTerms[locale];
      assert.match(translations[locale], pattern, `${source} (${locale})`);
    }
  }
  for (const key of [
    "requestCount",
    "createSimilarRequest",
    "lastRequest",
    "fallbackRequest",
  ] as const) {
    for (const locale of auditedLocales) {
      assert.match(
        customerWorkflowT(locale, key, {
          total: 2,
          pageSize: 1,
          vehicle: "BMW",
          date: "2026-08-30",
        }),
        requestTerms[locale],
        `${key} (${locale})`,
      );
    }
  }

  const orderStatus = Object.fromEntries(
    auditedLocales.map((locale) => [
      locale,
      customerWorkflowT(locale, "notificationTypeOrderStatus"),
    ]),
  );
  const orderStatusUpdated = Object.fromEntries(
    auditedLocales.map((locale) => [
      locale,
      customerWorkflowT(locale, "notificationOrderStatusTitle"),
    ]),
  );
  assert.equal(orderStatus.nl, "Orderstatus");
  assert.equal(orderStatusUpdated.nl, "Orderstatus bijgewerkt");
  assert.equal(orderStatus.ru, "Статус заказа");
  assert.equal(orderStatusUpdated.ru, "Статус заказа обновлён");
  assert.equal(orderStatus.tr, "Sipariş durumu");
  assert.equal(orderStatusUpdated.tr, "Sipariş durumu güncellendi");
  assert.equal(orderStatus.pl, "Status zlecenia");
  assert.equal(orderStatusUpdated.pl, "Status zlecenia zaktualizowany");
});

test("platform Credits remain units rather than bank loans or purchases on credit", () => {
  const workflowCreditRows = Object.entries(
    customerWorkflowExactTranslations,
  ).filter(
    ([source]) => /\bcredits?\b/iu.test(source) && !/credit card/iu.test(source),
  );
  assert.ok(workflowCreditRows.length >= 10);
  for (const [source, translations] of workflowCreditRows) {
    const localized = localizedRecord(customerWorkflowLocaleOrder, translations);
    assert.doesNotMatch(localized.nl, /\bkrediet(?:en)?\b/iu, source);
    assert.doesNotMatch(localized.de, /\bKredit(?:e|en)?\b/u, source);
  }

  const buyMoreCredits = {
    fr: exactTranslations.fr["Buy More Credits"],
    it: exactTranslations.it["Buy More Credits"],
    es: exactTranslations.es["Buy More Credits"],
    ru: exactTranslations.ru["Buy More Credits"],
    sq: exactTranslations.sq["Buy More Credits"],
  };
  assert.deepEqual(buyMoreCredits, {
    fr: "Acheter plus de crédits",
    it: "Compra altri crediti",
    es: "Comprar más créditos",
    ru: "Купить больше кредитов",
    sq: "Bli më shumë kredite",
  });
  assert.equal(
    localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations[
        "The selected credit total could not be verified."
      ],
    ).pl,
    "Nie udało się zweryfikować wybranej łącznej kwoty za kredyty.",
  );
});

test("public preparation tools preserve original-file grammar and platform-credit meaning", () => {
  const originalFileSources = [
    "A modified-only file is not ideal. An original file is usually required for a clean workflow.",
    "No request should be submitted without the original file.",
    "Open the secure request form and upload the original file through your account.",
    "Safety note: original file will be uploaded only through the secure MG AutoTech request form.",
    "Prepare full vehicle details, the original read file, a clear service description, notes about hardware or symptoms, and payment or credits if required.",
  ] as const;

  for (const source of originalFileSources) {
    const localized = localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations[source],
    );
    const combined = Object.values(localized).join("\n");

    assert.doesNotMatch(
      combined,
      /Original-Datei|originale bestand|l['’]file|oryginalnego plik|оригинального файл(?!а)|原始\s+文件|文件\s+[。，]|skedar origjinal/iu,
      source,
    );
  }

  const creditBalance = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "Check your credit balance or payment method before final submission."
    ],
  );
  assert.equal(creditBalance.de, "Prüfen Sie vor dem endgültigen Absenden Ihr Guthaben an Credits oder Ihre Zahlungsmethode.");
  assert.equal(creditBalance.nl, "Controleer vóór de definitieve verzending uw saldo aan credits of uw betaalmethode.");
  assert.equal(creditBalance.pt, "Verifique o seu saldo de créditos ou o seu método de pagamento antes do envio final.");
  assert.equal(creditBalance.pl, "Przed ostatecznym wysłaniem sprawdź saldo kredytów lub metodę płatności.");
  assert.equal(creditBalance.zh, "最终提交前，请检查您的积分余额或付款方式。");
  assert.doesNotMatch(creditBalance.nl, /\bkrediet(?:en)?\b/iu);

  const requestReady = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "Create the file-service request only when your information, file and credit confirmation are ready."
    ],
  );
  assert.doesNotMatch(requestReady.de, /Kreditbestätigung/u);
  assert.doesNotMatch(requestReady.nl, /kredietbevestiging/iu);
  assert.equal(
    requestReady.tr,
    "Dosya hizmeti talebini yalnızca bilgileriniz ve dosyanız hazır, kredi bakiyeniz de doğrulanmış olduğunda oluşturun.",
  );
  assert.match(requestReady.pt, /saldo de créditos/iu);
  assert.match(requestReady.ru, /баланса кредитов/iu);

  const uploadInstruction = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "Open the secure request form and upload the original file through your account."
    ],
  );
  const uploadSafetyNote = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "Safety note: original file will be uploaded only through the secure MG AutoTech request form."
    ],
  );
  assert.match(uploadInstruction.fr, /téléversez/iu);
  assert.match(uploadSafetyNote.fr, /téléversé/iu);
  assert.doesNotMatch(uploadInstruction.fr, /téléchargez/iu);
  assert.doesNotMatch(uploadSafetyNote.fr, /téléchargé/iu);

  assert.match(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations[
        "Prepare full vehicle details, the original read file, a clear service description, notes about hardware or symptoms, and payment or credits if required."
      ],
    ).tr,
    /^Eksiksiz araç bilgilerini/u,
  );
});

test("File Expert branding and file/archive distinctions stay intentional", () => {
  const fileExpertRows = Object.entries(customerWorkflowExactTranslations).filter(
    ([source]) => /\bFile Expert\b/u.test(source),
  );
  assert.ok(fileExpertRows.length >= 2);
  for (const [source, translations] of fileExpertRows) {
    for (const translation of translations) {
      assert.match(translation, /\bFile Expert\b/u, source);
    }
  }

  const fileCheck = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["File Check"],
  );
  assert.equal(fileCheck.fr, "Vérification du fichier");
  assert.equal(fileCheck.es, "Verificación del archivo");
  assert.equal(
    localizedRecord(
      customerWorkflowLocaleOrder,
      customerWorkflowExactTranslations["Download uploaded file"],
    ).fr,
    "Télécharger le fichier téléversé",
  );

  const orderArchive = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations[
      "Order archive could not be synced. Please try again."
    ],
  );
  const archiveTerms = {
    nl: /orderarchief/iu,
    de: /Auftragsarchiv/iu,
    fr: /archive des commandes/iu,
    it: /archivio degli ordini/iu,
    ru: /архив заказов/iu,
    es: /archivo de pedidos/iu,
    tr: /sipariş arşivi/iu,
    pt: /arquivo de pedidos/iu,
    zh: /订单存档/u,
    pl: /archiwum zleceń/iu,
    sq: /arkivi i porosi(?:së|ve)/iu,
  } as const;
  for (const [locale, pattern] of Object.entries(archiveTerms)) {
    assert.match(orderArchive[locale], pattern, locale);
  }
});

test("service selection and Russian invoice details retain their exact meaning", () => {
  const serviceNotSet = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["Service not set"],
  );
  const notSelectedTerms = {
    nl: /geen service geselecteerd/iu,
    de: /nicht ausgewählt/iu,
    fr: /non sélectionné/iu,
    it: /non selezionato/iu,
    ru: /не выбрана/iu,
    es: /no seleccionado/iu,
    tr: /seçilmedi/iu,
    pt: /não selecionado/iu,
    zh: /未选择/u,
    pl: /nie wybrano/iu,
    sq: /nuk është zgjedhur/iu,
  } as const;
  for (const [locale, pattern] of Object.entries(notSelectedTerms)) {
    assert.match(serviceNotSet[locale], pattern, locale);
  }

  assert.equal(
    localizedRecord(
      customerRuntimeLocaleOrder,
      customerRuntimeTranslations[
        "Invoice details can be completed now or later in account settings."
      ],
    ).ru,
    "Данные для выставления счёта можно заполнить сейчас или позже в настройках аккаунта.",
  );
});

test("ECU read guidance preserves Bench and Boot as technical access modes", () => {
  const advisorHero = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "Plan safer ECU or TCU read preparation before submitting a request. Get a practical checklist for OBD, bench, boot or unknown read situations without opening or uploading a file."
    ],
  );

  for (const [locale, translation] of Object.entries(advisorHero)) {
    assert.match(translation, /\bBench\b/u, `${locale}: Bench`);
    assert.match(translation, /\bBoot\b/u, `${locale}: Boot`);
  }

  const modifiedFile = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations["Only a modified file is available"],
  );
  assert.equal(modifiedFile.de, "Nur eine modifizierte Datei ist verfügbar");
  assert.equal(modifiedFile.nl, "Er is alleen een aangepast bestand beschikbaar");

  const gearboxFile = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations["TCU / gearbox file"],
  );
  assert.equal(gearboxFile.de, "TCU-/Getriebedatei");
  assert.equal(gearboxFile.tr, "TCU / şanzıman dosyası");
  assert.equal(gearboxFile.nl, "TCU-/versnellingsbakbestand");
  assert.equal(gearboxFile.fr, "Fichier TCU / boîte de vitesses");
  assert.equal(gearboxFile.ru, "Файл TCU / коробки передач");
  assert.equal(gearboxFile.zh, "TCU / 变速箱文件");
});

test("public file workflow copy keeps delivery and read-method terminology exact", () => {
  const noUpload = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "No upload should be started until a valid file or verified read plan exists."
    ],
  );
  assert.equal(
    noUpload.nl,
    "Start geen upload voordat er een geldig bestand of een geverifieerd leesplan beschikbaar is.",
  );
  assert.equal(
    noUpload.it,
    "Non avviare alcun caricamento finché non è disponibile un file valido o un piano di lettura verificato.",
  );
  assert.equal(
    noUpload.pl,
    "Nie rozpoczynaj przesyłania, dopóki nie będzie dostępny prawidłowy plik lub zweryfikowany plan odczytu.",
  );
  assert.equal(
    noUpload.zh,
    "在获得有效文件或经过验证的读取方案之前，请勿开始上传。",
  );
  assert.equal(
    noUpload.sq,
    "Mos filloni asnjë ngarkim derisa të jetë i disponueshëm një skedar i vlefshëm ose një plan i verifikuar leximi.",
  );

  const delivered = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "The completed file is delivered in the dashboard, not through uncontrolled email attachments."
    ],
  );
  assert.equal(
    delivered.nl,
    "Het voltooide bestand wordt via het dashboard geleverd, niet via ongecontroleerde e-mailbijlagen.",
  );
  assert.equal(
    delivered.pl,
    "Gotowy plik jest dostarczany w panelu, a nie w niekontrolowanych załącznikach e-mail.",
  );
  assert.equal(
    delivered.ru,
    "Готовый файл доставляется через панель управления, а не через неконтролируемые вложения электронной почты.",
  );
  assert.equal(
    delivered.zh,
    "完成的文件会在控制面板中交付，而不会通过不受控的电子邮件附件发送。",
  );
  assert.equal(
    delivered.sq,
    "Skedari i përfunduar dorëzohet në panel, jo përmes bashkëngjitjeve të pakontrolluara të postës elektronike.",
  );

  const uploadedBack = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "The completed file is uploaded back to the order with status and version visibility for the customer."
    ],
  );
  assert.equal(
    uploadedBack.nl,
    "Het voltooide bestand wordt terug naar de bestelling geüpload, waarbij de klant de status en versie kan zien.",
  );
  assert.equal(
    uploadedBack.it,
    "Il file completato viene caricato nuovamente nell’ordine, con stato e versione visibili al cliente.",
  );
  assert.equal(
    uploadedBack.pl,
    "Gotowy plik jest ponownie przesyłany do zlecenia, a klient widzi jego status i wersję.",
  );
  assert.equal(
    uploadedBack.ru,
    "Готовый файл загружается обратно в заказ, при этом клиент видит его статус и версию.",
  );
  assert.equal(
    uploadedBack.zh,
    "完成的文件会上传回订单，客户可以查看其状态和版本。",
  );
  assert.equal(
    uploadedBack.sq,
    "Skedari i përfunduar ngarkohet përsëri te porosia, ndërsa klienti mund të shohë statusin dhe versionin e tij.",
  );

  const completedModified = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "The completed modified file is delivered in the order detail view. If needed, the customer can request a revision."
    ],
  );
  assert.equal(
    completedModified.de,
    "Die fertig bearbeitete Datei wird in der Bestelldetailansicht bereitgestellt. Bei Bedarf kann der Kunde eine Revision anfordern.",
  );
  assert.equal(
    completedModified.nl,
    "Het voltooide, aangepaste bestand wordt in de detailweergave van de bestelling geleverd. Indien nodig kan de klant een revisie aanvragen.",
  );
  assert.equal(
    completedModified.it,
    "Il file modificato, una volta completato, viene consegnato nella pagina dei dettagli dell'ordine. Se necessario, il cliente può richiedere una revisione.",
  );
  assert.equal(
    completedModified.sq,
    "Skedari i modifikuar i përfunduar dorëzohet në faqen e detajeve të porosisë. Nëse është e nevojshme, klienti mund të kërkojë një rishikim.",
  );

  const originalEcuUpload = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "The customer uploads the original ECU file through the secure portal so the request stays connected to the correct account."
    ],
  );
  assert.equal(
    originalEcuUpload.de,
    "Der Kunde lädt die originale ECU-Datei über das sichere Portal hoch, damit die Anfrage mit dem richtigen Konto verknüpft bleibt.",
  );
  assert.equal(
    originalEcuUpload.nl,
    "De klant uploadt het originele ECU-bestand via het beveiligde portaal, zodat de aanvraag aan het juiste account gekoppeld blijft.",
  );
  assert.equal(
    originalEcuUpload.fr,
    "Le client téléverse le fichier ECU d'origine via le portail sécurisé afin que la demande reste associée au bon compte.",
  );
  assert.equal(
    originalEcuUpload.it,
    "Il cliente carica il file ECU originale tramite il portale sicuro, in modo che la richiesta rimanga associata all'account corretto.",
  );
  assert.equal(
    originalEcuUpload.es,
    "El cliente carga el archivo ECU original a través del portal seguro para que la solicitud permanezca vinculada a la cuenta correcta.",
  );
  assert.equal(
    originalEcuUpload.pl,
    "Klient przesyła oryginalny plik ECU przez bezpieczny portal, dzięki czemu zgłoszenie pozostaje powiązane z właściwym kontem.",
  );
  assert.equal(
    originalEcuUpload.sq,
    "Klienti ngarkon skedarin origjinal të ECU-së përmes portalit të sigurt, në mënyrë që kërkesa të mbetet e lidhur me llogarinë e duhur.",
  );

  const reviewConfirmation = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "The file and notes are reviewed to confirm the request can continue."
    ],
  );
  assert.equal(
    reviewConfirmation.nl,
    "Het bestand en de notities worden beoordeeld om te bevestigen dat de aanvraag kan worden voortgezet.",
  );
  assert.equal(
    reviewConfirmation.it,
    "Il file e le note vengono esaminati per confermare che la richiesta possa proseguire.",
  );
  assert.equal(
    reviewConfirmation.pl,
    "Plik i notatki są sprawdzane, aby potwierdzić, że zgłoszenie może być dalej realizowane.",
  );
  assert.equal(
    reviewConfirmation.ru,
    "Файл и примечания проверяются, чтобы подтвердить, что работа по запросу может быть продолжена.",
  );
  assert.equal(
    reviewConfirmation.zh,
    "对文件和备注进行审核，以确认该请求可以继续处理。",
  );
  assert.equal(
    reviewConfirmation.sq,
    "Skedari dhe shënimet shqyrtohen për të konfirmuar se kërkesa mund të vazhdojë.",
  );

  const finalFile = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "The final file is delivered in the order detail page with version history when applicable."
    ],
  );
  assert.equal(
    finalFile.de,
    "Die endgültige Datei wird auf der Bestelldetailseite bereitgestellt, gegebenenfalls mit Versionsverlauf.",
  );
  assert.equal(
    finalFile.nl,
    "Het definitieve bestand wordt op de detailpagina van de bestelling geleverd, indien van toepassing met versiegeschiedenis.",
  );
  assert.equal(
    finalFile.it,
    "Il file finale viene consegnato nella pagina dei dettagli dell'ordine, con la cronologia delle versioni quando applicabile.",
  );
  assert.equal(
    finalFile.pl,
    "Plik końcowy jest udostępniany na stronie szczegółów zamówienia, a w stosownych przypadkach także z historią wersji.",
  );
  assert.equal(
    finalFile.ru,
    "Итоговый файл предоставляется на странице сведений о заказе, а при наличии также отображается история версий.",
  );
  assert.equal(
    finalFile.zh,
    "最终文件会在订单详情页交付，并在适用时显示版本历史记录。",
  );
  assert.equal(
    finalFile.sq,
    "Skedari përfundimtar dorëzohet në faqen e detajeve të porosisë, së bashku me historikun e versioneve kur është i disponueshëm.",
  );

  const sourceReview = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "The original file and request details are reviewed before the modified file is prepared."
    ],
  );
  assert.equal(
    sourceReview.de,
    "Die Originaldatei und die Anfragedetails werden geprüft, bevor die modifizierte Datei vorbereitet wird.",
  );
  assert.equal(
    sourceReview.nl,
    "Het originele bestand en de aanvraaggegevens worden beoordeeld voordat het gewijzigde bestand wordt voorbereid.",
  );
  assert.equal(
    sourceReview.it,
    "Il file originale e i dettagli della richiesta vengono esaminati prima di preparare il file modificato.",
  );
  assert.equal(
    sourceReview.pl,
    "Oryginalny plik i szczegóły zgłoszenia są sprawdzane przed przygotowaniem zmodyfikowanego pliku.",
  );
  assert.equal(
    sourceReview.ru,
    "Исходный файл и детали запроса проверяются перед подготовкой модифицированного файла.",
  );
  assert.equal(
    sourceReview.zh,
    "准备修改后的文件之前，会审核原始文件和请求详情。",
  );
  assert.equal(
    sourceReview.sq,
    "Skedari origjinal dhe detajet e kërkesës shqyrtohen përpara se të përgatitet skedari i modifikuar.",
  );

  const advisor = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations["ECU Read Method Advisor"],
  );
  assert.equal(advisor.de, "Berater für ECU-Auslesemethoden");
  assert.equal(advisor.fr, "Guide du choix de la méthode de lecture ECU");
  assert.equal(advisor.it, "Guida al metodo di lettura ECU");
  assert.equal(advisor.es, "Asesor de métodos de lectura de la ECU");
  assert.equal(advisor.pl, "Doradca wyboru metody odczytu ECU");
  assert.equal(advisor.ru, "Помощник по выбору метода чтения ECU");
  assert.equal(advisor.sq, "Këshilltar për metodën e leximit të ECU-së");

  const benchBootRead = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations["Bench/boot read"],
  );
  assert.equal(benchBootRead.de, "Bench-/Boot-Auslesen");
  assert.equal(benchBootRead.nl, "Bench-/boot-uitlezing");
  assert.equal(benchBootRead.it, "Lettura Bench/boot");
  assert.equal(benchBootRead.es, "Lectura Bench/boot");
  assert.equal(benchBootRead.pl, "Odczyt Bench/boot");
  assert.equal(benchBootRead.ru, "Чтение в режиме Bench/boot");
  assert.equal(benchBootRead.sq, "Lexim Bench/boot");
});

test("public datalog copy keeps automotive power semantics in every locale", () => {
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations["Your public power result"],
    ),
    {
      de: "Ihr öffentliches Leistungsergebnis",
      tr: "Herkese açık güç sonucunuz",
      nl: "Uw openbare vermogensresultaat",
      fr: "Votre résultat public de puissance",
      it: "Il tuo risultato pubblico di potenza",
      es: "Su resultado público de potencia",
      pt: "O seu resultado público de potência",
      pl: "Twój publiczny wynik mocy",
      ru: "Ваш общедоступный результат мощности",
      zh: "您的公开功率结果",
      sq: "Rezultati juaj publik i fuqisë",
    },
  );

  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations["Quick power check"],
    ),
    {
      de: "Schneller Leistungscheck",
      tr: "Hızlı güç kontrolü",
      nl: "Snelle vermogenscontrole",
      fr: "Contrôle rapide de puissance",
      it: "Controllo rapido della potenza",
      es: "Comprobación rápida de potencia",
      pt: "Verificação rápida da potência",
      pl: "Szybka kontrola mocy",
      ru: "Быстрая проверка мощности",
      zh: "快速功率检查",
      sq: "Kontroll i shpejtë i fuqisë",
    },
  );

  assert.deepEqual(
    publicToolsTranslations["Torque Power Calculator"],
    publicToolsTranslations["Torque & Power Calculator"],
  );

  const corePower = localizedRecord(
    publicSurfaceLocaleOrder,
    publicCoreTranslations["Quick datalog power check"],
  );
  assert.equal(corePower.zh, "快速数据日志功率检查");
  assert.equal(corePower.sq, "Kontroll i shpejtë i fuqisë nga datalogu");

  const delivery = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations["Power delivery"],
  );
  assert.equal(delivery.es, "Entrega de potencia");
  assert.equal(delivery.ru, "Характер отдачи мощности");
  assert.equal(delivery.zh, "动力输出");
  assert.equal(delivery.sq, "Shpërndarja e fuqisë");
});

test("public datalog recovery copy preserves RPM and native log terminology", () => {
  const rpmSources = [
    "Choose another CSV, TSV, TXT or LOG export, or try the example to confirm the required RPM and torque structure.",
    "The public estimate needs at least 5 aligned RPM and torque rows across a 1,000 rpm window with usable capture quality.",
    "This file is empty. Choose a log that contains RPM and torque rows.",
  ] as const;

  for (const source of rpmSources) {
    const translated = localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations[source],
    );
    for (const [locale, value] of Object.entries(translated)) {
      assert.match(value, /RPM/u, `${locale}: ${source}`);
    }
  }

  const reading = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations["Reading and analyzing the selected log"],
  );
  assert.equal(reading.de, "Der ausgewählte Datalog wird gelesen und analysiert");
  assert.equal(reading.it, "Lettura e analisi del datalog selezionato");
  assert.equal(reading.pl, "Odczytywanie i analiza wybranego logu");
  assert.equal(reading.ru, "Чтение и анализ выбранного лога");
  assert.equal(reading.zh, "正在读取并分析所选数据日志");
  assert.equal(reading.sq, "Po lexohet dhe analizohet datalogu i zgjedhur");

  const customerStudio = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "Signed-in customers can review compatible multi-channel text datalogs, calculated power, timelines and every retained numeric channel."
    ],
  );
  assert.match(customerStudio.nl, /berekend vermogen/u);
  assert.match(customerStudio.ru, /временные графики/u);
  assert.doesNotMatch(customerStudio.ru, /сроки/u);
});

test("public route headings use service-navigation language rather than physical roads", () => {
  const calibration = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations["Calibration route comparison"],
  );
  assert.equal(calibration.de, "Vergleich der Kalibrierungsoptionen");
  assert.equal(calibration.fr, "Comparaison des options de calibration");
  assert.equal(calibration.ru, "Сравнение вариантов калибровки");
  assert.equal(calibration.zh, "标定方案比较");

  const requestRoute = localizedRecord(
    publicSurfaceLocaleOrder,
    publicCoreTranslations["Choose the correct ECU or TCU request route"],
  );
  assert.equal(requestRoute.nl, "Kies het juiste aanvraagproces voor ECU of TCU");
  assert.equal(requestRoute.es, "Elija el proceso de solicitud adecuado para ECU o TCU");
  assert.equal(requestRoute.ru, "Выберите подходящий способ подачи заявки для ECU или TCU");
  assert.equal(requestRoute.zh, "选择正确的 ECU 或 TCU 申请流程");

  const publicScope = localizedRecord(
    publicSurfaceLocaleOrder,
    publicCoreTranslations["Public guidance boundary"],
  );
  assert.equal(publicScope.tr, "Herkese açık bilgilendirmenin kapsamı");
  assert.equal(publicScope.fr, "Périmètre des informations publiques");
  assert.equal(publicScope.ru, "Объём общедоступной информации");
  assert.equal(publicScope.zh, "公开信息范围");
});

test("TCU support copy keeps native articles, case and controller terminology", () => {
  const sTronic = localizedRecord(
    publicSurfaceLocaleOrder,
    publicVehicleTranslations["Do you support S tronic TCU files?"],
  );
  assert.equal(sTronic.fr, "Prenez-vous en charge les fichiers TCU S tronic ?");
  assert.equal(sTronic.it, "Supportate i file TCU S tronic?");
  assert.equal(sTronic.es, "¿Admiten archivos TCU de S tronic?");
  assert.equal(sTronic.pl, "Czy obsługujecie pliki TCU S tronic?");
  assert.equal(sTronic.ru, "Поддерживаете ли вы файлы TCU для S tronic?");
  assert.equal(sTronic.zh, "是否支持 S tronic TCU 文件？");
  assert.equal(sTronic.sq, "A i mbështetni skedarët TCU për S tronic?");

  const families = localizedRecord(
    publicSurfaceLocaleOrder,
    publicVehicleTranslations[
      "Selected TCU families are supported. Controller identification and the original TCU read are required for confirmation."
    ],
  );
  assert.match(families.fr, /L’identification du calculateur/u);
  assert.match(families.it, /l’identificazione della centralina/u);
  assert.match(families.es, /identificación de la unidad de control/u);
  assert.match(families.pl, /identyfikacja sterownika/u);
  assert.match(families.ru, /идентификация контроллера/u);
  assert.match(families.zh, /控制单元识别信息/u);
  assert.match(families.sq, /identifikimi i njësisë së kontrollit/u);
});

test("credit purchase failures and payment labels have native safe copy", () => {
  const manualCheck = {
    ru: exactTranslations.ru["Manual check"],
    zh: exactTranslations.zh["Manual check"],
    sq: exactTranslations.sq["Manual check"],
  };
  assert.deepEqual(manualCheck, {
    ru: "Ручная проверка",
    zh: "人工审核",
    sq: "Kontroll manual",
  });

  const sepaGoldens = {
    nl: "SEPA-overschrijving",
    fr: "Virement SEPA",
    it: "Bonifico SEPA",
    ru: "Перевод SEPA",
    es: "Transferencia SEPA",
    pt: "Transferência SEPA",
    zh: "SEPA 转账",
    pl: "Przelew SEPA",
    sq: "Transfertë SEPA",
  } as const;
  for (const [locale, expected] of Object.entries(sepaGoldens)) {
    assert.equal(exactTranslations[locale as keyof typeof exactTranslations]["SEPA transfer"], expected);
  }

  const safeSources = [
    "Please log in again before purchasing credits.",
    "Too many purchase attempts. Please wait a moment and try again.",
    "Choose a valid credit package or enter a valid credit amount.",
    "Credit pricing is temporarily unavailable. Please try again later.",
    "Credit prices changed. Review the refreshed total before continuing.",
    "This payment method is currently unavailable. Choose another payment method.",
    "Your customer reference could not be prepared. Please refresh and try again.",
    "Bank transfer instructions could not be prepared. Please try again or choose card payment.",
    "Secure card checkout is temporarily unavailable. Choose Bank Transfer or try again later.",
    "This total is outside Stripe's supported EUR range. Choose Bank Transfer or change the amount.",
  ] as const;
  for (const source of safeSources) {
    const translations = customerWorkflowExactTranslations[source];
    assert.equal(translations.length, customerWorkflowLocaleOrder.length, source);
    translations.forEach((translation, index) => {
      assert.ok(translation.trim(), `${source}: ${customerWorkflowLocaleOrder[index]}`);
      assert.notEqual(translation, source, `${source}: ${customerWorkflowLocaleOrder[index]}`);
    });
  }
  const rateLimited = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations[
      "Too many purchase attempts. Please wait a moment and try again."
    ],
  );
  assert.equal(rateLimited.de, "Zu viele Kaufversuche. Warten Sie einen Moment und versuchen Sie es erneut.");
  assert.equal(rateLimited.fr, "Trop de tentatives d’achat. Patientez un instant, puis réessayez.");
  assert.equal(rateLimited.zh, "购买尝试次数过多。请稍候片刻，然后重试。");
});

test("private Studio first paint has complete native access and recovery copy", () => {
  const sources = [
    "Opening your private datalog workspace...",
    "Please log in to open Datalog Analysis Studio",
    "The detailed local analysis workspace is included for verified MG AutoTech customers.",
    "Customer verification is taking longer",
    "The private Studio stays closed until your account can be verified securely.",
    "Try again",
    "Verifying customer access...",
  ] as const;
  for (const source of sources) {
    const translations = customerWorkflowExactTranslations[source];
    assert.equal(translations.length, customerWorkflowLocaleOrder.length, source);
    translations.forEach((translation, index) => {
      assert.ok(translation.trim(), `${source}: ${customerWorkflowLocaleOrder[index]}`);
      assert.notEqual(translation, source, `${source}: ${customerWorkflowLocaleOrder[index]}`);
    });
  }

  const opening = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations["Opening your private datalog workspace..."],
  );
  assert.equal(opening.de, "Ihr privater Datalog-Arbeitsbereich wird geöffnet...");
  assert.equal(opening.ru, "Открывается ваша личная рабочая область для анализа логов...");
  assert.equal(opening.sq, "Po hapet hapësira juaj private e punës për datalogët...");
});

test("high-traffic workshop tool titles and actions use reviewed native terminology", () => {
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations["Free workshop calculator"],
    ),
    {
      de: "Kostenloser Rechner für Werkstätten",
      tr: "Ücretsiz servis hesaplayıcısı",
      nl: "Gratis calculator voor werkplaatsen",
      fr: "Calculateur gratuit pour ateliers",
      it: "Calcolatore gratuito per officine",
      es: "Calculadora gratuita para talleres",
      pt: "Calculadora gratuita para oficinas",
      pl: "Bezpłatny kalkulator warsztatowy",
      ru: "Бесплатный калькулятор для автосервиса",
      zh: "免费维修厂计算器",
      sq: "Llogaritës falas për servise",
    },
  );

  const workshopPerformance = {
    de: "Leistungs-Tools für Werkstätten",
    tr: "Servisler için performans araçları",
    nl: "Prestatietools voor werkplaatsen",
    fr: "Outils de performance pour ateliers",
    it: "Strumenti prestazionali per officine",
    es: "Herramientas de rendimiento para talleres",
    pt: "Ferramentas de desempenho para oficinas",
    pl: "Narzędzia do analizy osiągów dla warsztatów",
    ru: "Инструменты анализа характеристик для автосервисов",
    zh: "维修厂性能工具",
    sq: "Mjete performance për servise",
  } as const;
  for (const source of ["Workshop performance tools", "Workshop Performance Tools"] as const) {
    assert.deepEqual(
      localizedRecord(publicSurfaceLocaleOrder, publicToolsTranslations[source]),
      workshopPerformance,
    );
  }

  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations["Torque to HP & kW Calculator"],
    ),
    {
      de: "Drehmoment-zu-HP-&-kW-Rechner",
      tr: "Torktan HP ve kW Hesaplayıcı",
      nl: "Calculator voor koppel naar HP en kW",
      fr: "Calculateur de couple en HP et kW",
      it: "Calcolatore da coppia a HP e kW",
      es: "Calculadora de par a HP y kW",
      pt: "Calculadora de binário para HP e kW",
      pl: "Kalkulator przeliczania momentu obrotowego na HP i kW",
      ru: "Калькулятор мощности в HP и kW по крутящему моменту",
      zh: "扭矩换算 HP 和 kW 计算器",
      sq: "Llogaritësi i konvertimit të çift-rrotullimit në HP dhe kW",
    },
  );

  const login = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations["Log in for full datalog analysis"],
  );
  assert.equal(login.de, "Für die vollständige Datalog-Analyse anmelden");
  assert.equal(login.fr, "Connectez-vous pour accéder à l’analyse complète des datalogs");
  assert.equal(login.zh, "登录后使用完整的数据日志分析");
  assert.doesNotMatch(Object.values(login).join("\n"), /\b(Login|Anmeldung|Connexion)\b/u);
});

test("public service and ECU plural copy preserves native grammar", () => {
  assert.deepEqual(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicServicesTranslations["Diagnostics & file services"],
    ),
    {
      de: "Diagnose- und Dateiservices",
      tr: "Teşhis ve dosya hizmetleri",
      nl: "Diagnostiek en bestandsservices",
      fr: "Services de diagnostic et de fichiers",
      it: "Servizi di diagnostica e gestione file",
      es: "Servicios de diagnóstico y de archivos",
      pt: "Serviços de diagnóstico e de ficheiros",
      pl: "Diagnostyka i usługi plikowe",
      ru: "Диагностика и файловые услуги",
      zh: "诊断与文件服务",
      sq: "Diagnostikim dhe shërbime skedarësh",
    },
  );

  const locked = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations[
      "Locked or protected ECUs require human confirmation before any work is promised."
    ],
  );
  assert.equal(
    locked.fr,
    "Les ECU verrouillées ou protégées doivent être validées par un spécialiste avant toute promesse d’intervention.",
  );
  assert.equal(
    locked.it,
    "Le ECU bloccate o protette richiedono la conferma di uno specialista prima di poter garantire qualsiasi intervento.",
  );
  assert.equal(locked.zh, "对于已锁定或受保护的 ECU，在承诺任何作业之前必须由专业人员确认。");
  for (const [locale, value] of Object.entries(locked)) {
    if (locale !== "de") {
      assert.doesNotMatch(value, /\bECUs\b/u, locale);
    }
  }

  const egr = localizedRecord(
    publicSurfaceLocaleOrder,
    publicServicesTranslations[
      "EGR and AGR file service requests for supported ECUs with diagnostic notes, DTC context and secure file delivery."
    ],
  );
  assert.equal(
    egr.tr,
    "Desteklenen ECU'lar için tanılama notları, DTC bilgileri ve güvenli dosya teslimatı içeren EGR ve AGR dosya hizmeti talepleri.",
  );
  assert.equal(
    egr.sq,
    "Kërkesa për shërbimin e skedarëve EGR dhe AGR për ECU-të e mbështetura, me shënime diagnostikuese, informacion DTC dhe dorëzim të sigurt të skedarëve.",
  );
});

test("vehicle catalog uses exact controller lists, native readout nouns and ECU articles", () => {
  const audi = localizedRecord(
    publicSurfaceLocaleOrder,
    publicVehicleTranslations[
      "Audi platforms share powertrain technology across the Volkswagen Group, but that does not make ECU software interchangeable. Model generation, engine code, market, ECU hardware, software and calibration identifiers can all change the correct source-file and review context. Supported TDI and TFSI applications may use Bosch EDC17, MD1, MED17, MG1 or Continental SIMOS systems depending on generation."
    ],
  );
  for (const [locale, value] of Object.entries(audi)) {
    assert.match(
      value,
      /Bosch EDC17, MD1, MED17(?:,| oder| ou| o| lub|,)? MG1|Bosch EDC17、MD1、MED17、MG1/u,
      locale,
    );
    assert.match(value, /Continental SIMOS/u, locale);
    assert.doesNotMatch(value, /Bosch[^.]{0,50}Continental SIMOS[^.]{0,30}(Bosch|famil)/iu, locale);
  }

  const mercedes = localizedRecord(
    publicSurfaceLocaleOrder,
    publicVehicleTranslations[
      "Mercedes-Benz file work covers a broad range of diesel, petrol and transmission controllers. CDI and CRD diesel systems, MED petrol ECUs, newer MD1 units and VGS transmission controllers each require accurate identification and an appropriate read method."
    ],
  );
  assert.equal(
    mercedes.nl,
    "Bestandswerk voor Mercedes-Benz omvat een groot aantal diesel-, benzine- en transmissieregeleenheden. CDI- en CRD-dieselsystemen, MED-benzine-ECU's, nieuwere MD1-regeleenheden en VGS-transmissieregeleenheden vereisen elk een nauwkeurige identificatie en een geschikte uitleesmethode.",
  );
  assert.equal(
    mercedes.zh,
    "Mercedes-Benz 文件服务涵盖多种柴油、汽油和变速箱控制单元。CDI 和 CRD 柴油系统、MED 汽油 ECU、较新的 MD1 控制单元以及 VGS 变速箱控制单元，都需要准确识别并采用合适的读取方式。",
  );

  const readType = localizedRecord(
    publicSurfaceLocaleOrder,
    publicVehicleTranslations[
      "No. The correct read type depends on the ECU and tool. Submit the read method and ECU identification so file suitability can be checked."
    ],
  );
  assert.equal(
    readType.nl,
    "Nee. Het juiste type uitlezing hangt af van de ECU en de uitleestool. Geef de uitleesmethode en ECU-identificatie op, zodat de geschiktheid van het bestand kan worden gecontroleerd.",
  );
  assert.equal(
    readType.it,
    "No. Il tipo di lettura corretto dipende dall’ECU e dallo strumento. Invia il metodo di lettura e l’identificazione dell’ECU affinché sia possibile verificare l’idoneità del file.",
  );

  const publicCatalogText = [
    ...Object.values(publicCoreTranslations),
    ...Object.values(publicServicesTranslations),
    ...Object.values(publicToolsTranslations),
    ...Object.values(publicVehicleTranslations),
  ]
    .flat()
    .join("\n");
  assert.doesNotMatch(
    publicCatalogText,
    /dello ECU|dallo ECU|della ECU|del ECU|identificación ECU/u,
  );
  assert.doesNotMatch(publicCatalogText, /gereedschapsprotocol|originele lezing/u);
});

test("datalog and controller-identification catalogs reject diary and personal-identity regressions", () => {
  const datalogSources = [
    "01 · Select a datalog",
    "Choose a text datalog",
    "Datalog Analysis Studio",
    "Loading the free log snapshot",
    "The detailed MG AutoTech datalog workspace is available inside the protected customer dashboard.",
    "The log analyzer creates a scalable SVG report you can retain with the job.",
  ] as const;
  for (const source of datalogSources) {
    const values = publicToolsTranslations[source];
    assert.equal(values.length, publicSurfaceLocaleOrder.length, source);
    assert.doesNotMatch(
      values.join("\n"),
      /Tagebuch|journal(?: de bord)?|registro|rejestr|журнал|regjistër/iu,
      source,
    );
  }

  for (const source of [
    "Private browser-local multi-channel datalog review for MG AutoTech customers.",
    "Log File Review",
    "Priority handling, log review and technical support add-ons for complex jobs.",
  ] as const) {
    const values = customerWorkflowExactTranslations[source];
    assert.equal(values.length, customerWorkflowLocaleOrder.length, source);
    assert.doesNotMatch(
      values.join("\n"),
      /Tagebuch|journal(?: de bord)?|registro|rejestr|журнал|regjistër|Günlük Dosyası|logboek/iu,
      source,
    );
  }

  const guideText = Object.values(workshopGuideExactTranslations).flat().join("\n");
  assert.doesNotMatch(
    guideText,
    /идентичность|Steuergeräteidentität|controlleridentiteit|identiteit van de regeleenheid|identité du calculateur|identité de l’ECU|identità della centralina|identità dell’ECU|identidad de la unidad|identidad de la ECU|identificacióne/iu,
  );

  const guideByLocale = Object.fromEntries(
    workshopGuideLocaleOrder.map((locale, index) => [
      locale,
      Object.values(workshopGuideExactTranslations)
        .map((tuple) => tuple[index])
        .join("\n"),
    ]),
  );
  assert.doesNotMatch(guideByLocale.ru, /\bfile service\b/iu);
  assert.doesNotMatch(guideByLocale.sq, /\bfile service\b/iu);
  assert.doesNotMatch(guideByLocale.zh, /(?:ECU|TCU|控制器|控制单元)[^。\n]{0,40}身份|身份[^。\n]{0,40}(?:ECU|TCU|控制器|控制单元)/u);
});

test("customer first-paint and payment status copy remains native", () => {
  const secureAccess = localizedRecord(
    customerPortalLocaleOrder,
    customerPortalTranslations["Secure customer access"],
  );
  assert.equal(secureAccess.zh, "安全访问客户账户");

  const paymentSuccess = localizedRecord(
    customerSurfaceLocaleOrder,
    customerSurfaceTranslations["Payment successful"],
  );
  assert.equal(paymentSuccess.es, "Pago completado");
  assert.equal(exactTranslations.tr["SEPA transfer"], "SEPA havalesi");

  const reconciliation = localizedRecord(
    customerWorkflowLocaleOrder,
    customerWorkflowExactTranslations[
      "Payment is still being reconciled securely. Checking again..."
    ],
  );
  assert.equal(reconciliation.nl, "De betaling wordt nog veilig verwerkt. We controleren opnieuw...");
  assert.equal(reconciliation.it, "La riconciliazione sicura del pagamento è ancora in corso. Nuovo controllo...");
  assert.equal(reconciliation.zh, "付款仍在安全对账中，正在重新检查……");
});

test("reviewed public guidance and vehicle exact-key residuals stay native", () => {
  assertLocalizedGoldens(publicSurfaceLocaleOrder, publicCoreTranslations, {
    "For an existing order, use the message area inside the customer dashboard so the conversation remains attached to the correct file request.": {
      nl: "Gebruik bij een bestaande bestelling het berichtengedeelte in het klantdashboard, zodat het gesprek aan de juiste bestandsaanvraag gekoppeld blijft.",
      fr: "Pour une commande existante, utilisez l’espace de messagerie du tableau de bord client afin que la conversation reste associée à la bonne demande de fichier.",
      it: "Per un ordine esistente, utilizza l’area messaggi nella dashboard cliente affinché la conversazione rimanga associata alla richiesta di file corretta.",
      es: "Para un pedido existente, utilice el área de mensajes del panel del cliente para que la conversación permanezca vinculada a la solicitud de archivo correcta.",
      pl: "W przypadku istniejącego zlecenia użyj obszaru wiadomości w panelu klienta, aby rozmowa pozostała powiązana z właściwym zleceniem pliku.",
      ru: "Для существующего заказа используйте раздел сообщений в панели клиента, чтобы переписка оставалась привязана к нужной заявке на файл.",
      sq: "Për një porosi ekzistuese, përdorni seksionin e mesazheve në panelin e klientit, në mënyrë që biseda të mbetet e lidhur me kërkesën e duhur për skedarin.",
    },
    "Provide exact diagnostic codes without exposing private file data.": {
      nl: "Geef de exacte diagnosecodes op zonder privégegevens uit het bestand openbaar te maken.",
      fr: "Fournissez les codes de diagnostic exacts sans exposer les données privées du fichier.",
      it: "Fornisci i codici diagnostici esatti senza esporre i dati privati del file.",
      es: "Proporcione los códigos de diagnóstico exactos sin exponer los datos privados del archivo.",
      pl: "Podaj dokładne kody diagnostyczne bez ujawniania prywatnych danych z pliku.",
      ru: "Укажите точные диагностические коды, не раскрывая конфиденциальные данные файла.",
      zh: "请提供准确的诊断代码，但不要泄露文件中的私密数据。",
      sq: "Jepni kodet e sakta diagnostikuese pa zbuluar të dhënat private të skedarit.",
    },
    "Use your customer account for private file exchange.": {
      nl: "Gebruik uw klantaccount voor de veilige uitwisseling van privébestanden.",
      fr: "Utilisez votre compte client pour échanger des fichiers privés en toute sécurité.",
      it: "Utilizza il tuo account cliente per lo scambio sicuro di file privati.",
      es: "Utilice su cuenta de cliente para intercambiar archivos privados de forma segura.",
      pl: "Użyj konta klienta do bezpiecznej wymiany prywatnych plików.",
      ru: "Используйте учётную запись клиента для безопасного обмена приватными файлами.",
      zh: "请使用客户账户安全交换私密文件。",
      sq: "Përdorni llogarinë tuaj të klientit për shkëmbim të sigurt të skedarëve privatë.",
    },
    "Vehicle context, original-file preparation and review workflow.": {
      de: "Workflow zur Vorbereitung und Prüfung von Fahrzeugkontext und Originaldatei.",
      tr: "Araç bağlamı ile orijinal dosyanın hazırlanması ve incelenmesine yönelik iş akışı.",
      nl: "Proces voor voertuigcontext en het voorbereiden en beoordelen van het originele bestand.",
      fr: "Processus de préparation et d’examen du contexte du véhicule et du fichier d’origine.",
      it: "Processo di preparazione e revisione del contesto del veicolo e del file originale.",
      pt: "Processo de preparação e análise do contexto do veículo e do ficheiro original.",
      pl: "Proces przygotowania i weryfikacji kontekstu pojazdu oraz pliku oryginalnego.",
      ru: "Процесс подготовки и проверки данных автомобиля и исходного файла.",
      zh: "车辆信息与原始文件的准备和审核流程。",
      sq: "Procesi i përgatitjes dhe shqyrtimit të kontekstit të automjetit dhe skedarit origjinal.",
    },
  });

  assertLocalizedGoldens(publicSurfaceLocaleOrder, publicVehicleTranslations, {
    "Each guide explains what must be identified before a file request is accepted.": {
      nl: "Elke gids legt uit welke gegevens vóór acceptatie van een bestandsaanvraag moeten worden vastgesteld.",
      fr: "Chaque guide précise les éléments à identifier avant l’acceptation d’une demande de fichier.",
      it: "Ogni guida spiega quali elementi devono essere identificati prima che una richiesta di file venga accettata.",
      es: "Cada guía explica qué datos deben identificarse antes de aceptar una solicitud de archivo.",
      pl: "Każdy przewodnik wyjaśnia, jakie dane należy zidentyfikować przed przyjęciem zlecenia pliku.",
      ru: "В каждом руководстве указано, какие данные необходимо идентифицировать до принятия заявки на файл.",
      zh: "每份指南都会说明，在接受文件请求之前必须确认哪些识别信息。",
      sq: "Çdo udhëzues shpjegon se cilat të dhëna duhet të identifikohen para se të pranohet kërkesa për skedar.",
    },
    "Each request is reviewed using the OEM identification, Denso number, original file and read protocol.": {
      nl: "Elk verzoek wordt beoordeeld aan de hand van de OEM-identificatie, het Denso-nummer, het originele bestand en het uitleesprotocol.",
      pl: "Każde zlecenie jest weryfikowane na podstawie identyfikacji OEM, numeru Denso, oryginalnego pliku i protokołu odczytu.",
      ru: "Каждая заявка проверяется по OEM-идентификации, номеру Denso, исходному файлу и протоколу чтения.",
      zh: "每个请求都会根据 OEM 标识、Denso 编号、原始文件和读取协议进行审核。",
      sq: "Çdo kërkesë shqyrtohet sipas identifikimit OEM, numrit Denso, skedarit origjinal dhe protokollit të leximit.",
    },
    "ECU and TCU requests can be coordinated while keeping separate original files, notes and delivered versions inside the same customer workflow.": {
      it: "Le richieste ECU e TCU possono essere coordinate mantenendo separati i file originali, le note e le versioni consegnate all’interno dello stesso flusso cliente.",
      es: "Las solicitudes de ECU y TCU pueden coordinarse manteniendo separados los archivos originales, las notas y las versiones entregadas dentro del mismo flujo de trabajo del cliente.",
      zh: "ECU 和 TCU 请求可以协同处理，同时在同一客户流程中分别保留原始文件、备注和已交付版本。",
      sq: "Kërkesat për ECU dhe TCU mund të koordinohen, ndërsa skedarët origjinalë, shënimet dhe versionet e dorëzuara mbahen të ndara brenda të njëjtit proces të klientit.",
    },
    "No. The controller family, hardware/software identification and read type are required for a reliable check.": {
      nl: "Nee. Voor een betrouwbare controle zijn de familie van de regeleenheid, de hardware-/software-identificatie en het type uitlezing vereist.",
      fr: "Non. La famille du calculateur, l’identification matérielle/logicielle et le type de lecture sont nécessaires pour un contrôle fiable.",
      it: "No. Per una verifica affidabile sono necessari la famiglia della centralina, l’identificazione hardware/software e il tipo di lettura.",
      es: "No. Para una comprobación fiable se requieren la familia de la unidad de control, la identificación de hardware/software y el tipo de lectura.",
      pl: "Nie. Do wiarygodnej weryfikacji wymagane są rodzina sterownika, identyfikacja sprzętu/oprogramowania i typ odczytu.",
      ru: "Нет. Для надёжной проверки необходимы семейство контроллера, идентификационные данные аппаратной и программной части и тип чтения.",
      sq: "Jo. Për një kontroll të besueshëm kërkohen familja e njësisë së kontrollit, identifikimi i harduerit/softuerit dhe lloji i leximit.",
    },
    "Yes where technically supported. Select all required services and add the diagnostic context to the same order.": {
      tr: "Evet, teknik olarak desteklendiğinde. Gerekli tüm hizmetleri seçin ve teşhis bilgilerini aynı talebe ekleyin.",
      fr: "Oui, lorsque cela est techniquement pris en charge. Sélectionnez tous les services nécessaires et ajoutez le contexte de diagnostic à la même demande.",
      it: "Sì, quando è tecnicamente supportato. Seleziona tutti i servizi necessari e aggiungi il contesto diagnostico alla stessa richiesta.",
      es: "Sí, cuando exista compatibilidad técnica. Seleccione todos los servicios necesarios y añada el contexto de diagnóstico a la misma solicitud.",
      pl: "Tak, jeśli jest to obsługiwane technicznie. Wybierz wszystkie wymagane usługi i dodaj kontekst diagnostyczny do tego samego zlecenia.",
      ru: "Да, если это технически поддерживается. Выберите все необходимые услуги и добавьте диагностическую информацию в ту же заявку.",
      sq: "Po, kur mbështetet teknikisht. Zgjidhni të gjitha shërbimet e nevojshme dhe shtoni kontekstin diagnostik në të njëjtën kërkesë.",
    },
    "Yes, where supported. Include separate original reads and identification data for each controller.": {
      de: "Ja, sofern unterstützt. Fügen Sie für jedes Steuergerät eine separate Originalauslesung und eigene Identifikationsdaten hinzu.",
      fr: "Oui, lorsque cela est pris en charge. Ajoutez une lecture d’origine distincte et les données d’identification de chaque calculateur.",
      it: "Sì, quando supportato. Includi per ogni centralina la lettura originale separata e i relativi dati identificativi.",
      pl: "Tak, jeśli jest to obsługiwane. Dołącz osobny oryginalny odczyt i dane identyfikacyjne dla każdego sterownika.",
      ru: "Да, если это поддерживается. Добавьте отдельный исходный файл чтения и идентификационные данные для каждого контроллера.",
      zh: "可以，但需受支持。请为每个控制单元分别提供原始读取文件和识别数据。",
    },
  });
});

test("reviewed public service exact-key residuals stay native", () => {
  assertLocalizedGoldens(publicSurfaceLocaleOrder, publicServicesTranslations, {
    "Add exact DTCs": {
      de: "Genaue DTCs hinzufügen",
      tr: "Kesin DTC kodlarını ekleyin",
      nl: "Voeg de exacte DTC’s toe",
      fr: "Ajouter les DTC exacts",
      it: "Aggiungi i DTC esatti",
      es: "Añadir los DTC exactos",
      pt: "Adicionar os DTC exatos",
      pl: "Dodaj dokładne kody DTC",
      ru: "Добавьте точные коды DTC",
      zh: "添加准确的 DTC 代码",
      sq: "Shtoni kodet e sakta DTC",
    },
    "Any EGR-related DTCs, symptoms or workshop findings can be added to the request notes.": {
      de: "Alle EGR-bezogenen DTCs, Symptome oder Werkstattbefunde können den Anfragenotizen hinzugefügt werden.",
      tr: "EGR ile ilgili DTC'ler, belirtiler veya servis bulguları talep notlarına eklenebilir.",
      nl: "Alle EGR-gerelateerde DTCs, symptomen of werkplaatsbevindingen kunnen aan de aanvraagnotities worden toegevoegd.",
      fr: "Tous les DTC, symptômes ou constats d’atelier liés à l’EGR peuvent être ajoutés aux notes de la demande.",
      it: "Gli eventuali DTC, sintomi o riscontri dell’officina relativi all’EGR possono essere aggiunti alle note della richiesta.",
      es: "Los DTC, síntomas o hallazgos del taller relacionados con la EGR pueden añadirse a las notas de la solicitud.",
      pt: "Quaisquer DTC, sintomas ou conclusões da oficina relacionados com a EGR podem ser adicionados às notas do pedido.",
      pl: "Wszelkie kody DTC, objawy lub ustalenia warsztatu związane z EGR można dodać do notatek zlecenia.",
      ru: "Связанные с EGR коды DTC, симптомы или результаты диагностики в автосервисе можно добавить в примечания к заявке.",
      zh: "任何与 EGR 相关的 DTC、症状或维修厂检查结果都可以添加到请求备注中。",
      sq: "Çdo DTC, simptomë ose gjetje e servisit që lidhet me EGR-në mund të shtohet në shënimet e kërkesës.",
    },
    "Customers can upload the original file, choose the service, add notes and then follow the order timeline until delivery.": {
      de: "Kunden können die Originaldatei hochladen, den Service auswählen, Notizen hinzufügen und anschließend den Auftragsverlauf bis zur Auslieferung verfolgen.",
      nl: "Klanten kunnen het originele bestand uploaden, de service kiezen, notities toevoegen en daarna de voortgang van de bestelling tot aan de levering volgen.",
      it: "I clienti possono caricare il file originale, scegliere il servizio, aggiungere note e seguire l’avanzamento dell’ordine fino alla consegna.",
      sq: "Klientët mund të ngarkojnë skedarin origjinal, të zgjedhin shërbimin, të shtojnë shënime dhe më pas të ndjekin ecurinë e porosisë deri në dorëzim.",
    },
    "DTC OFF requests depend heavily on exact fault code information. The customer can submit the fault codes and workshop notes directly inside the file request.": {
      nl: "DTC OFF-aanvragen zijn sterk afhankelijk van exacte foutcodegegevens. De klant kan de foutcodes en werkplaatsnotities rechtstreeks in de bestandsaanvraag invoeren.",
      fr: "Les demandes DTC OFF dépendent fortement de codes défaut précis. Le client peut saisir les codes défaut et les notes de l’atelier directement dans la demande de fichier.",
      it: "Le richieste DTC OFF dipendono in larga misura da informazioni precise sui codici guasto. Il cliente può inserire i codici guasto e le note dell’officina direttamente nella richiesta di file.",
      es: "Las solicitudes DTC OFF dependen en gran medida de información precisa sobre los códigos de avería. El cliente puede introducir los códigos de avería y las notas del taller directamente en la solicitud de archivo.",
      pl: "Zlecenia DTC OFF w dużym stopniu zależą od dokładnych informacji o kodach usterek. Klient może podać kody usterek i notatki warsztatowe bezpośrednio w zleceniu pliku.",
      ru: "Заявки DTC OFF в значительной степени зависят от точных данных о кодах неисправностей. Клиент может указать коды и заметки автосервиса непосредственно в заявке на файл.",
      zh: "DTC OFF 请求高度依赖准确的故障代码信息。客户可以直接在文件请求中提交故障代码和维修厂备注。",
      sq: "Kërkesat DTC OFF varen shumë nga të dhënat e sakta të kodeve të defektit. Klienti mund t’i paraqesë kodet e defektit dhe shënimet e servisit drejtpërdrejt në kërkesën për skedar.",
    },
    "EGR-related requests often benefit from clear diagnostic notes. The portal lets the customer include DTCs, vehicle data, ECU information and the original file in one place.": {
      de: "Bei EGR-bezogenen Anfragen sind klare Diagnosehinweise oft hilfreich. Im Portal kann der Kunde DTCs, Fahrzeugdaten, ECU-Informationen und die Originaldatei gemeinsam einreichen.",
      tr: "EGR ile ilgili taleplerde net teşhis notları faydalıdır. Müşteri portal üzerinden DTC'leri, araç verilerini, ECU bilgilerini ve orijinal dosyayı tek bir yerde sunabilir.",
      nl: "EGR-gerelateerde aanvragen hebben vaak baat bij duidelijke diagnosenotities. In het portaal kan de klant DTCs, voertuiggegevens, ECU-informatie en het originele bestand samen indienen.",
      fr: "Les demandes liées à l’EGR bénéficient souvent de notes de diagnostic claires. Le portail permet au client de regrouper les DTC, les données du véhicule, les informations ECU et le fichier d’origine.",
      it: "Le richieste relative all’EGR traggono spesso vantaggio da note diagnostiche chiare. Il portale consente al cliente di riunire DTC, dati del veicolo, informazioni ECU e file originale.",
      es: "Las solicitudes relacionadas con la EGR suelen beneficiarse de notas de diagnóstico claras. El portal permite al cliente reunir los DTC, los datos del vehículo, la información de la ECU y el archivo original.",
      pl: "W przypadku zleceń związanych z EGR przydatne są jasne notatki diagnostyczne. Portal pozwala klientowi przesłać w jednym miejscu kody DTC, dane pojazdu, informacje ECU i oryginalny plik.",
      ru: "Для заявок, связанных с EGR, полезны чёткие диагностические заметки. В портале клиент может вместе указать коды DTC, данные автомобиля, информацию ECU и приложить исходный файл.",
      zh: "与 EGR 相关的请求通常需要清晰的诊断备注。客户可以在门户中统一提交 DTC、车辆数据、ECU 信息和原始文件。",
      sq: "Kërkesat që lidhen me EGR shpesh përfitojnë nga shënime të qarta diagnostikuese. Portali i lejon klientit të paraqesë së bashku DTC-të, të dhënat e automjetit, informacionin ECU dhe skedarin origjinal.",
    },
    "Focused technical requests for exact DTC lists, file quality, original backup context and safe review before work continues.": {
      de: "Gezielte technische Anfragen zu exakten DTC-Listen, Datequalität, Original-Backup-Kontext und sicherer Prüfung, bevor die Arbeit fortgesetzt wird.",
      tr: "Çalışmaya devam edilmeden önce tam DTC listeleri, dosya kalitesi, orijinal yedek bağlamı ve güvenli inceleme için odaklanmış teknik talepler.",
      nl: "Gerichte technische aanvragen voor exacte DTC-lijsten, bestandskwaliteit, de context van de originele back-up en een veilige beoordeling voordat het werk wordt voortgezet.",
      fr: "Demandes techniques ciblées portant sur les listes exactes de DTC, la qualité du fichier, le contexte de la sauvegarde d’origine et un examen sécurisé avant la poursuite des travaux.",
      it: "Richieste tecniche mirate relative agli elenchi DTC esatti, alla qualità del file, al contesto del backup originale e alla verifica sicura prima di proseguire il lavoro.",
      es: "Solicitudes técnicas específicas sobre listas exactas de DTC, calidad del archivo, contexto de la copia de seguridad original y revisión segura antes de continuar el trabajo.",
      pl: "Ukierunkowane zlecenia techniczne dotyczące dokładnych list DTC, jakości pliku, kontekstu oryginalnej kopii zapasowej i bezpiecznej weryfikacji przed kontynuacją prac.",
      ru: "Технические заявки с точными списками DTC, оценкой качества файла, сведениями об исходной резервной копии и безопасной проверкой до продолжения работ.",
      zh: "针对准确 DTC 列表、文件质量、原始备份背景以及继续作业前安全审核的专项技术请求。",
      sq: "Kërkesa teknike të fokusuara për listat e sakta të DTC-ve, cilësinë e skedarit, kontekstin e kopjes rezervë origjinale dhe shqyrtimin e sigurt para vazhdimit të punës.",
    },
    "No. Availability depends on the vehicle, controller, read method, file quality, hardware state and submitted notes. Complex or unclear work stays review-first.": {
      de: "Nein. Die Verfügbarkeit hängt vom Fahrzeug, dem Steuergerät, der Auslesemethode, der Datequalität, dem Hardwarezustand und den eingereichten Notizen ab. Komplexe oder unklare Arbeiten werden immer zuerst geprüft.",
      fr: "Non. La disponibilité dépend du véhicule, du calculateur, de la méthode de lecture, de la qualité du fichier, de l’état du matériel et des notes transmises. Les travaux complexes ou peu clairs sont toujours examinés en premier.",
      it: "No. La disponibilità dipende dal veicolo, dalla centralina, dal metodo di lettura, dalla qualità del file, dallo stato dell’hardware e dalle note inviate. I lavori complessi o poco chiari vengono sempre esaminati prima.",
      es: "No. La disponibilidad depende del vehículo, la unidad de control, el método de lectura, la calidad del archivo, el estado del hardware y las notas enviadas. Los trabajos complejos o poco claros siempre se revisan primero.",
      pl: "Nie. Dostępność zależy od pojazdu, sterownika, metody odczytu, jakości pliku, stanu sprzętu i przesłanych notatek. Złożone lub niejasne prace są zawsze najpierw weryfikowane.",
      ru: "Нет. Доступность зависит от автомобиля, контроллера, метода чтения, качества файла, состояния оборудования и переданных примечаний. Сложные или неясные работы всегда сначала проверяются.",
      zh: "否。可用性取决于车辆、控制单元、读取方式、文件质量、硬件状态和提交的备注。复杂或不明确的作业始终先进行审核。",
      sq: "Jo. Disponueshmëria varet nga automjeti, njësia e kontrollit, metoda e leximit, cilësia e skedarit, gjendja e harduerit dhe shënimet e paraqitura. Punët komplekse ose të paqarta shqyrtohen gjithmonë fillimisht.",
    },
    "Original file upload": {
      nl: "Upload van het originele bestand",
      es: "Carga del archivo original",
      pl: "Przesyłanie oryginalnego pliku",
      ru: "Загрузка оригинального файла",
      zh: "上传原始文件",
      sq: "Ngarkimi i skedarit origjinal",
    },
    "Prepare the original file, vehicle details, engine, ECU or TCU information, read method, exact DTCs if relevant and a short workshop note.": {
      de: "Bereiten Sie die Originaldatei, Fahrzeugdaten, Motor-, ECU- oder TCU-Informationen, die Auslesemethode, gegebenenfalls die exakten DTCs und eine kurze Werkstattnotiz vor.",
      tr: "Orijinal dosyayı, araç ayrıntılarını, motor, ECU veya TCU bilgilerini, okuma yöntemini, gerekiyorsa tam DTC listesini ve kısa bir servis notunu hazırlayın.",
      fr: "Préparez le fichier d’origine, les données du véhicule et du moteur, les informations ECU ou TCU, la méthode de lecture, les DTC exacts le cas échéant et une brève note d’atelier.",
      it: "Prepara il file originale, i dati del veicolo e del motore, le informazioni ECU o TCU, il metodo di lettura, gli eventuali DTC esatti e una breve nota dell’officina.",
      es: "Prepare el archivo original, los datos del vehículo y del motor, la información de la ECU o la TCU, el método de lectura, los DTC exactos si procede y una breve nota del taller.",
      pl: "Przygotuj oryginalny plik, dane pojazdu i silnika, informacje ECU lub TCU, metodę odczytu, dokładne kody DTC, jeśli są istotne, oraz krótką notatkę warsztatową.",
      ru: "Подготовьте исходный файл, данные автомобиля и двигателя, информацию ECU или TCU, метод чтения, при необходимости точные коды DTC и краткую заметку автосервиса.",
      zh: "请准备原始文件、车辆和发动机信息、ECU 或 TCU 信息、读取方式、相关的准确 DTC 以及简短的维修厂备注。",
    },
    "Real request quality comes from the intake flow: vehicle context, original file, service scope, notes, review status and delivery all stay connected to the same customer order.": {
      nl: "De kwaliteit van een aanvraag begint bij een goede intake: voertuigcontext, origineel bestand, serviceomvang, notities, beoordelingsstatus en levering blijven gekoppeld aan dezelfde klantorder.",
      it: "La qualità di una richiesta nasce dal processo di acquisizione: contesto del veicolo, file originale, ambito del servizio, note, stato della revisione e consegna restano associati allo stesso ordine cliente.",
      pl: "Jakość zlecenia wynika z procesu przyjęcia: kontekst pojazdu, oryginalny plik, zakres usługi, notatki, status weryfikacji i dostawa pozostają powiązane z tym samym zleceniem klienta.",
      zh: "请求质量取决于信息接收流程：车辆信息、原始文件、服务范围、备注、审核状态和交付始终关联到同一客户订单。",
      sq: "Cilësia e kërkesës nis nga procesi i pranimit: konteksti i automjetit, skedari origjinal, fusha e shërbimit, shënimet, statusi i shqyrtimit dhe dorëzimi mbeten të lidhura me të njëjtën porosi të klientit.",
    },
    "The selected AdBlue / SCR service request is prepared for the submitted file.": {
      de: "Die ausgewählte AdBlue-/SCR-Serviceanfrage wird für die eingereichte Datei vorbereitet.",
      nl: "De geselecteerde AdBlue-/SCR-serviceaanvraag wordt voorbereid voor het ingediende bestand.",
      it: "La richiesta di servizio AdBlue/SCR selezionata viene preparata per il file inviato.",
      pl: "Wybrane zlecenie usługi AdBlue/SCR jest przygotowywane dla przesłanego pliku.",
      ru: "Выбранная заявка на услугу AdBlue/SCR подготавливается для отправленного файла.",
      zh: "将根据提交的文件准备所选 AdBlue/SCR 服务请求。",
      sq: "Kërkesa e zgjedhur për shërbimin AdBlue/SCR përgatitet për skedarin e paraqitur.",
    },
    "Yes, combined requests can be selected in the file request workflow where supported.": {
      de: "Ja, sofern unterstützt, können kombinierte Anfragen im Ablauf für Dateianfragen ausgewählt werden.",
      tr: "Evet, desteklendiğinde dosya talebi akışında birden fazla hizmet birlikte seçilebilir.",
      nl: "Ja, waar ondersteund kunnen gecombineerde aanvragen in het proces voor bestandsaanvragen worden geselecteerd.",
      fr: "Oui, lorsque cela est pris en charge, des demandes combinées peuvent être sélectionnées dans le processus de demande de fichier.",
      it: "Sì, quando supportato è possibile selezionare richieste combinate nel processo di richiesta del file.",
      es: "Sí, cuando sea compatible, pueden seleccionarse solicitudes combinadas en el proceso de solicitud de archivo.",
      pl: "Tak, jeśli jest to obsługiwane, w procesie zlecenia pliku można wybrać usługi łączone.",
      ru: "Да, если это поддерживается, в процессе создания заявки на файл можно выбрать комбинированные услуги.",
      zh: "可以；在受支持的情况下，可在文件请求流程中选择组合服务。",
      sq: "Po, kur mbështetet, kërkesat e kombinuara mund të zgjidhen në procesin e kërkesës për skedar.",
    },
  });
});

test("reviewed auth, payment and metadata residuals stay native", () => {
  assert.equal(
    exactTranslations.sq[
      "A guided setup for private customers and professional workshops."
    ],
    "Konfigurim i udhëzuar për klientë privatë dhe servise profesionale.",
  );
  assert.equal(
    exactTranslations.fr[
      "For garages, dealers and recurring file service work."
    ],
    "Pour les garages, les revendeurs et les demandes régulières de service de fichiers.",
  );
  assert.equal(
    exactTranslations.sq[
      "For garages, dealers and recurring file service work."
    ],
    "Për servise, tregtarë dhe punë të përsëritura të shërbimit të skedarëve.",
  );
  assert.equal(
    exactTranslations.sq["For private drivers and single file requests."],
    "Për drejtues privatë dhe kërkesa të herëpashershme për skedarë.",
  );

  const accountStart = localizedRecord(
    customerRuntimeLocaleOrder,
    customerRuntimeTranslations["Start your file service account"],
  );
  assert.equal(accountStart.fr, "Créez votre compte de service de fichiers");
  assert.equal(accountStart.it, "Crea il tuo account per il servizio file");
  assert.equal(accountStart.es, "Cree su cuenta del servicio de archivos");

  assert.equal(
    customerWorkflowT("it", "creditPackageDescription10"),
    "10 crediti per lavori occasionali del servizio file.",
  );
  assert.equal(
    customerWorkflowT("it", "creditPackageDescription50"),
    "50 crediti per lavori regolari del servizio file.",
  );
  assert.equal(
    customerWorkflowT("it", "creditPackageDescription100"),
    "100 crediti per richieste ricorrenti del servizio file.",
  );

  assert.equal(
    widgetSiteT("nl", "widgetDashboardMetaTitle"),
    "Dashboard voor de voertuigwidget",
  );
  assert.equal(widgetSiteT("nl", "loadsThisMonth"), "Laadbeurten deze maand");
  assert.equal(
    widgetSiteT("nl", "lastLiveLoad"),
    "Laatst live geladen: {value}",
  );
  assert.equal(
    widgetSiteT("nl", "lastLiveLoad", { value: "12:30" }),
    "Laatst live geladen: 12:30",
  );
  assert.equal(
    widgetSiteT("nl", "planStatusLoads"),
    "Plan: {plan} · Status: {status} · {limit} laadbeurten/maand",
  );
  assert.equal(
    widgetSiteT("nl", "planStatusLoads", {
      plan: "Pro",
      status: "Actief",
      limit: 250,
    }),
    "Plan: Pro · Status: Actief · 250 laadbeurten/maand",
  );
  assert.equal(
    localizedRecord(
      publicSurfaceLocaleOrder,
      publicToolsTranslations["No file upload"],
    ).nl,
    "Geen bestandsupload",
  );
});

test("reviewed customer portal locale overrides win every shared-catalog collision", () => {
  for (const [locale, entries] of Object.entries(
    customerPortalLocaleOverrides,
  )) {
    assert.ok(entries);
    for (const [source, expected] of Object.entries(entries)) {
      assert.equal(
        exactTranslations[locale as keyof typeof exactTranslations][source],
        expected,
        `exact override: ${locale}:${source}`,
      );
      assert.equal(
        termTranslations[locale as keyof typeof termTranslations][source],
        expected,
        `term override: ${locale}:${source}`,
      );
    }
  }

});

test("File Expert unknown-operation copy rejects raw stock terminology", () => {
  const source =
    "No specific operation can be named safely from this file. This does not mean the file is stock.";
  assert.deepEqual(
    {
      tr: exactTranslations.tr[source],
      nl: exactTranslations.nl[source],
      it: exactTranslations.it[source],
      es: exactTranslations.es[source],
      pt: exactTranslations.pt[source],
      sq: exactTranslations.sq[source],
    },
    {
      tr: "Bu dosyadan belirli bir işlem güvenle tespit edilemez. Bu, dosyanın orijinal olduğu anlamına gelmez.",
      nl: "Uit dit bestand kan geen specifieke bewerking veilig worden vastgesteld. Dat betekent niet dat het bestand origineel is.",
      it: "Non è possibile identificare con certezza un'operazione specifica in questo file. Ciò non significa che il file sia originale.",
      es: "No se puede identificar con seguridad una operación concreta en este archivo. Esto no significa que el archivo sea original.",
      pt: "Não é possível identificar com segurança uma operação específica neste ficheiro. Isto não significa que o ficheiro seja original.",
      sq: "Nga ky skedar nuk mund të përcaktohet me siguri një veprim i caktuar. Kjo nuk do të thotë se skedari është origjinal.",
    },
  );
});

test("datalog sample labels and dyno boundary use native measurement wording", () => {
  for (const key of ["sample", "channelSample"] as const) {
    assert.equal(logStudioT("de", key), "Messpunkt", `${key}: de`);
    assert.equal(logStudioT("nl", key), "Meetpunt", `${key}: nl`);
  }

  const dynoGoldens = {
    fr: "La puissance calculée à partir du couple et du régime n’équivaut pas au résultat d’un banc de puissance étalonné.",
    it: "La potenza calcolata da coppia e RPM non equivale al risultato di un banco prova calibrato.",
    es: "La potencia calculada a partir del par y las RPM no equivale al resultado de un banco de potencia calibrado.",
    pt: "A potência calculada a partir do binário e das RPM não equivale ao resultado de um banco de potência calibrado.",
    sq: "Fuqia e llogaritur nga çift-rrotullimi dhe RPM nuk është e barasvlershme me rezultatin e një dinamometri të kalibruar.",
  } as const;
  for (const key of [
    "analyzer.risk.dyno",
    "analyzer.confidence.dynoCap",
  ] as const) {
    for (const [locale, expected] of Object.entries(dynoGoldens)) {
      assert.equal(
        logStudioT(locale as keyof typeof dynoGoldens, key),
        expected,
        `${key}: ${locale}`,
      );
    }
  }

  assert.equal(
    logStudioT("sq", "studio.summary.boundary"),
    "Kufiri: vetëm shqyrtim numerik lokal në shfletues; jo diagnozë, dinamometër, miratim tuning apo vendim dorëzimi.",
  );

  const mismatchGoldens = {
    "studio.warning.unitMismatch": {
      it: "Il canale effettivo e quello target di {channel} hanno unità mancanti o incompatibili; non è stata calcolata alcuna differenza.",
      sq: "Kanali real dhe ai i synuar i {channel} kanë njësi që mungojnë ose nuk përputhen; diferenca nuk u llogarit.",
    },
    "studio.warning.sensorMismatch": {
      it: "Il canale effettivo e quello target di {channel} hanno identificatori del sensore ambigui; non è stata calcolata alcuna differenza.",
      sq: "Kanali real dhe ai i synuar i {channel} kanë identitete të paqarta të sensorit; diferenca nuk u llogarit.",
    },
  } as const;
  for (const [key, goldens] of Object.entries(mismatchGoldens)) {
    for (const [locale, expected] of Object.entries(goldens)) {
      assert.equal(
        logStudioT(
          locale as "it" | "sq",
          key as keyof typeof mismatchGoldens,
        ),
        expected,
        `${key}: ${locale}`,
      );
      assert.equal(
        logStudioT(
          locale as "it" | "sq",
          key as keyof typeof mismatchGoldens,
          { channel: "Boost" },
        ),
        expected.replace("{channel}", "Boost"),
        `${key}: ${locale}: placeholder`,
      );
    }
  }
});

test("controller identification is technical across service intent and File Expert", () => {
  const technicalIdentitySources = [
    "This public page does not inspect, upload, modify or approve a controller file. Exact support depends on the submitted identity, source file and workshop context.",
    "Review-first Stage 2 ECU file service for workshops with documented hardware changes, exact vehicle and ECU identity, original-file context and technical notes.",
    "Stage 2 should not be treated as a generic step above Stage 1. The request needs a clear hardware inventory, exact ECU identity, original-file context and a realistic technical target before compatibility can be reviewed.",
    "Identity before calibration",
    "MG AutoTech reviews identity, file context and the requested scope before work continues.",
    "Yes, but the ECU and TCU should keep separate original files and controller identities. Mention the gearbox and torque context in the request.",
    "Stage 3 describes an extensively modified powertrain, not one universal software package. Feasibility and calibration scope depend on the exact turbocharger, injectors, fuel system, engine components, sensors, cooling, transmission, ECU identity and the quality of the available technical evidence.",
    "The exact ECU supplier, family, HW/SW identity, calibration context and untouched source file are available.",
    "Build identity",
    "Do not assume so. File history, identity and read coverage must be reviewed. An untouched original or verified source context may be required before work can continue.",
    "TCU and gearbox file-service workflow for supported DSG, ZF, VGS, DCT and PDK controller requests with exact identity, original-read and torque context.",
    "TCU tuning requests with gearbox identity kept separate and clear.",
    "Exact TCU identity",
    "Controller and software identity are reviewed independently from the vehicle badge or gearbox marketing name.",
    "ECU file-check request route for workshops that need source-file, identity, read coverage or original-file context reviewed before further work.",
    "A file name or file size cannot prove that an ECU read is correct or original. A useful review combines the source file with exact controller identity, read method, vehicle context and the reason the workshop needs verification.",
    "A precise question: originality, identity, read coverage, software version or request readiness",
    "Identity consistency",
    "MG AutoTech reviews the available identity, source and read-method evidence without relying on one weak signal.",
    "No. Filenames are useful labels, not proof. Controller identity, read method, file context and known history should be reviewed together.",
  ] as const;
  const personalIdentityPatternByLocale = {
    de: /Identität/iu,
    tr: /kimli(?:k|ğ)/iu,
    nl: /identiteit/iu,
    fr: /identité/iu,
    it: /identità/iu,
    es: /identidad/iu,
    pt: /identidade/iu,
    pl: /tożsamoś/iu,
    ru: /идентичност/iu,
    zh: /身份/u,
    sq: /identitet/iu,
  } as const;

  for (const source of technicalIdentitySources) {
    const localized = localizedRecord(
      serviceIntentLocaleOrder,
      serviceIntentExactTranslations[source],
    );
    for (const [locale, pattern] of Object.entries(
      personalIdentityPatternByLocale,
    )) {
      assert.doesNotMatch(localized[locale], pattern, `${source}: ${locale}`);
    }
  }

  const vehicleMultipleRow = fileExpertReportRows.find(
    ([key]) => key === "vehicleMultiple",
  );
  assert.ok(vehicleMultipleRow);
  const vehicleMultiple = localizedRecord(
    fileExpertReportLocaleOrder,
    vehicleMultipleRow.slice(1),
  );
  assert.deepEqual(vehicleMultiple, {
    en: "{target} appears in {count} vehicle applications. ECU identity alone does not prove the exact vehicle or engine.",
    de: "{target} kommt in {count} Fahrzeuganwendungen vor. Die ECU-Identifikation allein belegt weder das genaue Fahrzeug noch den Motor.",
    tr: "{target}, {count} araç uygulamasında bulunuyor. Yalnızca ECU tanımlaması kesin aracı veya motoru kanıtlamaz.",
    nl: "{target} komt voor in {count} voertuigtoepassingen. Alleen de ECU-identificatie bewijst niet het exacte voertuig of de motor.",
    fr: "{target} apparaît dans {count} applications véhicule. L’identification de l’ECU seule ne prouve ni le véhicule ni le moteur exact.",
    it: "{target} compare in {count} applicazioni veicolo. La sola identificazione ECU non dimostra il veicolo o il motore esatto.",
    es: "{target} aparece en {count} aplicaciones de vehículo. La identificación de la ECU por sí sola no demuestra el vehículo ni el motor exactos.",
    pt: "{target} aparece em {count} aplicações de veículo. A identificação da ECU, por si só, não prova o veículo nem o motor exatos.",
    pl: "{target} występuje w {count} zastosowaniach pojazdu. Sama identyfikacja ECU nie potwierdza dokładnego pojazdu ani silnika.",
    ru: "{target} встречается в {count} вариантах автомобиля. Одна лишь идентификация ECU не подтверждает точную модель или двигатель.",
    zh: "{target} 出现在 {count} 个车型应用中；仅凭 ECU 识别信息无法证明具体车辆或发动机。",
    sq: "{target} shfaqet në {count} zbatime automjeti. Vetëm identifikimi i ECU-së nuk vërteton automjetin ose motorin e saktë.",
  });

  assert.deepEqual(
    localizedRecord(
      customerSurfaceLocaleOrder,
      customerSurfaceTranslations["ECU identity match"],
    ),
    {
      de: "Abgleich der ECU-Identifikation",
      tr: "ECU tanımlama eşleşmesi",
      nl: "Overeenkomst van de ECU-identificatie",
      fr: "Correspondance de l’identification de l’ECU",
      it: "Corrispondenza dell’identificazione ECU",
      ru: "Совпадение идентификаторов ECU",
      es: "Coincidencia de la identificación de la ECU",
      pt: "Correspondência da identificação da ECU",
      zh: "ECU 识别信息匹配",
      pl: "Zgodność identyfikacji ECU",
      sq: "Përputhja e identifikimit të ECU-së",
    },
  );
});

test("workshop request checklist uses native customer-visible email guidance", () => {
  const emailSource =
    "A reachable account email for customer-visible questions";
  const emailLocalized = localizedRecord(
    workshopGuideLocaleOrder,
    workshopGuideExactTranslations[emailSource],
  );

  assert.equal(
    emailLocalized.de,
    "Eine erreichbare Konto-E-Mail-Adresse für Rückfragen, die der Kunde sehen kann.",
  );

  const fileSizeSource =
    "No. File size is only one metadata point and cannot prove the controller identity, read method or coverage by itself.";
  const fileSizeLocalized = localizedRecord(
    workshopGuideLocaleOrder,
    workshopGuideExactTranslations[fileSizeSource],
  );
  assert.equal(
    fileSizeLocalized.pl,
    "Nie. Rozmiar pliku jest tylko jednym elementem metadanych i sam nie potwierdza tożsamości sterownika, metody ani zakresu odczytu.",
  );
});

test("master localization catalogs contain no zero-width spaces", () => {
  const masterCatalogs = [
    "src/lib/i18n/customer-workflow-translations.ts",
    "src/lib/i18n/public-core-translations.ts",
    "src/lib/i18n/public-services-translations.ts",
    "src/lib/i18n/public-tools-translations.ts",
    "src/lib/i18n/public-vehicle-translations.ts",
    "src/lib/i18n/workshop-guides-translations.ts",
  ] as const;
  for (const relativePath of masterCatalogs) {
    const contents = readFileSync(resolve(process.cwd(), relativePath), "utf8");
    assert.doesNotMatch(contents, /\u200B/u, relativePath);
  }
});
