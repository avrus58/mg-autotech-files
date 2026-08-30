import type {
  FileExpertAnalyzerResult,
  FileExpertChangeClassification,
  FileExpertChangeProfile,
  FileExpertFeature,
  FileExpertFileFormat,
  FileExpertFinding,
  FileExpertIntegrityAssessment,
  FileExpertPossibleFeature,
  FileExpertReadScope,
  FileExpertVehicleCandidate,
  FileExpertVehicleMatch,
} from "@/lib/fileExpert/types";
import {
  localizeFileExpertDetection,
} from "@/lib/i18n/customer-runtime-translations";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";

export const fileExpertReportLocaleOrder = [
  "en",
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
] as const satisfies readonly LocaleCode[];

type TranslationRow = readonly [
  key: string,
  en: string,
  de: string,
  tr: string,
  nl: string,
  fr: string,
  it: string,
  es: string,
  pt: string,
  pl: string,
  ru: string,
  zh: string,
  sq: string,
];

/**
 * Customer-safe File Expert copy. Only finite analyzer enums and deterministic
 * analyzer templates belong here. Customer notes, file names, vehicle names,
 * ECU identifiers and arbitrary provider output must never be added by fuzzy
 * matching.
 */
export const fileExpertReportRows = [
  ["formatBinary", "Binary file", "Binärdatei", "İkili dosya", "Binair bestand", "Fichier binaire", "File binario", "Archivo binario", "Ficheiro binário", "Plik binarny", "Двоичный файл", "二进制文件", "Skedar binar"],
  ["formatIntelHex", "Intel HEX", "Intel HEX", "Intel HEX", "Intel HEX", "Intel HEX", "Intel HEX", "Intel HEX", "Intel HEX", "Intel HEX", "Intel HEX", "Intel HEX", "Intel HEX"],
  ["formatMotorola", "Motorola S-record", "Motorola S-Record", "Motorola S-record", "Motorola S-record", "Motorola S-record", "Motorola S-record", "Motorola S-record", "Motorola S-record", "Motorola S-record", "Motorola S-record", "Motorola S-record", "Motorola S-record"],
  ["formatZip", "ZIP archive", "ZIP-Archiv", "ZIP arşivi", "ZIP-archief", "Archive ZIP", "Archivio ZIP", "Archivo ZIP", "Arquivo ZIP", "Archiwum ZIP", "ZIP-архив", "ZIP 压缩包", "Arkiv ZIP"],
  ["formatFrf", "FRF container", "FRF-Container", "FRF kapsayıcısı", "FRF-container", "Conteneur FRF", "Contenitore FRF", "Contenedor FRF", "Contentor FRF", "Kontener FRF", "Контейнер FRF", "FRF 容器", "Kontejner FRF"],
  ["formatProtected", "Encrypted or compressed", "Verschlüsselt oder komprimiert", "Şifrelenmiş veya sıkıştırılmış", "Versleuteld of gecomprimeerd", "Chiffré ou compressé", "Crittografato o compresso", "Cifrado o comprimido", "Encriptado ou comprimido", "Zaszyfrowany lub skompresowany", "Зашифрован или сжат", "已加密或压缩", "I enkriptuar ose i kompresuar"],
  ["formatUnknown", "Unknown format", "Unbekanntes Format", "Bilinmeyen biçim", "Onbekend formaat", "Format inconnu", "Formato sconosciuto", "Formato desconocido", "Formato desconhecido", "Nieznany format", "Неизвестный формат", "未知格式", "Format i panjohur"],
  ["scopeFull", "Full read", "Vollständiger Read", "Tam okuma", "Volledige uitlezing", "Lecture complète", "Lettura completa", "Lectura completa", "Leitura completa", "Pełny odczyt", "Полное чтение", "完整读取", "Lexim i plotë"],
  ["scopeCalibration", "Calibration area", "Kalibrierbereich", "Kalibrasyon alanı", "Kalibratiegebied", "Zone de calibration", "Area di calibrazione", "Área de calibración", "Área de calibração", "Obszar kalibracji", "Область калибровки", "标定区域", "Zona e kalibrimit"],
  ["scopePartial", "Partial read", "Teil-Read", "Kısmi okuma", "Gedeeltelijke uitlezing", "Lecture partielle", "Lettura parziale", "Lectura parcial", "Leitura parcial", "Odczyt częściowy", "Частичное чтение", "部分读取", "Lexim i pjesshëm"],
  ["scopeVirtual", "Virtual read", "Virtueller Read", "Sanal okuma", "Virtuele uitlezing", "Lecture virtuelle", "Lettura virtuale", "Lectura virtual", "Leitura virtual", "Odczyt wirtualny", "Виртуальное чтение", "虚拟读取", "Lexim virtual"],
  ["scopeContainer", "Container", "Container", "Kapsayıcı", "Container", "Conteneur", "Contenitore", "Contenedor", "Contentor", "Kontener", "Контейнер", "容器", "Kontejner"],
  ["scopeUnknown", "Unknown read scope", "Unbekannter Read-Umfang", "Bilinmeyen okuma kapsamı", "Onbekende uitleesomvang", "Périmètre de lecture inconnu", "Ambito di lettura sconosciuto", "Alcance de lectura desconocido", "Âmbito de leitura desconhecido", "Nieznany zakres odczytu", "Неизвестный объём чтения", "未知读取范围", "Shtrirje e panjohur e leximit"],
  ["featureStock", "Stock / Modified", "Serie / Modifiziert", "Stok / Modifiye", "Standaard / Gewijzigd", "Origine / Modifié", "Originale / Modificato", "De serie / Modificado", "Original / Modificado", "Seryjny / Zmodyfikowany", "Сток / Модифицирован", "原厂 / 已修改", "Standard / I modifikuar"],
  ["featurePopBangs", "Pop & Bangs", "Schubknallen", "Pop & Bangs", "Pops & Bangs", "Pops & Bangs", "Pop & Bangs", "Pops & Bangs", "Pops & Bangs", "Pop & Bangs", "Попкорн", "回火声浪", "Pop & Bangs"],
  ["featureTcuTune", "TCU Tune", "TCU-Abstimmung", "TCU yazılımı", "TCU-afstelling", "Optimisation TCU", "Ottimizzazione TCU", "Ajuste de TCU", "Otimização da TCU", "Strojenie TCU", "Настройка TCU", "TCU 调校", "Optimizim TCU"],
  ["featureTcuShift", "TCU Shift", "TCU-Schaltoptimierung", "TCU vites geçişi", "TCU-schakeloptimalisatie", "Optimisation des passages TCU", "Ottimizzazione cambiata TCU", "Optimización de cambios TCU", "Otimização das mudanças TCU", "Optymalizacja zmiany biegów TCU", "Оптимизация переключений TCU", "TCU 换挡优化", "Optimizim i ndërrimit TCU"],
  ["featureTcuLockup", "TCU Lockup", "TCU-Wandlerüberbrückung", "TCU kilitleme", "TCU-lock-up", "Verrouillage TCU", "Blocco convertitore TCU", "Bloqueo TCU", "Bloqueio TCU", "Blokada konwertera TCU", "Блокировка гидротрансформатора TCU", "TCU 锁止优化", "Bllokim TCU"],
  ["changeSingleLabel", "Single-file inspection", "Einzeldatei-Prüfung", "Tek dosya incelemesi", "Controle van één bestand", "Inspection d’un seul fichier", "Analisi di un singolo file", "Inspección de un solo archivo", "Inspeção de um único ficheiro", "Kontrola pojedynczego pliku", "Проверка одного файла", "单文件检查", "Kontroll i një skedari"],
  ["changeMismatchLabel", "File structure mismatch", "Abweichende Dateistruktur", "Dosya yapısı uyuşmazlığı", "Bestandsstructuren komen niet overeen", "Incompatibilité de structure des fichiers", "Struttura dei file non corrispondente", "Estructura de archivos incompatible", "Estrutura dos ficheiros incompatível", "Niezgodna struktura plików", "Несоответствие структуры файлов", "文件结构不匹配", "Mospërputhje e strukturës së skedarëve"],
  ["changeIdenticalLabel", "Files are identical", "Dateien sind identisch", "Dosyalar aynı", "Bestanden zijn identiek", "Les fichiers sont identiques", "I file sono identici", "Los archivos son idénticos", "Os ficheiros são idênticos", "Pliki są identyczne", "Файлы идентичны", "文件完全相同", "Skedarët janë identikë"],
  ["changeFocusedLabel", "Focused calibration changes", "Gezielte Kalibrierungsänderungen", "Odaklı kalibrasyon değişiklikleri", "Gerichte kalibratiewijzigingen", "Modifications de calibration ciblées", "Modifiche di calibrazione mirate", "Cambios de calibración localizados", "Alterações de calibração focadas", "Skupione zmiany kalibracji", "Локальные изменения калибровок", "集中式标定更改", "Ndryshime të fokusuara të kalibrimit"],
  ["changeDistributedLabel", "Distributed calibration changes", "Verteilte Kalibrierungsänderungen", "Dağıtılmış kalibrasyon değişiklikleri", "Verspreide kalibratiewijzigingen", "Modifications de calibration réparties", "Modifiche di calibrazione distribuite", "Cambios de calibración distribuidos", "Alterações de calibração distribuídas", "Rozproszone zmiany kalibracji", "Распределённые изменения калибровок", "分布式标定更改", "Ndryshime të shpërndara të kalibrimit"],
  ["changeBroadLabel", "Broad file changes", "Umfangreiche Dateiänderungen", "Geniş kapsamlı dosya değişiklikleri", "Omvangrijke bestandswijzigingen", "Modifications étendues du fichier", "Modifiche estese del file", "Cambios amplios en el archivo", "Alterações extensas no ficheiro", "Rozległe zmiany pliku", "Обширные изменения файла", "大范围文件更改", "Ndryshime të gjera të skedarit"],
  ["notDetected", "Not detected", "Nicht erkannt", "Tespit edilmedi", "Niet gedetecteerd", "Non détecté", "Non rilevato", "No detectado", "Não detetado", "Nie wykryto", "Не обнаружено", "未检测到", "Nuk u zbulua"],
  ["notIdentified", "Not identified", "Nicht identifiziert", "Tanımlanmadı", "Niet geïdentificeerd", "Non identifié", "Non identificato", "No identificado", "Não identificado", "Nie zidentyfikowano", "Не идентифицировано", "未识别", "Nuk u identifikua"],
  ["unknown", "Unknown", "Unbekannt", "Bilinmiyor", "Onbekend", "Inconnu", "Sconosciuto", "Desconocido", "Desconhecido", "Nieznane", "Неизвестно", "未知", "E panjohur"],
  ["notUploaded", "Not uploaded", "Nicht hochgeladen", "Yüklenmedi", "Niet geüpload", "Non téléversé", "Non caricato", "No subido", "Não carregado", "Nie przesłano", "Не загружено", "未上传", "Nuk u ngarkua"],
  ["loadingReport", "Loading File Expert report...", "File-Expert-Bericht wird geladen …", "File Expert raporu yükleniyor...", "File Expert-rapport wordt geladen...", "Chargement du rapport File Expert…", "Caricamento del rapporto File Expert…", "Cargando el informe File Expert…", "A carregar o relatório File Expert…", "Ładowanie raportu File Expert…", "Загрузка отчёта File Expert…", "正在加载 File Expert 报告…", "Po ngarkohet raporti File Expert…"],
  ["reportNotFound", "Report not found", "Bericht nicht gefunden", "Rapor bulunamadı", "Rapport niet gevonden", "Rapport introuvable", "Rapporto non trovato", "Informe no encontrado", "Relatório não encontrado", "Nie znaleziono raportu", "Отчёт не найден", "未找到报告", "Raporti nuk u gjet"],
  ["reportUnavailable", "This report is not available.", "Dieser Bericht ist nicht verfügbar.", "Bu rapor kullanılamıyor.", "Dit rapport is niet beschikbaar.", "Ce rapport n’est pas disponible.", "Questo rapporto non è disponibile.", "Este informe no está disponible.", "Este relatório não está disponível.", "Ten raport jest niedostępny.", "Этот отчёт недоступен.", "此报告不可用。", "Ky raport nuk është i disponueshëm."],
  ["reportLoadError", "The File Expert report could not be loaded. Please try again.", "Der File-Expert-Bericht konnte nicht geladen werden. Bitte versuchen Sie es erneut.", "File Expert raporu yüklenemedi. Lütfen yeniden deneyin.", "Het File Expert-rapport kon niet worden geladen. Probeer het opnieuw.", "Le rapport File Expert n’a pas pu être chargé. Veuillez réessayer.", "Impossibile caricare il rapporto File Expert. Riprova.", "No se pudo cargar el informe File Expert. Inténtelo de nuevo.", "Não foi possível carregar o relatório File Expert. Tente novamente.", "Nie udało się załadować raportu File Expert. Spróbuj ponownie.", "Не удалось загрузить отчёт File Expert. Повторите попытку.", "无法加载 File Expert 报告，请重试。", "Raporti File Expert nuk mund të ngarkohej. Provoni përsëri."],
  ["analysisTriggerError", "The analysis could not be started. Please try again.", "Die Analyse konnte nicht gestartet werden. Bitte versuchen Sie es erneut.", "Analiz başlatılamadı. Lütfen yeniden deneyin.", "De analyse kon niet worden gestart. Probeer het opnieuw.", "L’analyse n’a pas pu être lancée. Veuillez réessayer.", "Impossibile avviare l’analisi. Riprova.", "No se pudo iniciar el análisis. Inténtelo de nuevo.", "Não foi possível iniciar a análise. Tente novamente.", "Nie udało się uruchomić analizy. Spróbuj ponownie.", "Не удалось запустить анализ. Повторите попытку.", "无法启动分析，请重试。", "Analiza nuk mund të nisej. Provoni përsëri."],
  ["analysisPreparing", "The analysis report is being prepared.", "Der Analysebericht wird vorbereitet.", "Analiz raporu hazırlanıyor.", "Het analyserapport wordt voorbereid.", "Le rapport d’analyse est en préparation.", "Il rapporto di analisi è in preparazione.", "El informe de análisis se está preparando.", "O relatório de análise está a ser preparado.", "Raport z analizy jest przygotowywany.", "Отчёт анализа готовится.", "分析报告正在准备中。", "Raporti i analizës po përgatitet."],
  ["genericEvidence", "Additional analyzer evidence requires human review.", "Weitere Analysehinweise erfordern eine manuelle Prüfung.", "Ek analiz kanıtı insan incelemesi gerektiriyor.", "Aanvullend analysebewijs vereist menselijke beoordeling.", "Les éléments supplémentaires de l’analyse nécessitent une vérification humaine.", "Le ulteriori evidenze dell’analizzatore richiedono una verifica umana.", "Las evidencias adicionales del analizador requieren revisión humana.", "As evidências adicionais do analisador exigem revisão humana.", "Dodatkowe dane analizatora wymagają weryfikacji przez człowieka.", "Дополнительные данные анализатора требуют проверки специалистом.", "其他分析证据需要人工审核。", "Provat shtesë të analizuesit kërkojnë shqyrtim njerëzor."],
  ["summarySingle", "Only one file was supplied, so modifications cannot be confirmed without a matching original file.", "Es wurde nur eine Datei bereitgestellt. Änderungen können ohne passende Originaldatei nicht bestätigt werden.", "Yalnızca bir dosya sağlandı; eşleşen orijinal dosya olmadan değişiklikler doğrulanamaz.", "Er is slechts één bestand aangeleverd; wijzigingen kunnen zonder passend origineel niet worden bevestigd.", "Un seul fichier a été fourni ; les modifications ne peuvent pas être confirmées sans le fichier d’origine correspondant.", "È stato fornito un solo file; senza l’originale corrispondente non è possibile confermare le modifiche.", "Solo se proporcionó un archivo; sin el original correspondiente no se pueden confirmar las modificaciones.", "Foi fornecido apenas um ficheiro; sem o original correspondente não é possível confirmar alterações.", "Dostarczono tylko jeden plik, dlatego bez pasującego oryginału nie można potwierdzić zmian.", "Предоставлен только один файл; без соответствующего оригинала изменения подтвердить нельзя.", "仅提供了一个文件；没有匹配的原始文件，无法确认修改。", "U dha vetëm një skedar; pa skedarin origjinal përkatës nuk mund të konfirmohen ndryshimet."],
  ["summaryMismatch", "ORI and MOD sizes differ. This can indicate different read scopes, a container mismatch or an incompatible file pair.", "ORI und MOD haben unterschiedliche Größen. Das kann auf verschiedene Read-Umfänge, nicht passende Container oder ein inkompatibles Dateipaar hinweisen.", "ORI ve MOD boyutları farklı. Bu durum farklı okuma kapsamlarına, kapsayıcı uyuşmazlığına veya uyumsuz dosya çiftine işaret edebilir.", "ORI en MOD verschillen in grootte. Dit kan wijzen op verschillende uitleesbereiken, een containerprobleem of een incompatibel bestandspaar.", "Les tailles ORI et MOD diffèrent. Cela peut indiquer des périmètres de lecture différents, un conteneur incompatible ou une paire de fichiers non compatible.", "Le dimensioni di ORI e MOD differiscono. Ciò può indicare ambiti di lettura diversi, contenitori non corrispondenti o una coppia di file incompatibile.", "Los tamaños de ORI y MOD difieren. Puede indicar alcances de lectura distintos, contenedores incompatibles o una pareja de archivos no compatible.", "Os tamanhos de ORI e MOD diferem. Isto pode indicar âmbitos de leitura distintos, contentores incompatíveis ou um par de ficheiros incompatível.", "Rozmiary ORI i MOD różnią się. Może to wskazywać na inny zakres odczytu, niezgodny kontener lub niekompatybilną parę plików.", "Размеры ORI и MOD различаются. Это может указывать на разный объём чтения, несовпадение контейнеров или несовместимую пару файлов.", "ORI 与 MOD 大小不同，可能表示读取范围不同、容器不匹配或文件对不兼容。", "Madhësitë ORI dhe MOD ndryshojnë. Kjo mund të tregojë shtrirje të ndryshme leximi, kontejnerë që nuk përputhen ose çift skedarësh të papajtueshëm."],
  ["summaryIdentical", "No binary difference was found between the uploaded ORI and MOD files.", "Zwischen den hochgeladenen ORI- und MOD-Dateien wurde kein Binärunterschied gefunden.", "Yüklenen ORI ve MOD dosyaları arasında ikili fark bulunmadı.", "Er is geen binair verschil gevonden tussen de geüploade ORI- en MOD-bestanden.", "Aucune différence binaire n’a été trouvée entre les fichiers ORI et MOD téléversés.", "Non è stata rilevata alcuna differenza binaria tra i file ORI e MOD caricati.", "No se encontró ninguna diferencia binaria entre los archivos ORI y MOD subidos.", "Não foi encontrada qualquer diferença binária entre os ficheiros ORI e MOD carregados.", "Nie znaleziono różnic binarnych między przesłanymi plikami ORI i MOD.", "Между загруженными файлами ORI и MOD не обнаружено двоичных различий.", "上传的 ORI 与 MOD 文件之间未发现二进制差异。", "Nuk u gjet dallim binar midis skedarëve ORI dhe MOD të ngarkuar."],
  ["summaryFocusedStructured", "Changes are concentrated in a limited set of structured, calibration-like regions.", "Die Änderungen konzentrieren sich auf wenige strukturierte, kalibrierungsähnliche Bereiche.", "Değişiklikler sınırlı sayıdaki yapılandırılmış, kalibrasyon benzeri bölgede yoğunlaşıyor.", "De wijzigingen zijn geconcentreerd in een beperkt aantal gestructureerde, kalibratieachtige gebieden.", "Les modifications sont concentrées dans un nombre limité de zones structurées ressemblant à des calibrations.", "Le modifiche sono concentrate in un numero limitato di aree strutturate simili a calibrazioni.", "Los cambios se concentran en un conjunto limitado de regiones estructuradas similares a calibraciones.", "As alterações concentram-se num conjunto limitado de regiões estruturadas semelhantes a calibrações.", "Zmiany koncentrują się w ograniczonej liczbie uporządkowanych obszarów przypominających kalibracje.", "Изменения сосредоточены в ограниченном числе структурированных областей, похожих на калибровки.", "更改集中在少量结构化、类似标定的区域。", "Ndryshimet janë përqendruar në një numër të kufizuar zonash të strukturuara, të ngjashme me kalibrimet."],
  ["summaryFocusedLimited", "Changes are limited to part of the file, but their exact purpose cannot be named safely.", "Die Änderungen sind auf einen Teil der Datei begrenzt, ihr genauer Zweck kann jedoch nicht sicher benannt werden.", "Değişiklikler dosyanın bir bölümüyle sınırlı ancak kesin amaçları güvenle adlandırılamıyor.", "De wijzigingen zijn beperkt tot een deel van het bestand, maar het exacte doel kan niet veilig worden benoemd.", "Les modifications sont limitées à une partie du fichier, mais leur fonction exacte ne peut pas être déterminée avec certitude.", "Le modifiche sono limitate a una parte del file, ma non è possibile definirne con sicurezza lo scopo esatto.", "Los cambios se limitan a una parte del archivo, pero no es seguro indicar su finalidad exacta.", "As alterações limitam-se a parte do ficheiro, mas não é possível indicar com segurança a sua finalidade exata.", "Zmiany ograniczają się do części pliku, ale nie można bezpiecznie określić ich dokładnego przeznaczenia.", "Изменения ограничены частью файла, однако их точное назначение нельзя определить достоверно.", "更改仅位于文件的一部分，但无法安全确定其确切用途。", "Ndryshimet kufizohen në një pjesë të skedarit, por qëllimi i tyre i saktë nuk mund të përcaktohet me siguri."],
  ["summaryDistributed", "Multiple calibration areas appear to have changed. Exact functions require map definitions or tuner review.", "Mehrere Kalibrierbereiche scheinen geändert zu sein. Die genauen Funktionen erfordern Map-Definitionen oder eine Tuner-Prüfung.", "Birden fazla kalibrasyon alanı değiştirilmiş görünüyor. Kesin işlevler için harita tanımları veya tuner incelemesi gerekir.", "Meerdere kalibratiegebieden lijken gewijzigd. Voor de exacte functies zijn mapdefinities of beoordeling door een tuner nodig.", "Plusieurs zones de calibration semblent modifiées. Les fonctions exactes nécessitent des définitions de maps ou l’examen d’un préparateur.", "Diverse aree di calibrazione sembrano modificate. Le funzioni esatte richiedono definizioni delle mappe o la verifica di un calibratore.", "Varias áreas de calibración parecen modificadas. Las funciones exactas requieren definiciones de mapas o revisión de un calibrador.", "Várias áreas de calibração parecem alteradas. As funções exatas exigem definições de mapas ou revisão de um calibrador.", "Wiele obszarów kalibracji wygląda na zmienione. Dokładne funkcje wymagają definicji map lub oceny tunera.", "Несколько областей калибровки выглядят изменёнными. Для определения функций нужны описания карт или проверка калибровщиком.", "多个标定区域似乎已更改；确切功能需要地图定义或调校人员审核。", "Disa zona kalibrimi duket se janë ndryshuar. Funksionet e sakta kërkojnë përkufizime hartash ose shqyrtim nga kalibruesi."],
  ["summaryBroad", "A large part of the file differs. Confirm that both files use the same software version and read method.", "Ein großer Teil der Datei weicht ab. Bestätigen Sie, dass beide Dateien dieselbe Softwareversion und Read-Methode verwenden.", "Dosyanın büyük bir bölümü farklı. Her iki dosyanın aynı yazılım sürümü ve okuma yöntemiyle alındığını doğrulayın.", "Een groot deel van het bestand wijkt af. Controleer of beide bestanden dezelfde softwareversie en uitleesmethode gebruiken.", "Une grande partie du fichier diffère. Confirmez que les deux fichiers utilisent la même version logicielle et la même méthode de lecture.", "Gran parte del file è diversa. Verificare che entrambi i file usino la stessa versione software e lo stesso metodo di lettura.", "Una gran parte del archivo difiere. Confirme que ambos archivos utilizan la misma versión de software y el mismo método de lectura.", "Grande parte do ficheiro difere. Confirme que ambos os ficheiros usam a mesma versão de software e o mesmo método de leitura.", "Znaczna część pliku jest inna. Potwierdź, że oba pliki mają tę samą wersję oprogramowania i metodę odczytu.", "Значительная часть файла отличается. Убедитесь, что оба файла относятся к одной версии ПО и считаны одним методом.", "文件的大部分内容不同。请确认两个文件使用相同的软件版本和读取方法。", "Një pjesë e madhe e skedarit ndryshon. Konfirmoni që të dy skedarët përdorin të njëjtin version softueri dhe metodë leximi."],
  ["evidenceSignatureBinary", "ECU signature {marker} was found inside the binary.", "Die ECU-Signatur {marker} wurde in der Binärdatei gefunden.", "{marker} ECU imzası ikili dosyada bulundu.", "ECU-signatuur {marker} is in het binaire bestand gevonden.", "La signature ECU {marker} a été trouvée dans le fichier binaire.", "La firma ECU {marker} è stata trovata nel file binario.", "La firma de ECU {marker} se encontró en el archivo binario.", "A assinatura da ECU {marker} foi encontrada no ficheiro binário.", "W pliku binarnym znaleziono sygnaturę ECU {marker}.", "Сигнатура ECU {marker} найдена в двоичном файле.", "在二进制文件中发现 ECU 特征 {marker}。", "Nënshkrimi ECU {marker} u gjet brenda skedarit binar."],
  ["evidenceSignatureFile", "ECU signature {marker} was found in the uploaded file name.", "Die ECU-Signatur {marker} wurde im Namen der hochgeladenen Datei gefunden.", "{marker} ECU imzası yüklenen dosya adında bulundu.", "ECU-signatuur {marker} is in de naam van het geüploade bestand gevonden.", "La signature ECU {marker} a été trouvée dans le nom du fichier téléversé.", "La firma ECU {marker} è stata trovata nel nome del file caricato.", "La firma de ECU {marker} se encontró en el nombre del archivo subido.", "A assinatura da ECU {marker} foi encontrada no nome do ficheiro carregado.", "Sygnaturę ECU {marker} znaleziono w nazwie przesłanego pliku.", "Сигнатура ECU {marker} найдена в имени загруженного файла.", "在上传的文件名中发现 ECU 特征 {marker}。", "Nënshkrimi ECU {marker} u gjet në emrin e skedarit të ngarkuar."],
  ["evidenceCustomerEcu", "ECU type {marker} was supplied by the customer and was not verified inside the binary.", "Der ECU-Typ {marker} wurde vom Kunden angegeben und nicht in der Binärdatei bestätigt.", "{marker} ECU türü müşteri tarafından bildirildi ve ikili dosyada doğrulanmadı.", "ECU-type {marker} is door de klant opgegeven en niet in het binaire bestand bevestigd.", "Le type d’ECU {marker} a été fourni par le client et n’a pas été vérifié dans le fichier binaire.", "Il tipo ECU {marker} è stato indicato dal cliente e non è stato verificato nel file binario.", "El cliente indicó el tipo de ECU {marker}, que no se verificó en el archivo binario.", "O tipo de ECU {marker} foi indicado pelo cliente e não foi verificado no ficheiro binário.", "Typ ECU {marker} podał klient; nie został on potwierdzony w pliku binarnym.", "Тип ECU {marker} указан клиентом и не подтверждён в двоичном файле.", "ECU 类型 {marker} 由客户提供，尚未在二进制文件中验证。", "Lloji ECU {marker} u dha nga klienti dhe nuk u verifikua brenda skedarit binar."],
  ["evidenceTechnicalMarker", "Technical marker {marker} was found inside the binary.", "Die technische Kennung {marker} wurde in der Binärdatei gefunden.", "{marker} teknik işareti ikili dosyada bulundu.", "Technische markering {marker} is in het binaire bestand gevonden.", "Le marqueur technique {marker} a été trouvé dans le fichier binaire.", "Il marcatore tecnico {marker} è stato trovato nel file binario.", "El marcador técnico {marker} se encontró en el archivo binario.", "O marcador técnico {marker} foi encontrado no ficheiro binário.", "W pliku binarnym znaleziono znacznik techniczny {marker}.", "Технический маркер {marker} найден в двоичном файле.", "在二进制文件中发现技术标记 {marker}。", "Shënuesi teknik {marker} u gjet brenda skedarit binar."],
  ["evidenceHardware", "A hardware identifier was extracted from the file content or name.", "Eine Hardwarekennung wurde aus dem Dateiinhalt oder -namen extrahiert.", "Dosya içeriğinden veya adından bir donanım kimliği çıkarıldı.", "Er is een hardware-identificatie uit de bestandsinhoud of -naam gehaald.", "Un identifiant matériel a été extrait du contenu ou du nom du fichier.", "Un identificativo hardware è stato estratto dal contenuto o dal nome del file.", "Se extrajo un identificador de hardware del contenido o del nombre del archivo.", "Foi extraído um identificador de hardware do conteúdo ou do nome do ficheiro.", "Z zawartości lub nazwy pliku odczytano identyfikator sprzętowy.", "Идентификатор оборудования извлечён из содержимого или имени файла.", "已从文件内容或名称中提取硬件标识符。", "Një identifikues hardueri u nxor nga përmbajtja ose emri i skedarit."],
  ["evidenceSoftware", "A software identifier was extracted from the file content or name.", "Eine Softwarekennung wurde aus dem Dateiinhalt oder -namen extrahiert.", "Dosya içeriğinden veya adından bir yazılım kimliği çıkarıldı.", "Er is een software-identificatie uit de bestandsinhoud of -naam gehaald.", "Un identifiant logiciel a été extrait du contenu ou du nom du fichier.", "Un identificativo software è stato estratto dal contenuto o dal nome del file.", "Se extrajo un identificador de software del contenido o del nombre del archivo.", "Foi extraído um identificador de software do conteúdo ou do nome do ficheiro.", "Z zawartości lub nazwy pliku odczytano identyfikator oprogramowania.", "Идентификатор ПО извлечён из содержимого или имени файла.", "已从文件内容或名称中提取软件标识符。", "Një identifikues softueri u nxor nga përmbajtja ose emri i skedarit."],
  ["evidenceVin", "A VIN-format identifier was found inside the binary.", "Eine Kennung im VIN-Format wurde in der Binärdatei gefunden.", "İkili dosyada VIN biçiminde bir kimlik bulundu.", "In het binaire bestand is een identificatie in VIN-formaat gevonden.", "Un identifiant au format VIN a été trouvé dans le fichier binaire.", "Nel file binario è stato trovato un identificativo in formato VIN.", "Se encontró un identificador con formato VIN en el archivo binario.", "Foi encontrado um identificador em formato VIN no ficheiro binário.", "W pliku binarnym znaleziono identyfikator w formacie VIN.", "В двоичном файле найден идентификатор формата VIN.", "在二进制文件中发现 VIN 格式标识符。", "Një identifikues në format VIN u gjet brenda skedarit binar."],
  ["evidenceEngineCode", "Engine-code marker {marker} was found in the binary or uploaded file name.", "Die Motorcode-Kennung {marker} wurde in der Binärdatei oder im hochgeladenen Dateinamen gefunden.", "{marker} motor kodu işareti ikili dosyada veya yüklenen dosya adında bulundu.", "Motorcodemarkering {marker} is in het binaire bestand of de geüploade bestandsnaam gevonden.", "Le marqueur de code moteur {marker} a été trouvé dans le fichier binaire ou le nom du fichier téléversé.", "Il marcatore del codice motore {marker} è stato trovato nel file binario o nel nome del file caricato.", "El marcador de código de motor {marker} se encontró en el archivo binario o en el nombre del archivo subido.", "O marcador do código do motor {marker} foi encontrado no ficheiro binário ou no nome do ficheiro carregado.", "Znacznik kodu silnika {marker} znaleziono w pliku binarnym lub nazwie przesłanego pliku.", "Маркер кода двигателя {marker} найден в двоичном файле или имени загруженного файла.", "在二进制文件或上传的文件名中发现发动机代码标记 {marker}。", "Shënuesi i kodit të motorit {marker} u gjet në skedarin binar ose në emrin e skedarit të ngarkuar."],
  ["evidenceConflict", "Conflicting control-unit signatures were found: {markers}.", "Widersprüchliche Steuergeräte-Signaturen wurden gefunden: {markers}.", "Çakışan kontrol ünitesi imzaları bulundu: {markers}.", "Er zijn tegenstrijdige regeleenheidsignaturen gevonden: {markers}.", "Des signatures de calculateur contradictoires ont été trouvées : {markers}.", "Sono state trovate firme della centralina in conflitto: {markers}.", "Se encontraron firmas de unidad de control incompatibles: {markers}.", "Foram encontradas assinaturas de unidade de controlo em conflito: {markers}.", "Znaleziono sprzeczne sygnatury sterownika: {markers}.", "Обнаружены конфликтующие сигнатуры блока управления: {markers}.", "发现相互冲突的控制单元特征：{markers}。", "U gjetën nënshkrime kontradiktore të njësisë së kontrollit: {markers}."],
  ["findingIdentityMissing", "No reliable ECU or TCU signature was found. HW/SW identification from the read tool may be required.", "Es wurde keine zuverlässige ECU- oder TCU-Signatur gefunden. Möglicherweise ist die HW-/SW-Identifikation des Lesegeräts erforderlich.", "Güvenilir ECU veya TCU imzası bulunamadı. Okuma cihazından HW/SW kimliği gerekebilir.", "Er is geen betrouwbare ECU- of TCU-signatuur gevonden. HW/SW-identificatie uit de leestool kan nodig zijn.", "Aucune signature ECU ou TCU fiable n’a été trouvée. L’identification HW/SW de l’outil de lecture peut être nécessaire.", "Non è stata trovata una firma ECU o TCU affidabile. Potrebbe essere necessaria l’identificazione HW/SW dello strumento di lettura.", "No se encontró una firma fiable de ECU o TCU. Puede ser necesaria la identificación HW/SW de la herramienta de lectura.", "Não foi encontrada uma assinatura fiável de ECU ou TCU. Pode ser necessária a identificação HW/SW da ferramenta de leitura.", "Nie znaleziono wiarygodnej sygnatury ECU ani TCU. Może być potrzebna identyfikacja HW/SW z narzędzia odczytowego.", "Надёжная сигнатура ECU или TCU не найдена. Может потребоваться идентификация HW/SW из инструмента чтения.", "未找到可靠的 ECU 或 TCU 特征，可能需要读取工具提供的 HW/SW 标识。", "Nuk u gjet nënshkrim i besueshëm ECU ose TCU. Mund të kërkohet identifikimi HW/SW nga mjeti i leximit."],
  ["findingIdentityStatus", "{module} identification status: {status}.", "Status der {module}-Identifikation: {status}.", "{module} tanımlama durumu: {status}.", "Status van {module}-identificatie: {status}.", "État de l’identification {module} : {status}.", "Stato dell’identificazione {module}: {status}.", "Estado de identificación de {module}: {status}.", "Estado da identificação {module}: {status}.", "Status identyfikacji {module}: {status}.", "Статус идентификации {module}: {status}.", "{module} 识别状态：{status}。", "Gjendja e identifikimit {module}: {status}."],
  ["findingFileProfile", "Format: {format}. Read scope: {scope}.", "Format: {format}. Read-Umfang: {scope}.", "Biçim: {format}. Okuma kapsamı: {scope}.", "Formaat: {format}. Uitleesomvang: {scope}.", "Format : {format}. Périmètre de lecture : {scope}.", "Formato: {format}. Ambito di lettura: {scope}.", "Formato: {format}. Alcance de lectura: {scope}.", "Formato: {format}. Âmbito de leitura: {scope}.", "Format: {format}. Zakres odczytu: {scope}.", "Формат: {format}. Объём чтения: {scope}.", "格式：{format}。读取范围：{scope}。", "Formati: {format}. Shtrirja e leximit: {scope}."],
  ["findingCalibration", "{count} structured change regions resemble calibration data. Exact map names require ECU-specific definitions.", "{count} strukturierte Änderungsbereiche ähneln Kalibrierungsdaten. Genaue Map-Namen erfordern ECU-spezifische Definitionen.", "{count} yapılandırılmış değişiklik bölgesi kalibrasyon verisine benziyor. Kesin harita adları ECU'ya özel tanımlar gerektirir.", "{count} gestructureerde wijzigingsgebieden lijken op kalibratiegegevens. Exacte mapnamen vereisen ECU-specifieke definities.", "{count} zones de modification structurées ressemblent à des données de calibration. Les noms exacts des maps nécessitent des définitions propres à l’ECU.", "{count} aree di modifica strutturate assomigliano a dati di calibrazione. I nomi esatti delle mappe richiedono definizioni specifiche per ECU.", "{count} regiones de cambio estructuradas se parecen a datos de calibración. Los nombres exactos de los mapas requieren definiciones específicas de la ECU.", "{count} regiões de alteração estruturadas assemelham-se a dados de calibração. Os nomes exatos dos mapas exigem definições específicas da ECU.", "{count} uporządkowanych obszarów zmian przypomina dane kalibracyjne. Dokładne nazwy map wymagają definicji dla konkretnego ECU.", "{count} структурированных областей изменений похожи на калибровочные данные. Для точных названий карт нужны определения конкретного ECU.", "{count} 个结构化更改区域类似标定数据；确切地图名称需要特定 ECU 的定义。", "{count} zona të strukturuara ndryshimi ngjajnë me të dhëna kalibrimi. Emrat e saktë të hartave kërkojnë përkufizime specifike për ECU-në."],
  ["findingNoConflict", "The automated checks found no obvious ORI/MOD structural conflict. Checksum remains unverified.", "Die automatischen Prüfungen fanden keinen offensichtlichen ORI-/MOD-Strukturkonflikt. Die Prüfsumme ist weiterhin nicht verifiziert.", "Otomatik kontroller belirgin bir ORI/MOD yapı çakışması bulmadı. Sağlama toplamı hâlâ doğrulanmadı.", "De automatische controles vonden geen duidelijk structureel ORI/MOD-conflict. De checksum is nog niet geverifieerd.", "Les contrôles automatiques n’ont trouvé aucun conflit structurel ORI/MOD évident. Le checksum reste non vérifié.", "I controlli automatici non hanno rilevato conflitti strutturali ORI/MOD evidenti. Il checksum resta non verificato.", "Las comprobaciones automáticas no encontraron conflictos estructurales ORI/MOD evidentes. El checksum sigue sin verificarse.", "As verificações automáticas não encontraram conflitos estruturais ORI/MOD evidentes. O checksum continua por verificar.", "Automatyczne kontrole nie wykryły wyraźnego konfliktu struktury ORI/MOD. Suma kontrolna nadal nie jest zweryfikowana.", "Автоматические проверки не выявили явного структурного конфликта ORI/MOD. Контрольная сумма не проверена.", "自动检查未发现明显的 ORI/MOD 结构冲突；校验和仍未验证。", "Kontrollet automatike nuk gjetën konflikt të dukshëm strukturor ORI/MOD. Checksum-i mbetet i paverifikuar."],
  ["vehicleFindingTitle", "{count} compatible vehicle applications", "{count} kompatible Fahrzeuganwendungen", "{count} uyumlu araç uygulaması", "{count} compatibele voertuigtoepassingen", "{count} applications véhicule compatibles", "{count} applicazioni veicolo compatibili", "{count} aplicaciones de vehículo compatibles", "{count} aplicações de veículo compatíveis", "{count} zgodnych zastosowań pojazdu", "{count} совместимых вариантов автомобиля", "{count} 个兼容车型应用", "{count} zbatime të pajtueshme automjeti"],
  ["vehicleNoFamily", "The vehicle and engine could not be matched because no reliable ECU family was identified.", "Fahrzeug und Motor konnten nicht zugeordnet werden, da keine zuverlässige ECU-Familie erkannt wurde.", "Güvenilir bir ECU ailesi tanımlanamadığı için araç ve motor eşleştirilemedi.", "Voertuig en motor konden niet worden gekoppeld omdat geen betrouwbare ECU-familie is geïdentificeerd.", "Le véhicule et le moteur n’ont pas pu être associés, car aucune famille d’ECU fiable n’a été identifiée.", "Veicolo e motore non possono essere abbinati perché non è stata identificata una famiglia ECU affidabile.", "No se pudieron asociar el vehículo y el motor porque no se identificó una familia de ECU fiable.", "Não foi possível associar o veículo e o motor porque não foi identificada uma família de ECU fiável.", "Nie udało się dopasować pojazdu i silnika, ponieważ nie zidentyfikowano wiarygodnej rodziny ECU.", "Автомобиль и двигатель не удалось сопоставить, поскольку надёжное семейство ECU не определено.", "由于未识别到可靠的 ECU 系列，无法匹配车辆和发动机。", "Automjeti dhe motori nuk mund të përputheshin sepse nuk u identifikua një familje ECU e besueshme."],
  ["vehicleExact", "One vehicle application matches the ECU and engine identifiers found in the file.", "Eine Fahrzeuganwendung passt zu den ECU- und Motorkennungen in der Datei.", "Bir araç uygulaması dosyada bulunan ECU ve motor kimlikleriyle eşleşiyor.", "Eén voertuigtoepassing komt overeen met de ECU- en motoridentificaties in het bestand.", "Une application véhicule correspond aux identifiants ECU et moteur trouvés dans le fichier.", "Un’applicazione veicolo corrisponde agli identificativi ECU e motore trovati nel file.", "Una aplicación de vehículo coincide con los identificadores de ECU y motor encontrados en el archivo.", "Uma aplicação de veículo corresponde aos identificadores de ECU e motor encontrados no ficheiro.", "Jedno zastosowanie pojazdu pasuje do identyfikatorów ECU i silnika znalezionych w pliku.", "Один вариант автомобиля совпадает с идентификаторами ECU и двигателя в файле.", "一个车型应用与文件中发现的 ECU 和发动机标识符匹配。", "Një zbatim automjeti përputhet me identifikuesit ECU dhe të motorit të gjetur në skedar."],
  ["vehicleMultiple", "{target} appears in {count} vehicle applications. ECU identity alone does not prove the exact vehicle or engine.", "{target} kommt in {count} Fahrzeuganwendungen vor. Die ECU-Identität allein belegt weder das genaue Fahrzeug noch den Motor.", "{target}, {count} araç uygulamasında bulunuyor. Yalnızca ECU kimliği kesin aracı veya motoru kanıtlamaz.", "{target} komt voor in {count} voertuigtoepassingen. Alleen de ECU-identiteit bewijst niet het exacte voertuig of de motor.", "{target} apparaît dans {count} applications véhicule. L’identité de l’ECU seule ne prouve ni le véhicule ni le moteur exact.", "{target} compare in {count} applicazioni veicolo. La sola identità ECU non dimostra il veicolo o il motore esatto.", "{target} aparece en {count} aplicaciones de vehículo. La identidad de la ECU por sí sola no demuestra el vehículo ni el motor exactos.", "{target} aparece em {count} aplicações de veículo. A identidade da ECU, por si só, não prova o veículo nem o motor exatos.", "{target} występuje w {count} zastosowaniach pojazdu. Sama identyfikacja ECU nie potwierdza dokładnego pojazdu ani silnika.", "{target} встречается в {count} вариантах автомобиля. Одна лишь идентификация ECU не подтверждает точную модель или двигатель.", "{target} 出现在 {count} 个车型应用中；仅凭 ECU 身份无法证明具体车辆或发动机。", "{target} shfaqet në {count} zbatime automjeti. Vetëm identiteti ECU nuk vërteton automjetin ose motorin e saktë."],
  ["vehicleNoMatch", "{target} was identified, but no matching vehicle application was found in the local database.", "{target} wurde erkannt, in der lokalen Datenbank wurde jedoch keine passende Fahrzeuganwendung gefunden.", "{target} tanımlandı ancak yerel veritabanında eşleşen araç uygulaması bulunamadı.", "{target} is geïdentificeerd, maar in de lokale database is geen passende voertuigtoepassing gevonden.", "{target} a été identifié, mais aucune application véhicule correspondante n’a été trouvée dans la base locale.", "{target} è stato identificato, ma nel database locale non è stata trovata alcuna applicazione veicolo corrispondente.", "Se identificó {target}, pero no se encontró una aplicación de vehículo coincidente en la base de datos local.", "{target} foi identificado, mas não foi encontrada uma aplicação de veículo correspondente na base de dados local.", "Zidentyfikowano {target}, ale w lokalnej bazie nie znaleziono pasującego zastosowania pojazdu.", "{target} идентифицирован, но в локальной базе не найден соответствующий вариант автомобиля.", "已识别 {target}，但在本地数据库中未找到匹配的车型应用。", "{target} u identifikua, por në bazën lokale nuk u gjet zbatim automjeti që përputhet."],
  ["vehicleCandidateEvidence", "The ECU listing and the supplied vehicle evidence support this candidate; exact confirmation still requires human review.", "ECU-Liste und bereitgestellte Fahrzeugangaben stützen diesen Kandidaten; die genaue Bestätigung erfordert weiterhin eine manuelle Prüfung.", "ECU listesi ve sağlanan araç kanıtı bu adayı destekliyor; kesin doğrulama için yine insan incelemesi gerekir.", "De ECU-lijst en de aangeleverde voertuiggegevens ondersteunen deze kandidaat; exacte bevestiging vereist nog menselijke beoordeling.", "La liste ECU et les données véhicule fournies étayent ce candidat ; une vérification humaine reste nécessaire.", "L’elenco ECU e i dati veicolo forniti supportano questo candidato; la conferma esatta richiede comunque una verifica umana.", "El listado de ECU y los datos del vehículo respaldan este candidato; la confirmación exacta sigue requiriendo revisión humana.", "A listagem da ECU e os dados do veículo sustentam este candidato; a confirmação exata continua a exigir revisão humana.", "Lista ECU i podane dane pojazdu wspierają tego kandydata; dokładne potwierdzenie nadal wymaga weryfikacji człowieka.", "Список ECU и предоставленные данные автомобиля поддерживают этот вариант; точное подтверждение всё ещё требует проверки специалистом.", "ECU 列表和已提供的车辆证据支持此候选项；精确确认仍需人工审核。", "Lista ECU dhe të dhënat e dhëna të automjetit e mbështesin këtë kandidat; konfirmimi i saktë kërkon ende shqyrtim njerëzor."],
  ["featureCalibrationReason", "Structured calibration-like changes support this indication, but the exact tuning level requires human confirmation.", "Strukturierte kalibrierungsähnliche Änderungen stützen diesen Hinweis, die genaue Tuningstufe erfordert jedoch eine manuelle Bestätigung.", "Yapılandırılmış kalibrasyon benzeri değişiklikler bu işareti destekliyor ancak kesin tuning seviyesi insan doğrulaması gerektiriyor.", "Gestructureerde kalibratieachtige wijzigingen ondersteunen deze aanwijzing, maar het exacte tuningniveau vereist menselijke bevestiging.", "Des modifications structurées ressemblant à des calibrations étayent cet indice, mais le niveau exact nécessite une confirmation humaine.", "Modifiche strutturate simili a calibrazioni supportano questa indicazione, ma il livello esatto richiede conferma umana.", "Los cambios estructurados similares a calibraciones respaldan este indicio, pero el nivel exacto requiere confirmación humana.", "Alterações estruturadas semelhantes a calibrações sustentam este indício, mas o nível exato exige confirmação humana.", "Uporządkowane zmiany przypominające kalibracje wspierają tę wskazówkę, ale dokładny poziom wymaga potwierdzenia przez człowieka.", "Структурированные изменения, похожие на калибровки, поддерживают этот признак, но точный уровень требует проверки специалистом.", "结构化的类似标定更改支持此提示，但确切调校级别仍需人工确认。", "Ndryshimet e strukturuara të ngjashme me kalibrimet e mbështesin këtë tregues, por niveli i saktë kërkon konfirmim njerëzor."],
  ["featureDiagnosticReason", "Small isolated edits may resemble diagnostic-table changes. This indication has low confidence.", "Kleine isolierte Änderungen können Diagnose-Tabellen ähneln. Dieser Hinweis hat eine geringe Konfidenz.", "Küçük ve izole düzenlemeler arıza tablosu değişikliklerine benzeyebilir. Bu işaret düşük güven düzeyindedir.", "Kleine geïsoleerde wijzigingen kunnen op diagnostische tabelwijzigingen lijken. Deze aanwijzing heeft een lage betrouwbaarheid.", "De petites modifications isolées peuvent ressembler à des changements de tables de diagnostic. Cet indice est peu fiable.", "Piccole modifiche isolate possono assomigliare a cambiamenti delle tabelle diagnostiche. Questa indicazione ha bassa affidabilità.", "Pequeñas ediciones aisladas pueden parecer cambios en tablas de diagnóstico. Este indicio tiene baja confianza.", "Pequenas alterações isoladas podem assemelhar-se a mudanças em tabelas de diagnóstico. Este indício tem baixa confiança.", "Małe, odizolowane zmiany mogą przypominać modyfikacje tabel diagnostycznych. Ta wskazówka ma niską pewność.", "Небольшие изолированные изменения могут напоминать правки диагностических таблиц. Достоверность этого признака низкая.", "少量孤立更改可能类似诊断表修改，此提示的置信度较低。", "Ndryshimet e vogla të izoluara mund t'u ngjajnë ndryshimeve në tabelat diagnostikuese. Ky tregues ka besueshmëri të ulët."],
  ["featureTcuReason", "A TCU signature and repeated calibration-like changes support this indication. Human confirmation is required.", "Eine TCU-Signatur und wiederholte kalibrierungsähnliche Änderungen stützen diesen Hinweis. Eine manuelle Bestätigung ist erforderlich.", "TCU imzası ve tekrarlanan kalibrasyon benzeri değişiklikler bu işareti destekliyor. İnsan doğrulaması gerekir.", "Een TCU-signatuur en herhaalde kalibratieachtige wijzigingen ondersteunen deze aanwijzing. Menselijke bevestiging is vereist.", "Une signature TCU et des modifications répétées ressemblant à des calibrations étayent cet indice. Une confirmation humaine est requise.", "Una firma TCU e modifiche ripetute simili a calibrazioni supportano questa indicazione. È necessaria una conferma umana.", "Una firma TCU y cambios repetidos similares a calibraciones respaldan este indicio. Se requiere confirmación humana.", "Uma assinatura TCU e alterações repetidas semelhantes a calibrações sustentam este indício. É necessária confirmação humana.", "Sygnatura TCU i powtarzalne zmiany przypominające kalibracje wspierają tę wskazówkę. Wymagane jest potwierdzenie przez człowieka.", "Сигнатура TCU и повторяющиеся изменения, похожие на калибровки, поддерживают этот признак. Требуется проверка специалистом.", "TCU 特征和重复的类似标定更改支持此提示，仍需人工确认。", "Një nënshkrim TCU dhe ndryshime të përsëritura të ngjashme me kalibrimet e mbështesin këtë tregues. Kërkohet konfirmim njerëzor."],
  ["featureGenericReason", "The files differ, but the operation cannot be identified safely from this pattern alone.", "Die Dateien unterscheiden sich, der Vorgang kann aus diesem Muster allein jedoch nicht sicher bestimmt werden.", "Dosyalar farklı ancak işlem yalnızca bu desenden güvenle tanımlanamaz.", "De bestanden verschillen, maar de bewerking kan niet veilig uit alleen dit patroon worden bepaald.", "Les fichiers diffèrent, mais l’opération ne peut pas être déterminée avec certitude à partir de ce seul motif.", "I file differiscono, ma l’operazione non può essere identificata con sicurezza dal solo schema.", "Los archivos difieren, pero la operación no puede identificarse con seguridad solo a partir de este patrón.", "Os ficheiros diferem, mas a operação não pode ser identificada com segurança apenas por este padrão.", "Pliki różnią się, ale na podstawie samego wzorca nie można bezpiecznie określić operacji.", "Файлы различаются, но по одному этому шаблону нельзя надёжно определить операцию.", "文件存在差异，但仅凭此模式无法安全识别具体操作。", "Skedarët ndryshojnë, por veprimi nuk mund të identifikohet me siguri vetëm nga ky model."],
  ["integritySize", "ORI and MOD file sizes differ.", "Die Dateigrößen von ORI und MOD unterscheiden sich.", "ORI ve MOD dosya boyutları farklı.", "De bestandsgroottes van ORI en MOD verschillen.", "Les tailles des fichiers ORI et MOD diffèrent.", "Le dimensioni dei file ORI e MOD differiscono.", "Los tamaños de los archivos ORI y MOD difieren.", "Os tamanhos dos ficheiros ORI e MOD diferem.", "Rozmiary plików ORI i MOD różnią się.", "Размеры файлов ORI и MOD различаются.", "ORI 与 MOD 文件大小不同。", "Madhësitë e skedarëve ORI dhe MOD ndryshojnë."],
  ["integrityEcu", "ORI and MOD contain different ECU-family signatures.", "ORI und MOD enthalten unterschiedliche ECU-Familien-Signaturen.", "ORI ve MOD farklı ECU ailesi imzaları içeriyor.", "ORI en MOD bevatten verschillende ECU-familiesignaturen.", "ORI et MOD contiennent des signatures de familles ECU différentes.", "ORI e MOD contengono firme di famiglie ECU diverse.", "ORI y MOD contienen firmas de familias ECU diferentes.", "ORI e MOD contêm assinaturas de famílias ECU diferentes.", "ORI i MOD zawierają różne sygnatury rodzin ECU.", "ORI и MOD содержат разные сигнатуры семейства ECU.", "ORI 与 MOD 包含不同的 ECU 系列特征。", "ORI dhe MOD përmbajnë nënshkrime të ndryshme të familjes ECU."],
  ["integrityVin", "ORI and MOD contain different VIN identifiers.", "ORI und MOD enthalten unterschiedliche VIN-Kennungen.", "ORI ve MOD farklı VIN kimlikleri içeriyor.", "ORI en MOD bevatten verschillende VIN-identificaties.", "ORI et MOD contiennent des identifiants VIN différents.", "ORI e MOD contengono identificativi VIN diversi.", "ORI y MOD contienen identificadores VIN diferentes.", "ORI e MOD contêm identificadores VIN diferentes.", "ORI i MOD zawierają różne identyfikatory VIN.", "ORI и MOD содержат разные идентификаторы VIN.", "ORI 与 MOD 包含不同的 VIN 标识符。", "ORI dhe MOD përmbajnë identifikues të ndryshëm VIN."],
  ["integrityEntropy", "High entropy may indicate an encrypted or compressed container.", "Hohe Entropie kann auf einen verschlüsselten oder komprimierten Container hinweisen.", "Yüksek entropi şifrelenmiş veya sıkıştırılmış bir kapsayıcıya işaret edebilir.", "Hoge entropie kan wijzen op een versleutelde of gecomprimeerde container.", "Une entropie élevée peut indiquer un conteneur chiffré ou compressé.", "Un’entropia elevata può indicare un contenitore crittografato o compresso.", "Una entropía alta puede indicar un contenedor cifrado o comprimido.", "Uma entropia elevada pode indicar um contentor encriptado ou comprimido.", "Wysoka entropia może wskazywać na zaszyfrowany lub skompresowany kontener.", "Высокая энтропия может указывать на зашифрованный или сжатый контейнер.", "高熵可能表示容器已加密或压缩。", "Entropia e lartë mund të tregojë një kontejner të enkriptuar ose të kompresuar."],
  ["clusterFound", "{count} approved pattern clusters support this ECU/service evidence. Human tuner verification remains required.", "{count} freigegebene Mustercluster stützen diese ECU-/Service-Nachweise. Eine Prüfung durch einen Tuner bleibt erforderlich.", "{count} onaylı desen kümesi bu ECU/hizmet kanıtını destekliyor. İnsan tuner doğrulaması yine gereklidir.", "{count} goedgekeurde patroonclusters ondersteunen dit ECU-/servicebewijs. Verificatie door een tuner blijft vereist.", "{count} groupes de motifs approuvés étayent ces éléments ECU/service. La vérification par un préparateur reste obligatoire.", "{count} cluster di pattern approvati supportano queste evidenze ECU/servizio. Resta necessaria la verifica di un calibratore.", "{count} grupos de patrones aprobados respaldan estas evidencias de ECU/servicio. Sigue siendo necesaria la verificación de un calibrador.", "{count} clusters de padrões aprovados sustentam estas evidências de ECU/serviço. Continua a ser necessária a verificação de um calibrador.", "{count} zatwierdzonych klastrów wzorców wspiera te dane ECU/usługi. Nadal wymagana jest weryfikacja tunera.", "{count} подтверждённых кластеров шаблонов поддерживают эти данные ECU/услуги. Проверка калибровщиком по-прежнему обязательна.", "{count} 个已批准的模式集群支持此 ECU/服务证据，仍需调校人员验证。", "{count} grupe modelesh të miratuara i mbështesin këto prova ECU/shërbimi. Verifikimi nga kalibruesi mbetet i detyrueshëm."],
  ["clusterNone", "No approved pattern-cluster evidence matched this analysis. Human tuner verification remains required.", "Keine freigegebenen Mustercluster passten zu dieser Analyse. Eine Prüfung durch einen Tuner bleibt erforderlich.", "Bu analizle eşleşen onaylı desen kümesi kanıtı bulunmadı. İnsan tuner doğrulaması yine gereklidir.", "Geen goedgekeurd patroonclusterbewijs kwam overeen met deze analyse. Verificatie door een tuner blijft vereist.", "Aucun groupe de motifs approuvé ne correspond à cette analyse. La vérification par un préparateur reste obligatoire.", "Nessuna evidenza approvata di cluster di pattern corrisponde a questa analisi. Resta necessaria la verifica di un calibratore.", "Ninguna evidencia aprobada de grupos de patrones coincide con este análisis. Sigue siendo necesaria la verificación de un calibrador.", "Nenhuma evidência aprovada de cluster de padrões corresponde a esta análise. Continua a ser necessária a verificação de um calibrador.", "Żaden zatwierdzony klaster wzorców nie pasuje do tej analizy. Nadal wymagana jest weryfikacja tunera.", "Подтверждённые кластеры шаблонов не совпали с этим анализом. Проверка калибровщиком по-прежнему обязательна.", "没有已批准的模式集群证据与此分析匹配，仍需调校人员验证。", "Asnjë provë e miratuar e grupit të modeleve nuk u përputh me këtë analizë. Verifikimi nga kalibruesi mbetet i detyrueshëm."],
  ["similarityFound", "{count} similar approved ECU patterns were found. Human tuner verification remains required.", "{count} ähnliche freigegebene ECU-Muster wurden gefunden. Eine Prüfung durch einen Tuner bleibt erforderlich.", "{count} benzer onaylı ECU deseni bulundu. İnsan tuner doğrulaması yine gereklidir.", "Er zijn {count} vergelijkbare goedgekeurde ECU-patronen gevonden. Verificatie door een tuner blijft vereist.", "{count} motifs ECU similaires et approuvés ont été trouvés. La vérification par un préparateur reste obligatoire.", "Sono stati trovati {count} pattern ECU simili e approvati. Resta necessaria la verifica di un calibratore.", "Se encontraron {count} patrones de ECU similares y aprobados. Sigue siendo necesaria la verificación de un calibrador.", "Foram encontrados {count} padrões ECU semelhantes e aprovados. Continua a ser necessária a verificação de um calibrador.", "Znaleziono {count} podobnych, zatwierdzonych wzorców ECU. Nadal wymagana jest weryfikacja tunera.", "Найдено похожих подтверждённых шаблонов ECU: {count}. Проверка калибровщиком по-прежнему обязательна.", "发现 {count} 个相似的已批准 ECU 模式，仍需调校人员验证。", "U gjetën {count} modele të ngjashme ECU të miratuara. Verifikimi nga kalibruesi mbetet i detyrueshëm."],
  ["similarityNone", "No approved similar-learning evidence was found. Confidence is limited and human tuner verification is required.", "Es wurden keine freigegebenen ähnlichen Lerndaten gefunden. Die Aussagekraft ist begrenzt und eine Prüfung durch einen Tuner ist erforderlich.", "Onaylı benzer öğrenme kanıtı bulunmadı. Güven düzeyi sınırlı ve insan tuner doğrulaması gerekiyor.", "Er is geen goedgekeurd vergelijkbaar leermateriaal gevonden. De betrouwbaarheid is beperkt en verificatie door een tuner is vereist.", "Aucun élément d’apprentissage similaire et approuvé n’a été trouvé. La confiance est limitée et la vérification par un préparateur est requise.", "Non sono state trovate evidenze di apprendimento simili e approvate. L’affidabilità è limitata ed è necessaria la verifica di un calibratore.", "No se encontraron evidencias de aprendizaje similares y aprobadas. La confianza es limitada y se requiere la verificación de un calibrador.", "Não foram encontradas evidências de aprendizagem semelhantes e aprovadas. A confiança é limitada e é necessária a verificação de um calibrador.", "Nie znaleziono zatwierdzonych podobnych danych uczących. Pewność jest ograniczona i wymagana jest weryfikacja tunera.", "Подтверждённые похожие обучающие данные не найдены. Достоверность ограничена, требуется проверка калибровщиком.", "未找到已批准的相似学习证据；置信度有限，需要调校人员验证。", "Nuk u gjetën prova të miratuara të ngjashme të të mësuarit. Besueshmëria është e kufizuar dhe kërkohet verifikim nga kalibruesi."],
  ["evidenceAdditional", "Additional ECU variant markers were found: {markers}.", "Weitere ECU-Variantenkennungen wurden gefunden: {markers}.", "Ek ECU varyant işaretleri bulundu: {markers}.", "Er zijn aanvullende ECU-variantmarkeringen gevonden: {markers}.", "D’autres marqueurs de variante ECU ont été trouvés : {markers}.", "Sono stati trovati ulteriori marcatori di variante ECU: {markers}.", "Se encontraron marcadores adicionales de variante de ECU: {markers}.", "Foram encontrados marcadores adicionais de variante da ECU: {markers}.", "Znaleziono dodatkowe znaczniki wariantów ECU: {markers}.", "Найдены дополнительные маркеры вариантов ECU: {markers}.", "发现其他 ECU 变体标记：{markers}。", "U gjetën shënues shtesë të varianteve ECU: {markers}."],
  ["findingFullReadTitle", "Likely full read", "Wahrscheinlich vollständiger Read", "Muhtemel tam okuma", "Waarschijnlijk volledige uitlezing", "Lecture complète probable", "Probabile lettura completa", "Probable lectura completa", "Provável leitura completa", "Prawdopodobnie pełny odczyt", "Вероятно полное чтение", "可能为完整读取", "Me gjasë lexim i plotë"],
  ["findingProfileTitle", "File structure classified", "Dateistruktur klassifiziert", "Dosya yapısı sınıflandırıldı", "Bestandsstructuur geclassificeerd", "Structure du fichier classée", "Struttura del file classificata", "Estructura del archivo clasificada", "Estrutura do ficheiro classificada", "Sklasyfikowano strukturę pliku", "Структура файла классифицирована", "文件结构已分类", "Struktura e skedarit u klasifikua"],
  ["findingCalibrationTitle", "Calibration-like regions detected", "Kalibrierungsähnliche Bereiche erkannt", "Kalibrasyon benzeri bölgeler tespit edildi", "Kalibratieachtige gebieden gedetecteerd", "Zones ressemblant à des calibrations détectées", "Rilevate aree simili a calibrazioni", "Regiones similares a calibraciones detectadas", "Detetadas regiões semelhantes a calibrações", "Wykryto obszary przypominające kalibracje", "Обнаружены области, похожие на калибровки", "检测到类似标定的区域", "U zbuluan zona të ngjashme me kalibrimet"],
  ["findingCompatibilityTitle", "Compatibility check required", "Kompatibilitätsprüfung erforderlich", "Uyumluluk kontrolü gerekli", "Compatibiliteitscontrole vereist", "Contrôle de compatibilité requis", "Verifica di compatibilità necessaria", "Se requiere comprobar la compatibilidad", "É necessária verificação de compatibilidade", "Wymagana kontrola zgodności", "Требуется проверка совместимости", "需要检查兼容性", "Kërkohet kontroll i pajtueshmërisë"],
  ["findingNoConflictTitle", "No structural conflict detected", "Kein Strukturkonflikt erkannt", "Yapısal çakışma tespit edilmedi", "Geen structureel conflict gedetecteerd", "Aucun conflit structurel détecté", "Nessun conflitto strutturale rilevato", "No se detectó ningún conflicto estructural", "Não foi detetado conflito estrutural", "Nie wykryto konfliktu strukturalnego", "Структурный конфликт не обнаружен", "未检测到结构冲突", "Nuk u zbulua konflikt strukturor"],
] as const satisfies readonly TranslationRow[];

export type FileExpertReportTranslationKey = typeof fileExpertReportRows[number][0];

const rowByKey = new Map<FileExpertReportTranslationKey, typeof fileExpertReportRows[number]>(
  fileExpertReportRows.map((row) => [row[0], row])
);
const localeColumn = Object.fromEntries(
  fileExpertReportLocaleOrder.map((locale, index) => [locale, index + 1])
) as Record<LocaleCode, number>;

function interpolate(template: string, params: Record<string, string | number> = {}) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : placeholder
  );
}

export function fileExpertReportT(
  locale: LocaleCode,
  key: FileExpertReportTranslationKey,
  params?: Record<string, string | number>
) {
  const row = rowByKey.get(key);
  return interpolate(row?.[localeColumn[locale]] ?? row?.[1] ?? "", params);
}

function hasOwnKey<T extends object>(value: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(value, key);
}

const fileFormatKeys = {
  raw_binary: "formatBinary",
  intel_hex: "formatIntelHex",
  motorola_srecord: "formatMotorola",
  zip_archive: "formatZip",
  frf_container: "formatFrf",
  encrypted_or_compressed: "formatProtected",
  unknown: "formatUnknown",
} as const satisfies Record<FileExpertFileFormat, FileExpertReportTranslationKey>;

const readScopeKeys = {
  full_read: "scopeFull",
  calibration_area: "scopeCalibration",
  partial_read: "scopePartial",
  virtual_read: "scopeVirtual",
  container: "scopeContainer",
  unknown: "scopeUnknown",
} as const satisfies Record<FileExpertReadScope, FileExpertReportTranslationKey>;

type FeatureLabelDefinition =
  | { kind: "localized"; key: FileExpertReportTranslationKey }
  | { kind: "technical"; label: string };

const featureLabelDefinitions = {
  stock_or_modified: { kind: "localized", key: "featureStock" },
  stage1: { kind: "technical", label: "Stage 1" },
  stage2: { kind: "technical", label: "Stage 2" },
  stage3: { kind: "technical", label: "Stage 3" },
  dpf_off: { kind: "technical", label: "DPF OFF" },
  egr_off: { kind: "technical", label: "EGR OFF" },
  adblue_off: { kind: "technical", label: "AdBlue OFF" },
  dtc_off: { kind: "technical", label: "DTC OFF" },
  vmax_off: { kind: "technical", label: "VMAX OFF" },
  pop_bangs: { kind: "localized", key: "featurePopBangs" },
  tcu_tune: { kind: "localized", key: "featureTcuTune" },
  tcu_shift: { kind: "localized", key: "featureTcuShift" },
  tcu_lockup: { kind: "localized", key: "featureTcuLockup" },
} as const satisfies Record<FileExpertFeature, FeatureLabelDefinition>;

const featureReasonKeys = {
  stock_or_modified: "featureGenericReason",
  stage1: "featureCalibrationReason",
  stage2: "featureCalibrationReason",
  stage3: "featureCalibrationReason",
  dpf_off: "featureGenericReason",
  egr_off: "featureGenericReason",
  adblue_off: "featureGenericReason",
  dtc_off: "featureDiagnosticReason",
  vmax_off: "featureGenericReason",
  pop_bangs: "featureGenericReason",
  tcu_tune: "featureTcuReason",
  tcu_shift: "featureTcuReason",
  tcu_lockup: "featureTcuReason",
} as const satisfies Record<FileExpertFeature, FileExpertReportTranslationKey>;

const changeLabelKeys = {
  single_file: "changeSingleLabel",
  structural_mismatch: "changeMismatchLabel",
  identical: "changeIdenticalLabel",
  focused_calibration: "changeFocusedLabel",
  distributed_calibration: "changeDistributedLabel",
  broad_rework: "changeBroadLabel",
} as const satisfies Record<FileExpertChangeClassification, FileExpertReportTranslationKey>;

export function localizeFileExpertFileFormat(
  locale: LocaleCode,
  value: string | null | undefined
) {
  const key = value?.trim().toLowerCase() ?? "";
  return hasOwnKey(fileFormatKeys, key)
    ? fileExpertReportT(locale, fileFormatKeys[key])
    : fileExpertReportT(locale, "formatUnknown");
}

export function localizeFileExpertReadScope(
  locale: LocaleCode,
  value: string | null | undefined
) {
  const key = value?.trim().toLowerCase() ?? "";
  return hasOwnKey(readScopeKeys, key)
    ? fileExpertReportT(locale, readScopeKeys[key])
    : fileExpertReportT(locale, "scopeUnknown");
}

export function localizeFileExpertFileProfile(
  locale: LocaleCode,
  format: string | null | undefined,
  readScope: string | null | undefined
) {
  return `${localizeFileExpertFileFormat(locale, format)} / ${localizeFileExpertReadScope(locale, readScope)}`;
}

export function localizeFileExpertFeatureLabel(
  locale: LocaleCode,
  feature: string | null | undefined
) {
  const key = feature?.trim().toLowerCase() ?? "";
  if (!hasOwnKey(featureLabelDefinitions, key)) return fileExpertReportT(locale, "genericEvidence");
  const definition = featureLabelDefinitions[key];
  return definition.kind === "localized"
    ? fileExpertReportT(locale, definition.key)
    : definition.label;
}

function localizedChangeSummary(locale: LocaleCode, profile: FileExpertChangeProfile) {
  switch (profile.classification) {
    case "single_file":
      return fileExpertReportT(locale, "summarySingle");
    case "structural_mismatch":
      return fileExpertReportT(locale, "summaryMismatch");
    case "identical":
      return fileExpertReportT(locale, "summaryIdentical");
    case "focused_calibration":
      return fileExpertReportT(
        locale,
        profile.summary === "Changes are concentrated in a limited set of structured, calibration-like regions."
          ? "summaryFocusedStructured"
          : "summaryFocusedLimited"
      );
    case "distributed_calibration":
      return fileExpertReportT(locale, "summaryDistributed");
    case "broad_rework":
      return fileExpertReportT(locale, "summaryBroad");
    default:
      return fileExpertReportT(locale, "genericEvidence");
  }
}

export function localizeFileExpertChangeProfile(
  locale: LocaleCode,
  profile: FileExpertChangeProfile | null | undefined
) {
  if (!profile || !hasOwnKey(changeLabelKeys, profile.classification)) {
    return {
      label: fileExpertReportT(locale, "genericEvidence"),
      summary: fileExpertReportT(locale, "genericEvidence"),
    };
  }
  return {
    label: fileExpertReportT(locale, changeLabelKeys[profile.classification]),
    summary: localizedChangeSummary(locale, profile),
  };
}

export function localizeFileExpertAnalyzerEvidence(
  locale: LocaleCode,
  value: string | null | undefined
) {
  const evidence = value?.trim() ?? "";
  let match = evidence.match(/^ECU signature (.+) found inside the binary\.$/u);
  if (match) return fileExpertReportT(locale, "evidenceSignatureBinary", { marker: match[1] });
  match = evidence.match(/^Additional ECU variant markers were also present: (.+)\.$/u);
  if (match) return fileExpertReportT(locale, "evidenceAdditional", { markers: match[1] });
  match = evidence.match(/^ECU signature (.+) found in the uploaded file name\.$/u);
  if (match) return fileExpertReportT(locale, "evidenceSignatureFile", { marker: match[1] });
  match = evidence.match(/^ECU type (.+) was supplied by the customer, not verified inside the binary\.$/u);
  if (match) return fileExpertReportT(locale, "evidenceCustomerEcu", { marker: match[1] });
  match = evidence.match(/^(?:Supplier|Processor) marker (.+) found inside the binary\.$/u);
  if (match) return fileExpertReportT(locale, "evidenceTechnicalMarker", { marker: match[1] });
  if (evidence === "Hardware identifier extracted from file content or naming.") {
    return fileExpertReportT(locale, "evidenceHardware");
  }
  if (evidence === "Software identifier extracted from file content or naming.") {
    return fileExpertReportT(locale, "evidenceSoftware");
  }
  if (evidence === "A VIN-format identifier was found inside the binary.") {
    return fileExpertReportT(locale, "evidenceVin");
  }
  match = evidence.match(/^Engine code marker (.+) found in the binary or uploaded file name\.$/u);
  if (match) return fileExpertReportT(locale, "evidenceEngineCode", { marker: match[1] });
  match = evidence.match(/^Conflicting control-unit signatures were found: (.+)\.$/u);
  if (match) return fileExpertReportT(locale, "evidenceConflict", { markers: match[1] });
  return fileExpertReportT(locale, "genericEvidence");
}

export function localizeFileExpertVehicleSummary(
  locale: LocaleCode,
  match: FileExpertVehicleMatch | null | undefined,
  target: string | null | undefined
) {
  if (!match || !target) return fileExpertReportT(locale, "vehicleNoFamily");
  if (match.exact_vehicle_identified) return fileExpertReportT(locale, "vehicleExact");
  if (match.total_matches > 0) {
    return fileExpertReportT(locale, "vehicleMultiple", {
      target,
      count: match.total_matches.toLocaleString(intlLocaleByCode[locale]),
    });
  }
  return fileExpertReportT(locale, "vehicleNoMatch", { target });
}

export function localizeFileExpertVehicleCandidateEvidence(
  locale: LocaleCode,
  candidate: FileExpertVehicleCandidate
) {
  return candidate.reason
    ? fileExpertReportT(locale, "vehicleCandidateEvidence")
    : fileExpertReportT(locale, "genericEvidence");
}

export function localizeFileExpertFeatureReason(
  locale: LocaleCode,
  feature: FileExpertPossibleFeature
) {
  const key = String(feature.feature || "").trim().toLowerCase();
  return fileExpertReportT(
    locale,
    hasOwnKey(featureReasonKeys, key) ? featureReasonKeys[key] : "genericEvidence"
  );
}

const integrityIssueKeys = new Map<string, FileExpertReportTranslationKey>([
  ["ORI and MOD file sizes differ.", "integritySize"],
  ["ORI and MOD contain different ECU family signatures.", "integrityEcu"],
  ["ORI and MOD contain different VIN identifiers.", "integrityVin"],
  ["High entropy may indicate an encrypted or compressed container.", "integrityEntropy"],
]);

export function localizeFileExpertIntegrityIssue(
  locale: LocaleCode,
  value: string | null | undefined
) {
  const key = integrityIssueKeys.get(value?.trim() ?? "");
  return fileExpertReportT(locale, key ?? "genericEvidence");
}

export function localizeFileExpertSimilarityMessage(
  locale: LocaleCode,
  evidence: { matchesFound: number } | null | undefined
) {
  if (!evidence?.matchesFound) return fileExpertReportT(locale, "similarityNone");
  return fileExpertReportT(locale, "similarityFound", {
    count: evidence.matchesFound.toLocaleString(intlLocaleByCode[locale]),
  });
}

export function localizeFileExpertClusterMessage(
  locale: LocaleCode,
  evidence: { matchingClusters: number } | null | undefined
) {
  if (!evidence?.matchingClusters) return fileExpertReportT(locale, "clusterNone");
  return fileExpertReportT(locale, "clusterFound", {
    count: evidence.matchingClusters.toLocaleString(intlLocaleByCode[locale]),
  });
}

type FindingContext = {
  fileFormat?: string | null;
  readScope?: string | null;
  changeProfile?: FileExpertChangeProfile | null;
  identificationStatus?: string | null;
  identificationModule?: string | null;
  mapCandidateCount?: number;
  integrity?: FileExpertIntegrityAssessment | null;
  vehicleMatch?: FileExpertVehicleMatch | null;
  vehicleTarget?: string | null;
};

export function localizeFileExpertFinding(
  locale: LocaleCode,
  finding: FileExpertFinding,
  context: FindingContext = {}
) {
  if (finding.id === "ecu-identification") {
    const missing = context.identificationStatus === "not_detected";
    return {
      title: missing ? fileExpertReportT(locale, "notIdentified") : finding.title,
      summary: missing
        ? fileExpertReportT(locale, "findingIdentityMissing")
        : fileExpertReportT(locale, "findingIdentityStatus", {
            module: context.identificationModule || "ECU",
            status: localizeFileExpertDetection(locale, context.identificationStatus),
          }),
      rawTitle: !missing,
    };
  }
  if (finding.id === "file-profile") {
    return {
      title: fileExpertReportT(
        locale,
        context.readScope === "full_read" ? "findingFullReadTitle" : "findingProfileTitle"
      ),
      summary: fileExpertReportT(locale, "findingFileProfile", {
        format: localizeFileExpertFileFormat(locale, context.fileFormat),
        scope: localizeFileExpertReadScope(locale, context.readScope),
      }),
      rawTitle: false,
    };
  }
  if (finding.id === "change-profile") {
    const profile = localizeFileExpertChangeProfile(locale, context.changeProfile);
    return { ...profile, title: profile.label, rawTitle: false };
  }
  if (finding.id === "calibration-regions") {
    return {
      title: fileExpertReportT(locale, "findingCalibrationTitle"),
      summary: fileExpertReportT(locale, "findingCalibration", {
        count: (context.mapCandidateCount ?? 0).toLocaleString(intlLocaleByCode[locale]),
      }),
      rawTitle: false,
    };
  }
  if (finding.id === "integrity-warning") {
    const issues = context.integrity?.issues ?? [];
    return {
      title: fileExpertReportT(locale, "findingCompatibilityTitle"),
      summary: issues.length
        ? issues.map((issue) => localizeFileExpertIntegrityIssue(locale, issue)).join(" ")
        : fileExpertReportT(locale, "genericEvidence"),
      rawTitle: false,
    };
  }
  if (finding.id === "integrity-status") {
    return {
      title: fileExpertReportT(locale, "findingNoConflictTitle"),
      summary: fileExpertReportT(locale, "findingNoConflict"),
      rawTitle: false,
    };
  }
  if (finding.id === "vehicle-applications") {
    const count = context.vehicleMatch?.total_matches ?? 0;
    return {
      title: fileExpertReportT(locale, "vehicleFindingTitle", {
        count: count.toLocaleString(intlLocaleByCode[locale]),
      }),
      summary: localizeFileExpertVehicleSummary(locale, context.vehicleMatch, context.vehicleTarget),
      rawTitle: false,
    };
  }
  return {
    title: fileExpertReportT(locale, "genericEvidence"),
    summary: fileExpertReportT(locale, "genericEvidence"),
    rawTitle: false,
  };
}

export function localizeFileExpertConclusion(
  locale: LocaleCode,
  result: FileExpertAnalyzerResult | null | undefined
) {
  return result?.change_profile
    ? localizeFileExpertChangeProfile(locale, result.change_profile).summary
    : fileExpertReportT(locale, "analysisPreparing");
}
