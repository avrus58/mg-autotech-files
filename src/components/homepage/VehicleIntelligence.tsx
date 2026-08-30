"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Cpu,
  Gauge,
  Search,
  Sparkles,
} from "lucide-react";
import {
  fetchVehicleOptions,
  getInitialVehicleBrands,
} from "@/lib/vehicleControl/clientCatalog";
import type { LocaleCode } from "@/lib/i18nConfig";

type VehicleOption = {
  id: string;
  name: string;
  fuelType?: string | null;
};

type PerformanceData = {
  stockHp: number | null;
  tunedHp: number | null;
  gainHp: number | null;
  stockNm: number | null;
  tunedNm: number | null;
  gainNm: number | null;
};

type PublicVehicleData = {
  brand: string;
  brandId: string;
  model: string;
  modelId: string;
  generation: string;
  generationId: string;
  engine: string;
  engineId: string;
  fuelType?: string | null;
  ecu?: string[];
  stage1?: PerformanceData | null;
  stage2?: PerformanceData | null;
  readMethods?: string[];
  services?: string[];
};

type PublicVehicleCopy = {
  title: string;
  brandPlaceholder: string;
  modelPlaceholder: string;
  generationPlaceholder: string;
  enginePlaceholder: string;
  search: string;
  reviewTitle: string;
  reviewText: string;
  checking: string;
  notFound: string;
  loadError: string;
  manualRequest: string;
  eyebrow: string;
  intro: string;
  power: string;
  torque: string;
  gain: string;
  publishedRecord: string;
  notPublished: string;
  readMethod: string;
  finalConfirmation: string;
  startRequest: string;
};

export const publicVehicleCopy: Record<LocaleCode, PublicVehicleCopy> = {
  en: {
    title: "Find your vehicle. See the data before you open a request.",
    brandPlaceholder: "Vehicle brand",
    modelPlaceholder: "Model",
    generationPlaceholder: "Generation",
    enginePlaceholder: "Engine",
    search: "Show vehicle data",
    reviewTitle: "Performance data under review",
    reviewText: "Exact values for this variant are confirmed after ECU and original-file identification.",
    checking: "Checking the selected vehicle record...",
    notFound: "No matching vehicle record was found. Please reselect the vehicle or create a manual request.",
    loadError: "Vehicle data could not be loaded. Please try again or create a manual request.",
    manualRequest: "Create a manual request",
    eyebrow: "Vehicle intelligence",
    intro: "Published values, controller families, read methods and supported request types—one selection, no guesswork.",
    power: "Power",
    torque: "Torque",
    gain: "Gain",
    publishedRecord: "Published vehicle record",
    notPublished: "Not published",
    readMethod: "Read method",
    finalConfirmation: "Final compatibility and values are confirmed from the exact ECU or TCU and original file before work begins.",
    startRequest: "Start this request",
  },
  de: {
    title: "Fahrzeug finden und Daten vor der Anfrage ansehen.",
    brandPlaceholder: "Fahrzeugmarke",
    modelPlaceholder: "Modell",
    generationPlaceholder: "Generation",
    enginePlaceholder: "Motor",
    search: "Fahrzeugdaten anzeigen",
    reviewTitle: "Leistungsdaten werden geprüft",
    reviewText: "Die genauen Werte dieser Variante werden nach Identifikation von Steuergerät und Originaldatei bestätigt.",
    checking: "Der ausgewählte Fahrzeugdatensatz wird geprüft...",
    notFound: "Kein passender Fahrzeugdatensatz gefunden. Bitte Fahrzeug erneut auswählen oder eine manuelle Anfrage erstellen.",
    loadError: "Die Fahrzeugdaten konnten nicht geladen werden. Bitte erneut versuchen oder eine manuelle Anfrage erstellen.",
    manualRequest: "Manuelle Anfrage erstellen",
    eyebrow: "Fahrzeugdaten",
    intro: "Veröffentlichte Werte, Steuergerätefamilien, Auslesemethoden und unterstützte Anfragearten – eine Auswahl, ohne Rätselraten.",
    power: "Leistung",
    torque: "Drehmoment",
    gain: "Zuwachs",
    publishedRecord: "Veröffentlichter Fahrzeugdatensatz",
    notPublished: "Nicht veröffentlicht",
    readMethod: "Auslesemethode",
    finalConfirmation: "Die endgültige Kompatibilität und die Werte werden vor Arbeitsbeginn anhand des exakten ECU- oder TCU-Steuergeräts und der Originaldatei bestätigt.",
    startRequest: "Diese Anfrage starten",
  },
  tr: {
    title: "Aracınızı bulun, talep açmadan önce verileri görün.",
    brandPlaceholder: "Araç markası",
    modelPlaceholder: "Model",
    generationPlaceholder: "Nesil",
    enginePlaceholder: "Motor",
    search: "Araç verisini göster",
    reviewTitle: "Performans verileri kontrol ediliyor",
    reviewText: "Bu varyantın kesin değerleri ECU ve orijinal dosya tanımlamasından sonra doğrulanır.",
    checking: "Seçilen araç kaydı kontrol ediliyor...",
    notFound: "Eşleşen araç kaydı bulunamadı. Aracı yeniden seçin veya manuel talep oluşturun.",
    loadError: "Araç verileri yüklenemedi. Tekrar deneyin veya manuel talep oluşturun.",
    manualRequest: "Manuel talep oluştur",
    eyebrow: "Araç bilgileri",
    intro: "Yayınlanan değerler, kontrol ünitesi aileleri, okuma yöntemleri ve desteklenen talep türleri—tek seçim, tahmin yok.",
    power: "Güç",
    torque: "Tork",
    gain: "Kazanç",
    publishedRecord: "Yayınlanmış araç kaydı",
    notPublished: "Yayınlanmadı",
    readMethod: "Okuma yöntemi",
    finalConfirmation: "Nihai uyumluluk ve değerler, çalışma başlamadan önce tam ECU veya TCU ve orijinal dosya üzerinden doğrulanır.",
    startRequest: "Bu talebi başlat",
  },
  nl: {
    title: "Vind uw voertuig en bekijk de gegevens vóór uw aanvraag.",
    brandPlaceholder: "Voertuigmerk",
    modelPlaceholder: "Model",
    generationPlaceholder: "Generatie",
    enginePlaceholder: "Motor",
    search: "Voertuiggegevens tonen",
    reviewTitle: "Prestatiegegevens worden gecontroleerd",
    reviewText: "De exacte waarden voor deze variant worden bevestigd na identificatie van de ECU en het originele bestand.",
    checking: "Het geselecteerde voertuigrecord wordt gecontroleerd...",
    notFound: "Geen passend voertuigrecord gevonden. Selecteer het voertuig opnieuw of maak een handmatige aanvraag.",
    loadError: "De voertuiggegevens konden niet worden geladen. Probeer opnieuw of maak een handmatige aanvraag.",
    manualRequest: "Handmatige aanvraag maken",
    eyebrow: "Voertuiginformatie",
    intro: "Gepubliceerde waarden, regeleenheidfamilies, leesmethoden en ondersteunde aanvraagtypen—één selectie, zonder giswerk.",
    power: "Vermogen",
    torque: "Koppel",
    gain: "Toename",
    publishedRecord: "Gepubliceerd voertuigrecord",
    notPublished: "Niet gepubliceerd",
    readMethod: "Leesmethode",
    finalConfirmation: "De definitieve compatibiliteit en waarden worden vóór aanvang van het werk bevestigd aan de hand van de exacte ECU of TCU en het originele bestand.",
    startRequest: "Deze aanvraag starten",
  },
  fr: {
    title: "Trouvez votre véhicule et consultez les données avant la demande.",
    brandPlaceholder: "Marque",
    modelPlaceholder: "Modèle",
    generationPlaceholder: "Génération",
    enginePlaceholder: "Moteur",
    search: "Afficher les données",
    reviewTitle: "Données de performance en cours de vérification",
    reviewText: "Les valeurs exactes de cette variante sont confirmées après identification de l'ECU et du fichier d'origine.",
    checking: "Vérification du véhicule sélectionné...",
    notFound: "Aucun véhicule correspondant n'a été trouvé. Sélectionnez à nouveau le véhicule ou créez une demande manuelle.",
    loadError: "Les données du véhicule n'ont pas pu être chargées. Réessayez ou créez une demande manuelle.",
    manualRequest: "Créer une demande manuelle",
    eyebrow: "Données véhicule",
    intro: "Valeurs publiées, familles de calculateurs, méthodes de lecture et types de demandes pris en charge—une sélection, sans approximation.",
    power: "Puissance",
    torque: "Couple",
    gain: "Gain",
    publishedRecord: "Fiche véhicule publiée",
    notPublished: "Non publié",
    readMethod: "Méthode de lecture",
    finalConfirmation: "La compatibilité et les valeurs définitives sont confirmées à partir de l'ECU ou du TCU exact et du fichier d'origine avant le début du travail.",
    startRequest: "Démarrer cette demande",
  },
  it: {
    title: "Trova il veicolo e consulta i dati prima della richiesta.",
    brandPlaceholder: "Marca",
    modelPlaceholder: "Modello",
    generationPlaceholder: "Generazione",
    enginePlaceholder: "Motore",
    search: "Mostra dati veicolo",
    reviewTitle: "Dati prestazionali in verifica",
    reviewText: "I valori esatti di questa variante vengono confermati dopo l'identificazione della ECU e del file originale.",
    checking: "Verifica del veicolo selezionato...",
    notFound: "Nessun veicolo corrispondente trovato. Seleziona nuovamente il veicolo o crea una richiesta manuale.",
    loadError: "Impossibile caricare i dati del veicolo. Riprova o crea una richiesta manuale.",
    manualRequest: "Crea richiesta manuale",
    eyebrow: "Dati veicolo",
    intro: "Valori pubblicati, famiglie di centraline, metodi di lettura e tipi di richiesta supportati—una selezione, senza supposizioni.",
    power: "Potenza",
    torque: "Coppia",
    gain: "Incremento",
    publishedRecord: "Scheda veicolo pubblicata",
    notPublished: "Non pubblicato",
    readMethod: "Metodo di lettura",
    finalConfirmation: "La compatibilità e i valori definitivi vengono confermati dall'ECU o TCU esatta e dal file originale prima dell'inizio del lavoro.",
    startRequest: "Avvia questa richiesta",
  },
  ru: {
    title: "Найдите автомобиль и просмотрите данные до создания заявки.",
    brandPlaceholder: "Марка",
    modelPlaceholder: "Модель",
    generationPlaceholder: "Поколение",
    enginePlaceholder: "Двигатель",
    search: "Показать данные",
    reviewTitle: "Данные мощности проверяются",
    reviewText: "Точные значения для этой версии подтверждаются после идентификации ECU и исходного файла.",
    checking: "Проверяем выбранную запись автомобиля...",
    notFound: "Подходящая запись автомобиля не найдена. Выберите автомобиль ещё раз или создайте ручную заявку.",
    loadError: "Не удалось загрузить данные автомобиля. Повторите попытку или создайте ручную заявку.",
    manualRequest: "Создать ручную заявку",
    eyebrow: "Данные автомобиля",
    intro: "Опубликованные значения, семейства блоков, методы чтения и поддерживаемые типы заявок—один выбор без догадок.",
    power: "Мощность",
    torque: "Крутящий момент",
    gain: "Прирост",
    publishedRecord: "Опубликованная запись автомобиля",
    notPublished: "Не опубликовано",
    readMethod: "Метод чтения",
    finalConfirmation: "Окончательная совместимость и значения подтверждаются по точному ECU или TCU и исходному файлу до начала работ.",
    startRequest: "Создать эту заявку",
  },
  es: {
    title: "Encuentra tu vehículo y consulta los datos antes de solicitar.",
    brandPlaceholder: "Marca",
    modelPlaceholder: "Modelo",
    generationPlaceholder: "Generación",
    enginePlaceholder: "Motor",
    search: "Mostrar datos",
    reviewTitle: "Datos de rendimiento en revisión",
    reviewText: "Los valores exactos de esta variante se confirman tras identificar la ECU y el archivo original.",
    checking: "Comprobando el vehículo seleccionado...",
    notFound: "No se encontró un vehículo coincidente. Vuelve a seleccionarlo o crea una solicitud manual.",
    loadError: "No se pudieron cargar los datos del vehículo. Inténtalo de nuevo o crea una solicitud manual.",
    manualRequest: "Crear solicitud manual",
    eyebrow: "Datos del vehículo",
    intro: "Valores publicados, familias de unidades de control, métodos de lectura y tipos de solicitud compatibles—una selección, sin conjeturas.",
    power: "Potencia",
    torque: "Par",
    gain: "Ganancia",
    publishedRecord: "Ficha de vehículo publicada",
    notPublished: "No publicado",
    readMethod: "Método de lectura",
    finalConfirmation: "La compatibilidad y los valores finales se confirman a partir de la ECU o TCU exacta y del archivo original antes de comenzar el trabajo.",
    startRequest: "Iniciar esta solicitud",
  },
  pt: {
    title: "Encontre o veículo e consulte os dados antes do pedido.",
    brandPlaceholder: "Marca",
    modelPlaceholder: "Modelo",
    generationPlaceholder: "Geração",
    enginePlaceholder: "Motor",
    search: "Mostrar dados",
    reviewTitle: "Dados de desempenho em verificação",
    reviewText: "Os valores exatos desta variante são confirmados após a identificação da ECU e do ficheiro original.",
    checking: "A verificar o veículo selecionado...",
    notFound: "Não foi encontrado um veículo correspondente. Selecione novamente ou crie um pedido manual.",
    loadError: "Não foi possível carregar os dados do veículo. Tente novamente ou crie um pedido manual.",
    manualRequest: "Criar pedido manual",
    eyebrow: "Dados do veículo",
    intro: "Valores publicados, famílias de unidades de controlo, métodos de leitura e tipos de pedido suportados—uma seleção, sem suposições.",
    power: "Potência",
    torque: "Binário",
    gain: "Ganho",
    publishedRecord: "Registo de veículo publicado",
    notPublished: "Não publicado",
    readMethod: "Método de leitura",
    finalConfirmation: "A compatibilidade e os valores finais são confirmados a partir da ECU ou TCU exata e do ficheiro original antes do início do trabalho.",
    startRequest: "Iniciar este pedido",
  },
  zh: {
    title: "查找车辆并在提交请求前查看数据。",
    brandPlaceholder: "车辆品牌",
    modelPlaceholder: "车型",
    generationPlaceholder: "代系",
    enginePlaceholder: "发动机",
    search: "显示车辆数据",
    reviewTitle: "性能数据正在审核",
    reviewText: "该车型的准确数值将在识别 ECU 和原始文件后确认。",
    checking: "正在检查所选车辆记录...",
    notFound: "未找到匹配的车辆记录。请重新选择车辆或创建手动请求。",
    loadError: "无法加载车辆数据。请重试或创建手动请求。",
    manualRequest: "创建手动请求",
    eyebrow: "车辆数据",
    intro: "已发布的数值、控制器系列、读取方法和支持的请求类型—一次选择，无需猜测。",
    power: "功率",
    torque: "扭矩",
    gain: "增幅",
    publishedRecord: "已发布车辆记录",
    notPublished: "未发布",
    readMethod: "读取方法",
    finalConfirmation: "开始处理前，将根据准确的 ECU 或 TCU 及原始文件确认最终兼容性和数值。",
    startRequest: "开始此请求",
  },
  pl: {
    title: "Znajdź pojazd i sprawdź dane przed utworzeniem zlecenia.",
    brandPlaceholder: "Marka",
    modelPlaceholder: "Model",
    generationPlaceholder: "Generacja",
    enginePlaceholder: "Silnik",
    search: "Pokaż dane",
    reviewTitle: "Dane osiągów są weryfikowane",
    reviewText: "Dokładne wartości dla tej wersji są potwierdzane po identyfikacji ECU i oryginalnego pliku.",
    checking: "Sprawdzanie wybranego pojazdu...",
    notFound: "Nie znaleziono pasującego pojazdu. Wybierz pojazd ponownie lub utwórz zgłoszenie ręczne.",
    loadError: "Nie udało się wczytać danych pojazdu. Spróbuj ponownie lub utwórz zgłoszenie ręczne.",
    manualRequest: "Utwórz zgłoszenie ręczne",
    eyebrow: "Dane pojazdu",
    intro: "Opublikowane wartości, rodziny sterowników, metody odczytu i obsługiwane typy zleceń—jeden wybór, bez zgadywania.",
    power: "Moc",
    torque: "Moment obrotowy",
    gain: "Przyrost",
    publishedRecord: "Opublikowany rekord pojazdu",
    notPublished: "Nie opublikowano",
    readMethod: "Metoda odczytu",
    finalConfirmation: "Ostateczna zgodność i wartości są potwierdzane na podstawie dokładnego ECU lub TCU oraz oryginalnego pliku przed rozpoczęciem pracy.",
    startRequest: "Rozpocznij to zlecenie",
  },
  sq: {
    title: "Gjeni automjetin dhe shikoni të dhënat para kërkesës.",
    brandPlaceholder: "Marka",
    modelPlaceholder: "Modeli",
    generationPlaceholder: "Gjenerata",
    enginePlaceholder: "Motori",
    search: "Shfaq të dhënat",
    reviewTitle: "Të dhënat e performancës po verifikohen",
    reviewText: "Vlerat e sakta për këtë variant konfirmohen pas identifikimit të ECU-së dhe skedarit origjinal.",
    checking: "Po kontrollohet automjeti i zgjedhur...",
    notFound: "Nuk u gjet një automjet që përputhet. Zgjidheni përsëri ose krijoni një kërkesë manuale.",
    loadError: "Të dhënat e automjetit nuk u ngarkuan. Provoni përsëri ose krijoni një kërkesë manuale.",
    manualRequest: "Krijo kërkesë manuale",
    eyebrow: "Të dhënat e automjetit",
    intro: "Vlera të publikuara, familje kontrolluesish, metoda leximi dhe lloje kërkesash të mbështetura—një përzgjedhje, pa hamendësime.",
    power: "Fuqia",
    torque: "Çifti rrotullues",
    gain: "Rritja",
    publishedRecord: "Regjistër automjeti i publikuar",
    notPublished: "E papublikuar",
    readMethod: "Metoda e leximit",
    finalConfirmation: "Përputhshmëria dhe vlerat përfundimtare konfirmohen nga ECU-ja ose TCU-ja e saktë dhe skedari origjinal para se të fillojë puna.",
    startRequest: "Nis këtë kërkesë",
  },
} as const;

function VehicleSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: VehicleOption[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative min-w-0">
      <select
        aria-label={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-[#0a0a0c] px-3 pr-9 text-sm font-bold text-white outline-none transition hover:border-white/20 focus:border-red-500/70 focus:ring-2 focus:ring-red-950 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}

function StageCard({
  title,
  data,
  copy,
}: {
  title: string;
  data?: PerformanceData | null;
  copy: PublicVehicleCopy;
}) {
  const hasData = Boolean(data && (data.tunedHp !== null || data.tunedNm !== null));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-black text-white">{title}</div>
        <Gauge className="h-4 w-4 text-red-400" />
      </div>
      {!data || !hasData ? (
        <div className="mt-4 rounded-xl border border-white/8 bg-black/30 p-3">
          <div className="text-xs font-black text-zinc-200">{copy.reviewTitle}</div>
          <p className="mt-1 text-[0.7rem] leading-5 text-zinc-400">{copy.reviewText}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          <MetricLine label={copy.power} stock={data.stockHp} tuned={data.tunedHp} unit="HP" />
          <MetricLine label={copy.torque} stock={data.stockNm} tuned={data.tunedNm} unit="Nm" />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Gain label={copy.gain} value={data.gainHp} unit="HP" />
            <Gain label={copy.gain} value={data.gainNm} unit="Nm" />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricLine({
  label,
  stock,
  tuned,
  unit,
}: {
  label: string;
  stock: number | null;
  tuned: number | null;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-black/30 px-3 py-2.5 text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className="font-black text-white">
        {stock ?? "–"} <span className="px-1 text-red-400">→</span> {tuned ?? "–"} {unit}
      </span>
    </div>
  );
}

function Gain({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-2">
      <div className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-zinc-400">{label}</div>
      <div className="mt-1 text-sm font-black text-emerald-300">
        {value !== null ? `+${value}` : "–"} {unit}
      </div>
    </div>
  );
}

function ignoreVehicleFetchError() {
  // Navigation and changed selections intentionally abort stale catalog requests.
}

export function VehicleIntelligence({ locale = "en" }: { locale?: LocaleCode }) {
  const copy = publicVehicleCopy[locale] ?? publicVehicleCopy.en;
  const [brands, setBrands] = useState<VehicleOption[]>(getInitialVehicleBrands);
  const [models, setModels] = useState<VehicleOption[]>([]);
  const [generations, setGenerations] = useState<VehicleOption[]>([]);
  const [engines, setEngines] = useState<VehicleOption[]>([]);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [engineId, setEngineId] = useState("");
  const [vehicle, setVehicle] = useState<PublicVehicleData | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(false);
  const [vehicleError, setVehicleError] = useState("");
  const resultRef = useRef<HTMLDivElement | null>(null);
  const lookupIdRef = useRef(0);
  const lastAutoLookupKeyRef = useRef("");

  const selectedBrand = brands.find((item) => item.id === brandId)?.name ?? "";
  const selectedModel = models.find((item) => item.id === modelId)?.name ?? "";
  const selectedGeneration = generations.find((item) => item.id === generationId)?.name ?? "";
  const selectedEngine = engines.find((item) => item.id === engineId)?.name ?? "";

  const clearResult = () => {
    lookupIdRef.current += 1;
    setLoadingVehicle(false);
    setVehicle(null);
    setVehicleError("");
  };

  const handleBrandChange = (value: string) => {
    setBrandId(value);
    setModelId("");
    setGenerationId("");
    setEngineId("");
    setModels([]);
    setGenerations([]);
    setEngines([]);
    clearResult();
  };

  const handleModelChange = (value: string) => {
    setModelId(value);
    setGenerationId("");
    setEngineId("");
    setGenerations([]);
    setEngines([]);
    clearResult();
  };

  const handleGenerationChange = (value: string) => {
    setGenerationId(value);
    setEngineId("");
    setEngines([]);
    clearResult();
  };

  const handleEngineChange = (value: string) => {
    lastAutoLookupKeyRef.current = "";
    setEngineId(value);
    clearResult();
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchVehicleOptions("/api/vehicles?type=brands", controller.signal)
      .then((options) => {
        if (active && options.length) setBrands(options);
      })
      .catch(ignoreVehicleFetchError);
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!brandId) return;
    const controller = new AbortController();
    fetchVehicleOptions(`/api/vehicles?type=models&brandId=${brandId}`, controller.signal)
      .then(setModels)
      .catch(ignoreVehicleFetchError);
    return () => controller.abort();
  }, [brandId]);

  useEffect(() => {
    if (!brandId || !modelId) return;
    const controller = new AbortController();
    fetchVehicleOptions(
      `/api/vehicles?type=generations&brandId=${brandId}&modelId=${modelId}`,
      controller.signal
    )
      .then(setGenerations)
      .catch(ignoreVehicleFetchError);
    return () => controller.abort();
  }, [brandId, modelId]);

  useEffect(() => {
    if (!brandId || !modelId || !generationId) return;
    const controller = new AbortController();
    fetchVehicleOptions(
      `/api/vehicles?type=engines&brandId=${brandId}&modelId=${modelId}&generationId=${generationId}`,
      controller.signal
    )
      .then(setEngines)
      .catch(ignoreVehicleFetchError);
    return () => controller.abort();
  }, [brandId, modelId, generationId]);

  const handleSearch = useCallback(async (focusResult = false) => {
    if (!brandId || !modelId || !generationId || !engineId) return;
    const lookupId = lookupIdRef.current + 1;
    lookupIdRef.current = lookupId;
    setLoadingVehicle(true);
    setVehicle(null);
    setVehicleError("");

    try {
      const params = new URLSearchParams({
        type: "vehicle",
        brandId,
        modelId,
        generationId,
        engineId,
      });
      const response = await fetch(`/api/vehicles?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Vehicle lookup failed with ${response.status}`);
      const data = (await response.json()) as PublicVehicleData | null;
      if (lookupId !== lookupIdRef.current) return;
      if (!data) {
        setVehicleError(copy.notFound);
        return;
      }
      setVehicle(data);
      if (focusResult) {
        window.setTimeout(() => {
          resultRef.current?.focus({ preventScroll: true });
        }, 80);
      }
    } catch {
      if (lookupId !== lookupIdRef.current) return;
      setVehicleError(copy.loadError);
    } finally {
      if (lookupId === lookupIdRef.current) setLoadingVehicle(false);
    }
  }, [brandId, copy.loadError, copy.notFound, engineId, generationId, modelId]);

  useEffect(() => {
    if (!brandId || !modelId || !generationId || !engineId) return;
    const lookupKey = `${brandId}:${modelId}:${generationId}:${engineId}`;
    if (lastAutoLookupKeyRef.current === lookupKey) return;
    lastAutoLookupKeyRef.current = lookupKey;
    void handleSearch(false);
  }, [brandId, modelId, generationId, engineId, handleSearch]);

  const requestUrl =
    brandId && modelId && generationId && engineId
      ? `/login?redirect=${encodeURIComponent(
          `/new-request?brandId=${brandId}&modelId=${modelId}&generationId=${generationId}&engineId=${engineId}`
        )}`
      : "/login?redirect=%2Fnew-request";

  return (
    <section id="vehicle-data" data-no-translate className="relative scroll-mt-24 border-y border-white/[0.07] bg-[#08080a] py-14 text-white sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(177,18,27,0.14),transparent_34rem)]" />
      <div className="relative mx-auto max-w-[86rem] px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-red-400">
              <Sparkles className="h-4 w-4" /> {copy.eyebrow}
            </div>
            <h2 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">
              {copy.title}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">
              {copy.intro}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 shadow-2xl shadow-black/30">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
              <VehicleSelect value={brandId} onChange={handleBrandChange} options={brands} placeholder={copy.brandPlaceholder} />
              <VehicleSelect value={modelId} onChange={handleModelChange} options={models} placeholder={copy.modelPlaceholder} disabled={!brandId} />
              <VehicleSelect value={generationId} onChange={handleGenerationChange} options={generations} placeholder={copy.generationPlaceholder} disabled={!modelId} />
              <VehicleSelect value={engineId} onChange={handleEngineChange} options={engines} placeholder={copy.enginePlaceholder} disabled={!generationId} />
              <button
                type="button"
                onClick={() => void handleSearch(true)}
                disabled={!brandId || !modelId || !generationId || !engineId || loadingVehicle}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#b1121b] px-5 text-sm font-black text-white transition hover:bg-[#ce1722] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loadingVehicle ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Search className="mr-2 h-4 w-4" />}
                {loadingVehicle ? copy.checking : copy.search}
              </button>
            </div>
          </div>
        </div>

        <div aria-live="polite" aria-atomic="true">
          {vehicleError && (
            <div role="alert" className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100">
              {vehicleError}{" "}
              <Link href="/new-request" className="font-black underline underline-offset-4">
                {copy.manualRequest}
              </Link>
            </div>
          )}
        </div>

        {vehicle && (
          <div ref={resultRef} tabIndex={-1} role="region" aria-label={copy.publishedRecord} aria-live="polite" className="mt-6 overflow-hidden rounded-2xl border border-red-500/25 bg-[linear-gradient(120deg,rgba(177,18,27,0.12),rgba(255,255,255,0.025)_45%,rgba(0,0,0,0.2))] p-4 outline-none focus-visible:ring-2 focus-visible:ring-red-400 sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-[0.18em] text-red-300">
                  <Cpu className="h-4 w-4" /> {copy.publishedRecord}
                </div>
                <h3 className="mt-3 text-2xl font-black tracking-tight">
                  {selectedBrand} <span className="text-zinc-400">{selectedModel}</span>
                </h3>
                <p className="mt-1 text-sm font-bold text-zinc-400">{selectedGeneration} · {selectedEngine}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <VehicleFact label="ECU / TCU" value={vehicle.ecu?.length ? vehicle.ecu.join(", ") : copy.notPublished} />
                  <VehicleFact label={copy.readMethod} value={vehicle.readMethods?.length ? vehicle.readMethods.slice(0, 4).join(", ") : copy.notPublished} />
                </div>
                {Boolean(vehicle.services?.length) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {vehicle.services?.slice(0, 8).map((service) => (
                      <span key={service} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-black text-zinc-300">{service}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <StageCard title="Stage 1" data={vehicle.stage1} copy={copy} />
                <StageCard title="Stage 2" data={vehicle.stage2} copy={copy} />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-xs leading-5 text-zinc-400">
                {copy.finalConfirmation}
              </p>
              <Link href={requestUrl} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-white px-4 text-xs font-black text-black transition hover:bg-zinc-200">
                {copy.startRequest} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function VehicleFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</div>
      <div className="mt-1 break-words text-xs font-black text-zinc-200">{value}</div>
    </div>
  );
}
