import assert from "node:assert/strict";
import test from "node:test";
import { exactTranslations } from "../src/lib/i18n";
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
import { logStudioT } from "../src/lib/i18n/log-analysis-studio-translations";
import {
  serviceIntentExactTranslations,
  serviceIntentLocaleOrder,
} from "../src/lib/i18n/service-intent-translations";

function localizedRecord(
  localeOrder: readonly string[],
  translations: readonly string[],
) {
  return Object.fromEntries(
    localeOrder.map((locale, index) => [locale, translations[index]]),
  );
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

  const advisor = localizedRecord(
    publicSurfaceLocaleOrder,
    publicToolsTranslations["ECU Read Method Advisor"],
  );
  assert.equal(advisor.de, "Berater für ECU-Auslesemethoden");
  assert.equal(advisor.it, "Guida al metodo di lettura ECU");
  assert.equal(advisor.ru, "Помощник по выбору метода чтения ECU");

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
