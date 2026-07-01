"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clock3,
  CreditCard,
  Cpu,
  Download,
  FileCode2,
  Gauge,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
  Upload,
  UserPlus,
  Wrench,
  Zap,
  Activity,
  Sparkles,
  Calculator,
  TrendingUp,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { PerformanceTools } from "@/components/tools/PerformanceTools";
import { OnlineStatus } from "@/components/OnlineStatus";
import {
  CREDIT_PROMOTION_PERCENT,
  creditPackages as sharedCreditPackages,
} from "@/lib/creditPackages";
import { supabase } from "@/lib/supabaseClient";

const services = [
  {
    title: "Stage 1",
    text: "Performance optimization for stock vehicles.",
    credits: "10 Credits",
  },
  {
    title: "DPF OFF",
    text: "Technical software solution for diesel vehicles.",
    credits: "6 Credits",
  },
  {
    title: "EGR / AGR OFF",
    text: "EGR related software solution and DTC support.",
    credits: "6 Credits",
  },
  {
    title: "AdBlue OFF",
    text: "SCR / AdBlue software solution for supported ECUs.",
    credits: "11 Credits",
  },
  {
    title: "DTC OFF",
    text: "Diagnostic trouble code removal by request.",
    credits: "4 Credits",
  },
  {
    title: "TCU Tuning",
    text: "Gearbox software optimization for supported TCUs.",
    credits: "Manual",
  },
];

const steps = [
  {
    icon: UserPlus,
    title: "Register",
    text: "Create your customer account inside the MG AutoTech portal.",
  },
  {
    icon: CreditCard,
    title: "Load Credits",
    text: "Buy credits and use them for file service requests.",
  },
  {
    icon: Upload,
    title: "Upload File",
    text: "Upload original ECU/TCU file and vehicle information.",
  },
  {
    icon: Download,
    title: "Download File",
    text: "Track the status and download the completed file.",
  },
];

const workshopUseCases = [
  {
    title: "Performance File Preparation",
    text: "Stage 1 and Stage 2 requests with vehicle data, ECU details and original file upload.",
    meta: "ECU / TCU tuning",
    icon: Gauge,
  },
  {
    title: "Emission System Solutions",
    text: "Structured requests for DPF, EGR, AdBlue, OPF/GPF and related diagnostic requirements.",
    meta: "Technical options",
    icon: Wrench,
  },
  {
    title: "Diagnostic DTC Workflow",
    text: "Customers can add notes, fault codes and readout details so the file check stays clear.",
    meta: "DTC support",
    icon: FileCode2,
  },
  {
    title: "Completed File Delivery",
    text: "Modified files can be uploaded by admin and downloaded securely from the customer dashboard.",
    meta: "Secure delivery",
    icon: Download,
  },
];

const creditPackages = sharedCreditPackages
  .filter((pack) => pack.credits <= 250)
  .map((pack) => ({
    credits: String(pack.credits),
    price: pack.priceEuro,
    basePrice: pack.basePriceEuro,
    each: pack.priceEuro / pack.credits,
    popular: pack.highlight,
  }));

const securityItems = [
  { title: "Private Dashboard", icon: Lock },
  { title: "Database Credits", icon: CreditCard },
  { title: "Order Tracking", icon: Gauge },
  { title: "Workshop Ready", icon: Wrench },
  { title: "Secure Login", icon: ShieldCheck },
  { title: "File Workflow", icon: Upload },
];

const supportedBrands = [
  { name: "BMW", note: "MD1, EDC17, MG1", initials: "BM" },
  { name: "Mercedes-Benz", note: "CDI, MED, VGS", initials: "MB" },
  { name: "Audi", note: "VAG ECU / TCU", initials: "AU" },
  { name: "Volkswagen", note: "EDC, Simos, DSG", initials: "VW" },
  { name: "Porsche", note: "Performance files", initials: "PO" },
  { name: "Opel", note: "Diesel & petrol", initials: "OP" },
  { name: "Renault", note: "ECU solutions", initials: "RE" },
  { name: "Peugeot", note: "BlueHDi support", initials: "PE" },
];

const trustHighlights = [
  {
    title: "Secure file handling",
    text: "Original and modified files stay connected to the customer account.",
    icon: ShieldCheck,
  },
  {
    title: "Fast turnaround",
    text: "Clear request details help reduce back-and-forth before processing.",
    icon: Zap,
  },
  {
    title: "Workshop focused",
    text: "Built for repeat orders, technical notes and ECU/TCU file workflows.",
    icon: Wrench,
  },
  {
    title: "Credit based workflow",
    text: "Customers can buy credits once and use them across file requests.",
    icon: CreditCard,
  },
];

const calibrationKnowledgeItems = [
  {
    title: "WinOLS based file analysis",
    text: "Original files are reviewed with a calibration-focused workflow before service work starts.",
    icon: FileCode2,
    highlight: true,
  },
  {
    title: "DAMOS / A2L assisted checks",
    text: "Map structure knowledge can support deeper review when suitable data is available.",
    icon: Search,
  },
  {
    title: "ECU / TCU map structure experience",
    text: "Requests are checked against the vehicle, ECU family, read method and selected service.",
    icon: Cpu,
  },
  {
    title: "Bosch EDC / MD1 / MG1 support",
    text: "Common modern diesel and petrol control units are handled with platform-specific care.",
    icon: Gauge,
  },
  {
    title: "Siemens, Delphi and VAG knowledge",
    text: "The workflow is built around real workshop file-service cases, not generic upload handling.",
    icon: Wrench,
  },
  {
    title: "Manual calibration review",
    text: "Vehicle-specific checks help keep service requests clear before delivery or revision.",
    icon: ShieldCheck,
  },
];

const commandDeskStages = [
  {
    title: "File intake",
    detail: "Original file, vehicle data and read method are grouped into one request.",
    status: "Queued",
    icon: Upload,
  },
  {
    title: "Technical check",
    detail: "ECU/TCU details, notes and selected service are reviewed before processing.",
    status: "Review",
    icon: Search,
  },
  {
    title: "Calibration work",
    detail: "The file is prepared according to the requested service and vehicle context.",
    status: "Active",
    icon: Cpu,
  },
  {
    title: "Delivery control",
    detail: "Completed versions, revisions and customer downloads stay inside the portal.",
    status: "Ready",
    icon: Download,
  },
];

const commandDeskSignals = [
  { label: "Secure upload", value: "Portal only", icon: ShieldCheck },
  { label: "Payment flow", value: "Credits tracked", icon: CreditCard },
  { label: "Order status", value: "Live timeline", icon: Activity },
  { label: "File versions", value: "Revision ready", icon: FileCode2 },
];

const calculatorPresets = [
  {
    label: "Starter workshop",
    files: 12,
    salePrice: 149,
    credits: 8,
    creditCost: 4,
  },
  {
    label: "Growing partner",
    files: 35,
    salePrice: 169,
    credits: 8,
    creditCost: 3.8,
  },
  {
    label: "High-volume reseller",
    files: 80,
    salePrice: 189,
    credits: 9,
    creditCost: 3.5,
  },
];

function getGermanyNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  );
}

function getWorkloadSnapshot(date: Date) {
  const day = date.getDay();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const minutes = hour * 60 + minute;
  const open = 6 * 60;
  const nightPause = 2 * 60;
  const online = minutes >= open || minutes < nightPause;
  const sunday = day === 0;

  if (!online) {
    return {
      support: "Offline",
      queue: "Night pause",
      response: "From 06:00",
      note: "Requests can still be submitted and will be reviewed when the morning support window opens.",
    };
  }

  if (sunday) {
    if (minutes >= 22 * 60 || minutes < nightPause) {
      return {
        support: "Online",
        queue: "Limited Sunday",
        response: "~60-90 min",
        note: "Sunday support stays online with a smaller team, so complex files can take longer.",
      };
    }

    return {
      support: "Online",
      queue: "Sunday support",
      response: "~35-60 min",
      note: "Sunday requests are accepted, but response times can be slower because fewer staff are online.",
    };
  }

  if (minutes < 8 * 60) {
    return {
      support: "Online",
      queue: "Early support",
      response: "~10-20 min",
      note: "Early queue is usually light for standard file checks.",
    };
  }

  if (minutes < 12 * 60) {
    return {
      support: "Online",
      queue: "Normal",
      response: "~15-25 min",
      note: "Good time for standard ECU/TCU requests.",
    };
  }

  if (minutes < 14 * 60) {
    return {
      support: "Online",
      queue: "Lunch traffic",
      response: "~25-35 min",
      note: "Response time can move slightly during midday traffic.",
    };
  }

  if (minutes < 18 * 60) {
    return {
      support: "Online",
      queue: "Normal",
      response: "~15-30 min",
      note: "Most standard files are handled quickly during normal workload.",
    };
  }

  if (minutes < 22 * 60) {
    return {
      support: "Online",
      queue: "Busy",
      response: "~30-45 min",
      note: "After-work traffic can be busier, especially for complex files.",
    };
  }

  return {
    support: "Online",
    queue: "Late support",
    response: "~45-75 min",
    note: "Late evening requests are accepted, but complex checks may take longer during the reduced night team.",
  };
}

type VehicleOption = {
  id: string;
  name: string;
  fuelType?: string | null;
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
  stage1?: {
    stockHp: number | null;
    tunedHp: number | null;
    gainHp: number | null;
    stockNm: number | null;
    tunedNm: number | null;
    gainNm: number | null;
  } | null;
  stage2?: {
    stockHp: number | null;
    tunedHp: number | null;
    gainHp: number | null;
    stockNm: number | null;
    tunedNm: number | null;
    gainNm: number | null;
  } | null;
  readMethods?: string[];
  services?: string[];
};

const publicVehicleCopy = {
  en: {
    brandPlaceholder: "Select Vehicle Brand",
    modelPlaceholder: "Choose Model",
    generationPlaceholder: "Select Generation",
    enginePlaceholder: "Select Engine",
    search: "Search",
    reviewTitle: "Performance data under review",
    reviewText: "Exact values for this variant are confirmed after ECU and original-file identification.",
    checking: "Checking the selected vehicle record...",
    notFound: "No matching vehicle record was found. Please reselect the vehicle or create a manual request.",
    loadError: "Vehicle data could not be loaded. Please try again or create a manual request.",
    manualRequest: "Create a manual request",
  },
  de: {
    brandPlaceholder: "Fahrzeugmarke wählen",
    modelPlaceholder: "Modell wählen",
    generationPlaceholder: "Generation wählen",
    enginePlaceholder: "Motor wählen",
    search: "Suchen",
    reviewTitle: "Leistungsdaten werden geprüft",
    reviewText: "Die genauen Werte dieser Variante werden nach Identifikation von Steuergerät und Originaldatei bestätigt.",
    checking: "Der ausgewählte Fahrzeugdatensatz wird geprüft...",
    notFound: "Kein passender Fahrzeugdatensatz gefunden. Bitte Fahrzeug erneut auswählen oder eine manuelle Anfrage erstellen.",
    loadError: "Die Fahrzeugdaten konnten nicht geladen werden. Bitte erneut versuchen oder eine manuelle Anfrage erstellen.",
    manualRequest: "Manuelle Anfrage erstellen",
  },
  tr: {
    brandPlaceholder: "Araç markası seçin",
    modelPlaceholder: "Model seçin",
    generationPlaceholder: "Nesil seçin",
    enginePlaceholder: "Motor seçin",
    search: "Ara",
    reviewTitle: "Performans verileri kontrol ediliyor",
    reviewText: "Bu varyantın kesin değerleri ECU ve orijinal dosya tanımlamasından sonra doğrulanır.",
    checking: "Seçilen araç kaydı kontrol ediliyor...",
    notFound: "Eşleşen araç kaydı bulunamadı. Aracı yeniden seçin veya manuel talep oluşturun.",
    loadError: "Araç verileri yüklenemedi. Tekrar deneyin veya manuel talep oluşturun.",
    manualRequest: "Manuel talep oluştur",
  },
  nl: {
    brandPlaceholder: "Kies voertuigmerk",
    modelPlaceholder: "Kies model",
    generationPlaceholder: "Kies generatie",
    enginePlaceholder: "Kies motor",
    search: "Zoeken",
    reviewTitle: "Prestatiegegevens worden gecontroleerd",
    reviewText: "De exacte waarden voor deze variant worden bevestigd na identificatie van de ECU en het originele bestand.",
    checking: "Het geselecteerde voertuigrecord wordt gecontroleerd...",
    notFound: "Geen passend voertuigrecord gevonden. Selecteer het voertuig opnieuw of maak een handmatige aanvraag.",
    loadError: "De voertuiggegevens konden niet worden geladen. Probeer opnieuw of maak een handmatige aanvraag.",
    manualRequest: "Handmatige aanvraag maken",
  },
  fr: {
    brandPlaceholder: "Sélectionner la marque",
    modelPlaceholder: "Sélectionner le modèle",
    generationPlaceholder: "Sélectionner la génération",
    enginePlaceholder: "Sélectionner le moteur",
    search: "Rechercher",
    reviewTitle: "Données de performance en cours de vérification",
    reviewText: "Les valeurs exactes de cette variante sont confirmées après identification de l'ECU et du fichier d'origine.",
    checking: "Vérification du véhicule sélectionné...",
    notFound: "Aucun véhicule correspondant n'a été trouvé. Sélectionnez à nouveau le véhicule ou créez une demande manuelle.",
    loadError: "Les données du véhicule n'ont pas pu être chargées. Réessayez ou créez une demande manuelle.",
    manualRequest: "Créer une demande manuelle",
  },
  it: {
    brandPlaceholder: "Seleziona la marca",
    modelPlaceholder: "Seleziona il modello",
    generationPlaceholder: "Seleziona la generazione",
    enginePlaceholder: "Seleziona il motore",
    search: "Cerca",
    reviewTitle: "Dati prestazionali in verifica",
    reviewText: "I valori esatti di questa variante vengono confermati dopo l'identificazione della ECU e del file originale.",
    checking: "Verifica del veicolo selezionato...",
    notFound: "Nessun veicolo corrispondente trovato. Seleziona nuovamente il veicolo o crea una richiesta manuale.",
    loadError: "Impossibile caricare i dati del veicolo. Riprova o crea una richiesta manuale.",
    manualRequest: "Crea richiesta manuale",
  },
  ru: {
    brandPlaceholder: "Выберите марку",
    modelPlaceholder: "Выберите модель",
    generationPlaceholder: "Выберите поколение",
    enginePlaceholder: "Выберите двигатель",
    search: "Найти",
    reviewTitle: "Данные мощности проверяются",
    reviewText: "Точные значения для этой версии подтверждаются после идентификации ECU и исходного файла.",
    checking: "Проверяем выбранную запись автомобиля...",
    notFound: "Подходящая запись автомобиля не найдена. Выберите автомобиль ещё раз или создайте ручную заявку.",
    loadError: "Не удалось загрузить данные автомобиля. Повторите попытку или создайте ручную заявку.",
    manualRequest: "Создать ручную заявку",
  },
  es: {
    brandPlaceholder: "Seleccionar marca",
    modelPlaceholder: "Seleccionar modelo",
    generationPlaceholder: "Seleccionar generación",
    enginePlaceholder: "Seleccionar motor",
    search: "Buscar",
    reviewTitle: "Datos de rendimiento en revisión",
    reviewText: "Los valores exactos de esta variante se confirman tras identificar la ECU y el archivo original.",
    checking: "Comprobando el vehículo seleccionado...",
    notFound: "No se encontró un vehículo coincidente. Vuelve a seleccionarlo o crea una solicitud manual.",
    loadError: "No se pudieron cargar los datos del vehículo. Inténtalo de nuevo o crea una solicitud manual.",
    manualRequest: "Crear solicitud manual",
  },
  pt: {
    brandPlaceholder: "Selecionar marca",
    modelPlaceholder: "Selecionar modelo",
    generationPlaceholder: "Selecionar geração",
    enginePlaceholder: "Selecionar motor",
    search: "Pesquisar",
    reviewTitle: "Dados de desempenho em verificação",
    reviewText: "Os valores exatos desta variante são confirmados após a identificação da ECU e do ficheiro original.",
    checking: "A verificar o veículo selecionado...",
    notFound: "Não foi encontrado um veículo correspondente. Selecione novamente ou crie um pedido manual.",
    loadError: "Não foi possível carregar os dados do veículo. Tente novamente ou crie um pedido manual.",
    manualRequest: "Criar pedido manual",
  },
  zh: {
    brandPlaceholder: "选择车辆品牌",
    modelPlaceholder: "选择车型",
    generationPlaceholder: "选择代系",
    enginePlaceholder: "选择发动机",
    search: "搜索",
    reviewTitle: "性能数据正在审核",
    reviewText: "该车型的准确数值将在识别 ECU 和原始文件后确认。",
    checking: "正在检查所选车辆记录...",
    notFound: "未找到匹配的车辆记录。请重新选择车辆或创建手动请求。",
    loadError: "无法加载车辆数据。请重试或创建手动请求。",
    manualRequest: "创建手动请求",
  },
  pl: {
    brandPlaceholder: "Wybierz markę pojazdu",
    modelPlaceholder: "Wybierz model",
    generationPlaceholder: "Wybierz generację",
    enginePlaceholder: "Wybierz silnik",
    search: "Szukaj",
    reviewTitle: "Dane osiągów są weryfikowane",
    reviewText: "Dokładne wartości dla tej wersji są potwierdzane po identyfikacji ECU i oryginalnego pliku.",
    checking: "Sprawdzanie wybranego pojazdu...",
    notFound: "Nie znaleziono pasującego pojazdu. Wybierz pojazd ponownie lub utwórz zgłoszenie ręczne.",
    loadError: "Nie udało się wczytać danych pojazdu. Spróbuj ponownie lub utwórz zgłoszenie ręczne.",
    manualRequest: "Utwórz zgłoszenie ręczne",
  },
  sq: {
    brandPlaceholder: "Zgjidhni markën",
    modelPlaceholder: "Zgjidhni modelin",
    generationPlaceholder: "Zgjidhni gjeneratën",
    enginePlaceholder: "Zgjidhni motorin",
    search: "Kërko",
    reviewTitle: "Të dhënat e performancës po verifikohen",
    reviewText: "Vlerat e sakta për këtë variant konfirmohen pas identifikimit të ECU-së dhe skedarit origjinal.",
    checking: "Po kontrollohet automjeti i zgjedhur...",
    notFound: "Nuk u gjet një automjet që përputhet. Zgjidheni përsëri ose krijoni një kërkesë manuale.",
    loadError: "Të dhënat e automjetit nuk u ngarkuan. Provoni përsëri ose krijoni një kërkesë manuale.",
    manualRequest: "Krijo kërkesë manuale",
  },
} as const;

type PublicVehicleCopy = (typeof publicVehicleCopy)[keyof typeof publicVehicleCopy];

function normalizePublicVehicleLocale(value?: string | null) {
  const locale = value?.toLowerCase().split("-")[0] ?? "en";
  return locale in publicVehicleCopy
    ? (locale as keyof typeof publicVehicleCopy)
    : "en";
}

function usePublicVehicleCopy() {
  const [copy, setCopy] = useState<PublicVehicleCopy>(publicVehicleCopy.en);

  useEffect(() => {
    const syncLocale = (value?: string | null) => {
      const stored = window.localStorage.getItem("mg_locale");
      const locale = normalizePublicVehicleLocale(
        value ?? stored ?? document.documentElement.lang
      );
      setCopy(publicVehicleCopy[locale]);
    };

    const handleLocaleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ locale?: string }>).detail;
      syncLocale(detail?.locale);
    };

    syncLocale();
    window.addEventListener("mg-locale-change", handleLocaleChange);

    return () => window.removeEventListener("mg-locale-change", handleLocaleChange);
  }, []);

  return copy;
}


const fadeUp: Variants = {
  hidden: { opacity: 0, y: 34 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const stagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

function AnimatedSection({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.16 }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function FloatingTechBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.28),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <motion.div
        animate={{
          x: [0, 45, 0],
          y: [0, -25, 0],
          opacity: [0.16, 0.3, 0.16],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[8%] top-[18%] h-72 w-72 rounded-full bg-red-900/30 blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, -35, 0],
          y: [0, 35, 0],
          opacity: [0.1, 0.22, 0.1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-[8%] top-[28%] h-96 w-96 rounded-full bg-red-800/25 blur-3xl"
      />

      <motion.div
        animate={{ x: ["-20%", "120%"] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        className="absolute top-[42%] h-px w-[260px] bg-gradient-to-r from-transparent via-red-700/60 to-transparent"
      />

      <motion.div
        animate={{ x: ["120%", "-20%"] }}
        transition={{ duration: 13, repeat: Infinity, ease: "linear" }}
        className="absolute top-[62%] h-px w-[340px] bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
    </div>
  );
}

function RatingStars() {
  return (
    <div className="flex items-center gap-1 text-red-500">
      {[1, 2, 3, 4, 5].map((item) => (
        <Star key={item} className="h-3 w-3 fill-current" />
      ))}
    </div>
  );
}

function TechnicalHeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, x: 24 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.75, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="hidden h-[685px] lg:block"
    >
      <div className="relative h-[685px] overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#07080b]/90 p-6 shadow-2xl shadow-black backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(177,18,27,0.25),transparent_36%),linear-gradient(145deg,rgba(255,255,255,0.06),transparent_38%)]" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-red-700/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-red-950/35 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />

        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-red-500">
                MG AutoTech
              </div>
              <div className="mt-2 text-4xl font-black tracking-wide">
                File Service
              </div>
            </div>

            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-300">
              Online
            </div>
          </div>

          <div className="relative mt-8 flex flex-1 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-black/35">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:42px_42px] opacity-25" />
            <div className="absolute left-8 top-8 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-black text-red-100">
              ECU / TCU
            </div>
            <div className="absolute bottom-8 right-8 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-black text-zinc-200">
              OBD · Bench · Boot
            </div>

            <div className="absolute h-[420px] w-[420px] rounded-full border-[34px] border-red-700/20" />
            <div className="absolute h-[300px] w-[300px] rounded-full border border-red-600/30" />
            <div className="absolute h-[220px] w-[220px] rounded-full bg-red-700/15 blur-3xl" />

            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 1, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex h-56 w-56 items-center justify-center rounded-[2.5rem] border border-red-800/60 bg-black/80 shadow-2xl shadow-red-950/50"
            >
              <div className="absolute inset-5 rounded-[1.8rem] border border-red-700/35" />
              <div className="absolute -left-10 top-14 h-px w-10 bg-red-700/70" />
              <div className="absolute -right-10 bottom-14 h-px w-10 bg-red-700/70" />
              <div className="absolute -top-10 left-1/2 h-10 w-px -translate-x-1/2 bg-red-700/70" />
              <div className="absolute -bottom-10 left-1/2 h-10 w-px -translate-x-1/2 bg-red-700/70" />
              <Cpu className="h-24 w-24 text-red-500" />
            </motion.div>
          </div>

          <div className="relative mt-5 grid h-[92px] grid-cols-3 gap-3">
            {[
              [ShieldCheck, "Secure Portal"],
              [Zap, "Fast Handling"],
              [Wrench, "Workshop Ready"],
            ].map(([Icon, label]) => {
              const LucideIcon = Icon as typeof ShieldCheck;

              return (
              <div
                key={String(label)}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-950/40 text-red-500">
                  <LucideIcon className="h-5 w-5" />
                </div>
                <div className="text-sm font-black leading-tight text-white">
                  {String(label)}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}



function PublicVehicleSelect({
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
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 w-full appearance-none rounded-xl border border-white/15 bg-white/10 px-4 pr-10 text-sm font-black text-white outline-none backdrop-blur transition hover:bg-white/15 focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <option value="" className="bg-[#111]">
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id} className="bg-[#111]">
            {option.name}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80" />
    </div>
  );
}

function PublicStageCard({
  title,
  data,
  copy,
}: {
  title: string;
  data?: PublicVehicleData["stage1"];
  copy: PublicVehicleCopy;
}) {
  const hasPerformanceData = Boolean(
    data && (data.tunedHp !== null || data.tunedNm !== null)
  );

  if (!data || !hasPerformanceData) {
    return (
      <div data-no-translate className="rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-black">{title}</div>
          <Zap className="h-4 w-4 text-red-300" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
          <div className="text-sm font-black">{copy.reviewTitle}</div>
          <p className="mt-2 text-xs leading-5 text-red-100/70">
            {copy.reviewText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-black">{title}</div>
        <Zap className="h-4 w-4 text-red-300" />
      </div>

      <div className="grid gap-2 text-xs">
        <div className="flex justify-between rounded-xl bg-white/10 px-3 py-2">
          <span className="text-red-100/80">Power</span>
          <span className="font-black">
            {data.stockHp ?? "-"} {"\u2192"} {data.tunedHp ?? "-"} HP
          </span>
        </div>

        <div className="flex justify-between rounded-xl bg-white/10 px-3 py-2">
          <span className="text-red-100/80">Torque</span>
          <span className="font-black">
            {data.stockNm ?? "-"} {"\u2192"} {data.tunedNm ?? "-"} Nm
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-xl border border-white/15 bg-white/10 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.12em] text-red-100/70">
              HP Gain
            </div>
            <div className="text-lg font-black">
              {data.gainHp !== null ? `+${data.gainHp}` : "-"}
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/10 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.12em] text-red-100/70">
              Nm Gain
            </div>
            <div className="text-lg font-black">
              {data.gainNm !== null ? `+${data.gainNm}` : "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function WorkshopCommandDesk() {
  return (
    <AnimatedSection className="bg-[#07090d] py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <div className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-200">
                <Sparkles className="h-4 w-4 text-red-400" />
                Workshop command desk
              </div>
              <h2 className="mt-5 max-w-xl text-4xl font-black leading-tight [overflow-wrap:anywhere] md:text-5xl">
                One clear view for serious file-service work.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
                A public preview of how requests are handled inside MG AutoTech:
                intake, checking, calibration, delivery and revision control.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {commandDeskSignals.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-black/35 p-4"
                  >
                    <Icon className="mb-3 h-5 w-5 text-red-400" />
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      {item.label}
                    </div>
                    <div className="mt-1 text-sm font-black text-white">
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-red-900/40 bg-[linear-gradient(135deg,rgba(177,18,27,0.18),rgba(255,255,255,0.04)_45%,rgba(0,0,0,0.5))] p-5 shadow-2xl shadow-red-950/20">
            <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-black text-white">
                  Live operation preview
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Structured workflow without exposing private order data
                </div>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/40" />
                System online
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {commandDeskStages.map((stage, index) => {
                const Icon = stage.icon;

                return (
                  <div
                    key={stage.title}
                    className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-5"
                  >
                    <div className="absolute right-4 top-4 text-5xl font-black text-white/[0.04]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-800/40 bg-red-950/25 text-red-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black text-zinc-300">
                        {stage.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white">
                      {stage.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {stage.detail}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 md:grid-cols-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                  Standard response
                </div>
                <div className="mt-1 text-xl font-black">~30 min</div>
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                  Request types
                </div>
                <div className="mt-1 text-xl font-black">ECU / TCU</div>
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                  Delivery
                </div>
                <div className="mt-1 text-xl font-black">Dashboard</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

function BusinessMarginCalculator() {
  const [monthlyFiles, setMonthlyFiles] = useState(35);
  const [averageSalePrice, setAverageSalePrice] = useState(169);
  const [averageCredits, setAverageCredits] = useState(8);
  const [creditCost, setCreditCost] = useState(3.8);

  const revenue = monthlyFiles * averageSalePrice;
  const fileServiceCost = monthlyFiles * averageCredits * creditCost;
  const grossProfit = revenue - fileServiceCost;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const profitPerFile = monthlyFiles > 0 ? grossProfit / monthlyFiles : 0;

  const applyPreset = (preset: (typeof calculatorPresets)[number]) => {
    setMonthlyFiles(preset.files);
    setAverageSalePrice(preset.salePrice);
    setAverageCredits(preset.credits);
    setCreditCost(preset.creditCost);
  };

  return (
    <AnimatedSection className="bg-[#050505] py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Business Calculator
            </div>
            <h2 className="mt-3 max-w-4xl text-4xl font-black md:text-5xl">
              See what file-service volume could mean for your workshop.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
              Choose a simple workshop profile or adjust the key numbers. The
              result gives a quick partner revenue estimate before opening an
              account.
            </p>
          </div>

          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#c91824]"
          >
            Start as Partner
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
            <div className="mb-5 flex items-center gap-3">
              <Calculator className="h-7 w-7 text-red-500" />
              <h3 className="text-2xl font-black">Your numbers</h3>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-3">
              {calculatorPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-xs font-black text-zinc-300 transition hover:border-red-800/60 hover:bg-red-950/20 hover:text-white"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              <CalculatorInput
                label="Monthly completed files"
                value={monthlyFiles}
                min={1}
                max={150}
                step={1}
                suffix="files"
                onChange={setMonthlyFiles}
              />
              <CalculatorInput
                label="Average customer sale price"
                value={averageSalePrice}
                min={49}
                max={399}
                step={5}
                prefix="€"
                onChange={setAverageSalePrice}
              />
              <CalculatorInput
                label="Average credits per file"
                value={averageCredits}
                min={2}
                max={20}
                step={1}
                suffix="credits"
                onChange={setAverageCredits}
              />
            </div>

          </div>

          <div className="rounded-[2rem] border border-red-900/50 bg-gradient-to-br from-red-950/30 via-white/[0.04] to-black p-6 shadow-2xl shadow-black/30">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.22em] text-red-400">
                  Estimated Outcome
                </div>
                <h3 className="mt-2 text-3xl font-black">Simple monthly estimate</h3>
              </div>
              <TrendingUp className="h-9 w-9 text-emerald-400" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ResultCard label="Completed files" value={`${monthlyFiles}`} detail="Estimated monthly file volume" />
              <ResultCard label="Customer revenue" value={formatEuro(revenue)} detail={`${formatEuro(averageSalePrice)} average sale`} />
              <ResultCard label="Credit usage" value={`${monthlyFiles * averageCredits}`} detail={`${averageCredits} credits per file`} />
              <ResultCard label="Credit cost" value={formatEuro(fileServiceCost)} detail={`${formatEuro(creditCost)} estimated credit rate`} />
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-emerald-700/30 bg-emerald-950/20 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300/80">
                    Estimated profit
                  </div>
                  <div className="mt-2 text-4xl font-black text-emerald-300">
                    {formatEuro(grossProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    Margin
                  </div>
                  <div className="mt-2 text-3xl font-black">
                    {profitMargin.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    Profit / file
                  </div>
                  <div className="mt-2 text-3xl font-black">
                    {formatEuro(profitPerFile)}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-zinc-500">
              A quick estimate for workshops comparing monthly file volume,
              customer pricing and MG AutoTech credit usage.
            </p>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

function CalculatorInput({
  label,
  value,
  min,
  max,
  step,
  prefix,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-black text-white">{label}</span>
        <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-red-300">
          {prefix}
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-red-600"
      />
    </label>
  );
}

function ResultCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-500">{detail}</div>
    </div>
  );
}

function ignoreVehicleFetchError() {
  // Page navigation can abort the public vehicle checker requests.
}

function PublicVehicleChecker() {
  const copy = usePublicVehicleCopy();
  const [brands, setBrands] = useState<VehicleOption[]>([]);
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
  const vehicleResultRef = useRef<HTMLDivElement | null>(null);

  const selectedBrandName =
    brands.find((item) => item.id === brandId)?.name ?? "";
  const selectedModelName =
    models.find((item) => item.id === modelId)?.name ?? "";
  const selectedGenerationName =
    generations.find((item) => item.id === generationId)?.name ?? "";
  const selectedEngineName =
    engines.find((item) => item.id === engineId)?.name ?? "";

  const handleBrandChange = (value: string) => {
    setBrandId(value);
    setModelId("");
    setGenerationId("");
    setEngineId("");
    setModels([]);
    setGenerations([]);
    setEngines([]);
    setVehicle(null);
    setVehicleError("");
  };

  const handleModelChange = (value: string) => {
    setModelId(value);
    setGenerationId("");
    setEngineId("");
    setGenerations([]);
    setEngines([]);
    setVehicle(null);
    setVehicleError("");
  };

  const handleGenerationChange = (value: string) => {
    setGenerationId(value);
    setEngineId("");
    setEngines([]);
    setVehicle(null);
    setVehicleError("");
  };

  const handleEngineChange = (value: string) => {
    setEngineId(value);
    setVehicle(null);
    setVehicleError("");
  };

  useEffect(() => {
    if (!vehicle) return;

    const timer = window.setTimeout(() => {
      const result = vehicleResultRef.current;
      if (!result) return;

      result.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      result.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [vehicle]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/vehicles?type=brands", { signal: controller.signal })
      .then((res) => res.json())
      .then(setBrands)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!brandId) return;

    const controller = new AbortController();

    fetch(`/api/vehicles?type=models&brandId=${brandId}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then(setModels)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, [brandId]);

  useEffect(() => {
    if (!brandId || !modelId) return;

    const controller = new AbortController();

    fetch(`/api/vehicles?type=generations&brandId=${brandId}&modelId=${modelId}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then(setGenerations)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, [brandId, modelId]);

  useEffect(() => {
    if (!brandId || !modelId || !generationId) return;

    const controller = new AbortController();

    fetch(
      `/api/vehicles?type=engines&brandId=${brandId}&modelId=${modelId}&generationId=${generationId}`,
      { signal: controller.signal }
    )
      .then((res) => res.json())
      .then(setEngines)
      .catch(ignoreVehicleFetchError);

    return () => controller.abort();
  }, [brandId, modelId, generationId]);

  const handleSearch = async () => {
    if (!brandId || !modelId || !generationId || !engineId) return;

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
      const res = await fetch(`/api/vehicles?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`Vehicle lookup failed with ${res.status}`);

      const data = (await res.json()) as PublicVehicleData | null;

      if (!data) {
        setVehicleError(
          copy.notFound
        );
        return;
      }

      setVehicle(data);
    } catch {
      setVehicle(null);
      setVehicleError(
        copy.loadError
      );
    } finally {
      setLoadingVehicle(false);
    }
  };

  const requestUrl =
    brandId && modelId && generationId && engineId
      ? `/login?redirect=${encodeURIComponent(
          `/new-request?brandId=${brandId}&modelId=${modelId}&generationId=${generationId}&engineId=${engineId}`
        )}`
      : "/login";

  return (
    <div className="relative border-t border-red-500/20 bg-[#b1121b] py-10">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_0%,white,transparent_28%)]" />
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="text-2xl font-black md:text-3xl">
          View tuning data and create your file request online.
        </h2>

        <div data-no-translate className="mt-7 grid gap-4 md:grid-cols-5">
          <PublicVehicleSelect
            value={brandId}
            onChange={handleBrandChange}
            options={brands}
            placeholder={copy.brandPlaceholder}
          />

          <PublicVehicleSelect
            value={modelId}
            onChange={handleModelChange}
            options={models}
            placeholder={copy.modelPlaceholder}
            disabled={!brandId}
          />

          <PublicVehicleSelect
            value={generationId}
            onChange={handleGenerationChange}
            options={generations}
            placeholder={copy.generationPlaceholder}
            disabled={!modelId}
          />

          <PublicVehicleSelect
            value={engineId}
            onChange={handleEngineChange}
            options={engines}
            placeholder={copy.enginePlaceholder}
            disabled={!generationId}
          />

          <button
            onClick={handleSearch}
            disabled={!brandId || !modelId || !generationId || !engineId || loadingVehicle}
            className="flex h-14 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="mr-2 h-4 w-4" />
            {loadingVehicle ? copy.checking : copy.search}
          </button>
        </div>

        <div data-no-translate aria-live="polite" aria-atomic="true">
          {loadingVehicle && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm font-bold text-white">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {copy.checking}
            </div>
          )}

          {vehicleError && (
            <div role="alert" className="mt-4 rounded-xl border border-white/25 bg-black/30 px-4 py-4 text-sm font-bold text-white">
              {vehicleError}
              <Link href="/new-request" className="ml-2 underline decoration-white/50 underline-offset-4 hover:decoration-white">
                {copy.manualRequest}
              </Link>
            </div>
          )}
        </div>

        {vehicle && (
          <motion.div
            ref={vehicleResultRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-8 scroll-mt-24 overflow-hidden rounded-[2rem] border border-white/20 bg-black/35 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.5rem] border border-white/15 bg-gradient-to-br from-black/60 via-red-950/20 to-black/60 p-6">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-red-50">
                  <Cpu className="h-4 w-4" />
                  Public Vehicle Intelligence
                </div>

                <h3 className="text-3xl font-black">
                  {selectedBrandName}{" "}
                  <span className="text-white/80">{selectedModelName}</span>
                </h3>

                <p className="mt-2 text-sm font-bold text-red-100/80">
                  {selectedGenerationName} · {selectedEngineName}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-red-100/60">
                      ECU / TCU
                    </div>
                    <div className="mt-2 text-sm font-black">
                      {vehicle.ecu?.length ? vehicle.ecu.join(", ") : "Not available"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-red-100/60">
                      Read Method
                    </div>
                    <div className="mt-2 text-sm font-black">
                      {vehicle.readMethods?.length
                        ? vehicle.readMethods.slice(0, 4).join(", ")
                        : "Not available"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {vehicle.services?.slice(0, 8).map((service) => (
                    <span
                      key={service}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <PublicStageCard title="Stage 1" data={vehicle.stage1} copy={copy} />
                <PublicStageCard title="Stage 2" data={vehicle.stage2} copy={copy} />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-black">Ready to request a custom file?</div>
                <p className="mt-1 text-sm text-red-100/80">
                  Login or register to upload your original file and create a real order.
                </p>
              </div>

              <Link
                href={requestUrl}
                className="flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black text-[#b1121b] transition hover:-translate-y-0.5 hover:bg-zinc-100"
              >
                Create File Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [workloadSnapshot, setWorkloadSnapshot] = useState(() =>
    getWorkloadSnapshot(getGermanyNow())
  );
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const updateWorkload = () => {
      setWorkloadSnapshot(getWorkloadSnapshot(getGermanyNow()));
    };

    updateWorkload();
    const interval = window.setInterval(updateWorkload, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    const loadAuthState = async () => {
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      setUserEmail(data.session?.user.email ?? null);
      setAuthReady(true);
    };

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    setAuthReady(true);
  };

  const isLoggedIn = authReady && Boolean(userEmail);

  const liveWorkloadItems = [
    {
      title: "Online status",
      value: workloadSnapshot.support,
      text:
        workloadSnapshot.support === "Offline"
          ? "Requests are accepted and reviewed from the 06:00 support window."
          : "Customer requests are monitored during the 06:00-02:00 operation window.",
      icon: Activity,
      tone: workloadSnapshot.support === "Offline" ? "red" : "emerald",
    },
    {
      title: "Standard file queue",
      value: workloadSnapshot.queue,
      text: "Queue level changes during busy workshop traffic hours.",
      icon: Gauge,
      tone:
        workloadSnapshot.queue === "Busy" ||
        workloadSnapshot.queue === "Late support" ||
        workloadSnapshot.queue === "Limited Sunday"
          ? "red"
          : "blue",
    },
    {
      title: "Average response",
      value: workloadSnapshot.response,
      text: workloadSnapshot.note,
      icon: Clock3,
      tone: "blue",
    },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <FloatingTechBackground />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto hidden max-w-7xl items-center justify-between px-4 py-2 text-xs text-zinc-300 lg:flex">
          <div className="flex items-center gap-3">
            <RatingStars />
            <span className="rounded-md bg-[#b1121b] px-2 py-0.5 font-bold text-white">
              9.9/10
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Email Support
            </span>
          </div>

          <div className="ml-auto flex items-center gap-5">
            <a href="#services" className="hover:text-white">
              Services
            </a>
            <a href="#brands" className="hover:text-white">
              Brands
            </a>
            <a href="#prices" className="hover:text-white">
              Prices
            </a>
            <Link href="/tools" className="hover:text-white">
              Tools
            </Link>
            <Link href="/widget" className="hover:text-white">
              Vehicle Widget
            </Link>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
            {!authReady ? null : isLoggedIn ? (
              <>
                <Link href="/dashboard" className="hover:text-white">
                  My Account
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hover:text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/login" className="hover:text-white">
                Login
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:py-5">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -1 }}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40 sm:h-12 sm:w-12"
            >
              <div className="absolute -top-2 h-5 w-10 rounded-t-full border-t-2 border-red-700" />
              <Cpu className="h-6 w-6 text-red-600 sm:h-7 sm:w-7" />
            </motion.div>

            <div className="min-w-0">
              <div className="truncate text-lg font-black tracking-wide sm:text-xl">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="truncate text-[11px] text-zinc-400 sm:text-xs">
                ECU / TCU File Service
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-zinc-300 lg:flex">
            <a href="#home" className="text-red-500">
              Home
            </a>
            <a href="#workflow" className="hover:text-white">
              How It Works
            </a>
            <a href="#services" className="hover:text-white">
              Services
            </a>
            <a href="#brands" className="hover:text-white">
              Brands
            </a>
            <a href="#prices" className="hover:text-white">
              Credit Prices
            </a>
            <a href="#security" className="hover:text-white">
              Security
            </a>
            <Link href="/tools" className="hover:text-white">
              Tools
            </Link>
            <Link href="/widget" className="hover:text-white">
              Vehicle Widget
            </Link>
          </nav>

          {!authReady ? (
            <div
              className="flex items-center gap-2"
              aria-hidden="true"
            >
              <div className="hidden h-11 w-28 rounded-xl border border-white/10 bg-white/[0.04] md:block" />
              <div className="h-11 w-28 rounded-xl bg-red-950/40" />
            </div>
          ) : isLoggedIn ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="rounded-xl bg-[#b1121b] px-3 py-3 text-xs font-black text-white shadow-lg shadow-red-950/40 transition duration-300 hover:-translate-y-0.5 hover:bg-[#c91824] sm:px-5 sm:text-sm"
              >
                <LayoutDashboard className="mr-2 inline h-4 w-4" />
                My Account
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition duration-300 hover:bg-white/10 md:flex"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition duration-300 hover:bg-white/10 md:flex"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Link>

              <Link
                href="/register"
                className="rounded-xl bg-[#b1121b] px-3 py-3 text-xs font-black text-white shadow-lg shadow-red-950/40 transition duration-300 hover:-translate-y-0.5 hover:bg-[#c91824] sm:px-5 sm:text-sm"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.94),rgba(0,0,0,0.68),rgba(0,0,0,0.94))]" />
        <motion.div
          animate={{ rotate: [0, 2, 0], scale: [1, 1.02, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[-140px] top-14 -z-10 hidden h-[520px] w-[900px] rounded-full border-[32px] border-red-800/50 opacity-70 lg:block"
        />
        <div className="absolute right-[-20px] top-36 -z-10 hidden h-[280px] w-[650px] rounded-[4rem] bg-[linear-gradient(135deg,#111,#050505)] opacity-80 shadow-2xl shadow-black lg:block" />
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55], width: ["420px", "540px", "420px"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-20 top-52 -z-10 hidden h-3 rounded-full bg-red-700 blur-sm lg:block"
        />
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-32 top-52 -z-10 hidden h-1 w-[480px] rounded-full bg-red-500 lg:block"
        />

        <div className="mx-auto grid min-h-[720px] max-w-7xl gap-12 px-4 py-14 sm:py-20 lg:h-[825px] lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <motion.div
            className="min-w-0 lg:min-h-[520px]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-sm font-semibold text-red-100">
              <BadgeCheck className="h-4 w-4 text-red-500" />
              Professional online file service platform
            </div>

            <h1 className="max-w-full break-words text-[clamp(2.65rem,12vw,4.6rem)] font-black uppercase leading-[1.05] tracking-[0.04em] md:text-7xl md:tracking-[0.08em]">
              Custom ECU & TCU{" "}
              <span className="block text-red-600">Tuning Files</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Upload original ECU/TCU files, select your service, track your
              order and download the completed file directly through the secure
              MG AutoTech customer portal.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              {!authReady ? (
                <>
                  <div className="h-14 w-36 rounded-xl border border-white/10 bg-white/[0.08]" />
                  <div className="h-14 w-40 rounded-xl bg-red-950/40" />
                  <div className="h-14 w-36 rounded-xl border border-red-800/30 bg-red-950/10" />
                </>
              ) : isLoggedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    className="rounded-xl bg-[#b1121b] px-10 py-4 font-black text-white shadow-xl shadow-red-950/40 transition duration-300 hover:-translate-y-1 hover:bg-[#c91824]"
                  >
                    My Account
                  </Link>

                  <Link
                    href="/new-request"
                    className="rounded-xl border border-red-800/50 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-red-950/25"
                  >
                    New Request
                  </Link>

                  <Link
                    href="/dashboard/widget"
                    className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                  >
                    Vehicle Widget
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-xl border border-white/10 bg-white/10 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/15"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-xl border border-white/10 bg-white/10 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/15"
                  >
                    Login
                  </Link>

                  <Link
                    href="/register"
                    className="rounded-xl bg-[#b1121b] px-10 py-4 font-black text-white shadow-xl shadow-red-950/40 transition duration-300 hover:-translate-y-1 hover:bg-[#c91824]"
                  >
                    Register
                  </Link>

                  <Link
                    href="/new-request"
                    className="rounded-xl border border-red-800/50 px-10 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-red-950/25"
                  >
                    Upload File
                  </Link>

                  <Link
                    href="/widget"
                    className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                  >
                    Vehicle Widget €4.99
                  </Link>
                </>
              )}
            </div>
          </motion.div>

          <div className="hidden min-w-0 lg:block">
            <TechnicalHeroPreview />
          </div>
        </div>

        <PublicVehicleChecker />
      </section>

      <AnimatedSection className="bg-[#0b1226] py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] ${
                    workloadSnapshot.support === "Offline"
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full shadow-lg ${
                      workloadSnapshot.support === "Offline"
                        ? "bg-red-400 shadow-red-400/40"
                        : "bg-emerald-400 shadow-emerald-400/40"
                    }`}
                  />
                  Live Workload
                </div>
                <h2 className="mt-4 text-3xl font-black md:text-4xl">
                  Current file service availability
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
                  A quick operational snapshot for workshops before sending a
                  new file request.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {liveWorkloadItems.map((item) => {
                  const Icon = item.icon;
                  const toneClass =
                    item.tone === "emerald"
                      ? "border-emerald-700/30 bg-emerald-950/20 text-emerald-300"
                      : item.tone === "blue"
                      ? "border-blue-700/30 bg-blue-950/20 text-blue-300"
                      : "border-red-800/40 bg-red-950/25 text-red-300";

                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-black/30 p-4"
                    >
                      <div
                        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClass}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                        {item.title}
                      </div>
                      <div className="mt-2 text-2xl font-black text-white">
                        {item.value}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <WorkshopCommandDesk />

      <PerformanceTools />

      <AnimatedSection id="brands" className="bg-[#050505] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
                Supported Brands
              </div>
              <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
                Popular ECU and TCU platforms for modern workshops.
              </h2>
            </div>

            <p className="max-w-xl text-sm leading-7 text-zinc-400">
              MG AutoTech supports a broad range of European diesel and petrol
              vehicles, with vehicle-specific checks before every file service.
            </p>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.18 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {supportedBrands.map((brand) => (
              <motion.div
                variants={fadeUp}
                key={brand.name}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-1 hover:border-red-800/60 hover:bg-white/[0.07]"
              >
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/25 text-lg font-black text-red-200 shadow-lg shadow-red-950/20">
                    {brand.initials}
                  </div>

                  <BadgeCheck className="h-5 w-5 text-emerald-400 opacity-80 transition group-hover:opacity-100" />
                </div>

                <h3 className="text-xl font-black">{brand.name}</h3>
                <p className="mt-2 text-sm font-bold text-zinc-500">
                  {brand.note}
                </p>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-8 rounded-2xl border border-red-900/40 bg-red-950/20 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-black text-white">
                  Need another brand?
                </div>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Customers can select from the vehicle database or submit a
                  manual request with ECU, read method and file details.
                </p>
              </div>

              <Link
                href="/new-request"
                className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#c91824]"
              >
                Check Vehicle
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-[#eef1f4] py-20 text-[#111827]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-700">
                Why MG AutoTech?
              </div>
              <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
                A file service workflow built for serious workshop operations.
              </h2>
            </div>

            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className="inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/20 transition hover:-translate-y-0.5 hover:bg-[#c91824]"
            >
              {isLoggedIn ? "My Account" : "Create Account"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
          >
            {trustHighlights.map((item) => {
              const Icon = item.icon;

              return (
                <motion.div
                  variants={fadeUp}
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">
                    {item.text}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-[#050505] py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Calibration Knowledge Base
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              WinOLS based analysis with vehicle-specific file review.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
              MG AutoTech focuses on structured calibration review: ECU/TCU
              family, read method, selected service, fault notes and available
              map data are checked before the file workflow continues.
            </p>
            <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 p-5">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
                Professional approach
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                No exaggerated database numbers. Just a clean technical
                workflow built around WinOLS, DAMOS/A2L support and manual
                calibration checks where they matter.
              </p>
            </div>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {calibrationKnowledgeItems.map((item) => {
              const Icon = item.icon;

              return (
                <motion.div
                  variants={fadeUp}
                  key={item.title}
                  className={`rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 ${
                    item.highlight
                      ? "border-red-700 bg-[#b1121b] text-white shadow-2xl shadow-red-950/40"
                      : "border-white/10 bg-white/[0.04] hover:border-red-800/60 hover:bg-white/[0.07]"
                  }`}
                >
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
                      item.highlight
                        ? "bg-white/15 text-white"
                        : "border border-red-900/50 bg-red-950/30 text-red-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p
                    className={`mt-3 text-sm leading-6 ${
                      item.highlight ? "text-red-50" : "text-zinc-400"
                    }`}
                  >
                    {item.text}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </AnimatedSection>

      <BusinessMarginCalculator />

      <AnimatedSection id="workflow" className="bg-[#0b1226] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
                Workflow
              </div>
              <h2 className="mt-3 text-4xl font-black uppercase tracking-wide md:text-5xl">
                Get your files in 4 simple steps
              </h2>
              <p className="mt-3 text-zinc-400">
                A clean process for customers, workshops and partners.
              </p>
            </div>

            <Link
              href="/register"
              className="hidden rounded-xl bg-[#b1121b] p-4 text-white transition duration-300 hover:-translate-y-1 hover:bg-[#c91824] md:block"
            >
              <ArrowRight />
            </Link>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-5 md:grid-cols-4"
          >
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <motion.div
                  variants={fadeUp}
                  key={step.title}
                  className={`relative rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center transition duration-300 hover:-translate-y-2 hover:border-red-800/60 hover:bg-white/[0.07] ${
                    index === 1 || index === 3 ? "md:mt-10" : ""
                  }`}
                >
                  <Icon className="mx-auto mb-5 h-10 w-10 text-red-500" />
                  <h3 className="text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {step.text}
                  </p>
                  <div className="absolute -bottom-5 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-[#b1121b] text-lg font-black shadow-lg shadow-red-950/40">
                    {index + 1}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="services" className="bg-[#eef1f4] py-20 text-[#111827]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-700">
              Our Services
            </div>
            <h2 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">
              Professional ECU and TCU software solutions.
            </h2>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.18 }}
            className="grid gap-5 md:grid-cols-3"
          >
            {services.map((service) => (
              <motion.div
                variants={fadeUp}
                key={service.title}
                className="rounded-3xl bg-white p-6 shadow-xl shadow-black/5 transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                  <FileCode2 />
                </div>
                <h3 className="text-xl font-black">{service.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {service.text}
                </p>
                <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                  {service.credits}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-[#050505] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Workshop Use Cases
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Built around real file service operations.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              A cleaner workflow for workshops that need repeatable requests,
              clear technical details and secure file delivery.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {workshopUseCases.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-red-900/50 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-red-700 hover:bg-white/[0.06]"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/25 text-red-500">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {item.text}
                  </p>
                  <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-red-300">
                    {item.meta}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="prices" className="bg-[#0b1226] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-500">
              Credit Prices
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Flexible credit packages
            </h2>
            <p className="mt-3 text-zinc-400">
              Volume based pricing for customers, workshops and partners.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-red-700/60 bg-red-950/40 px-4 py-2 text-sm font-black text-red-100">
              Limited time -{CREDIT_PROMOTION_PERCENT}% on all credit packages
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {creditPackages.map((pack) => (
              <div
                key={pack.credits}
                className={`relative rounded-3xl border p-7 transition duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-red-950/30 ${
                  pack.popular
                    ? "border-red-700 bg-white/[0.08]"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                {pack.popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#b1121b] px-3 py-1 text-xs font-black">
                    Popular
                  </div>
                )}
                <div className="text-sm text-zinc-400">
                  {pack.credits} Credits
                </div>
                <div className="mt-4 text-sm font-bold text-zinc-500 line-through">
                  {formatEuro(pack.basePrice)}
                </div>
                <div className="mt-1 text-4xl font-black">
                  {formatEuro(pack.price)}
                </div>
                <div className="mt-3 text-sm text-zinc-400">
                  {formatEuro(pack.each)} / Credit
                </div>
                <Link
                  href="/dashboard/credits"
                  className="mt-7 block rounded-xl border border-red-800/70 px-5 py-3 text-center font-black text-white transition duration-300 hover:bg-red-950/30"
                >
                  Buy
                </Link>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="security" className="bg-[#050505] py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
              Security
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Secure customer portal with controlled file workflow.
            </h2>
            <p className="mt-5 leading-8 text-zinc-400">
              Customers can only access their own dashboard, credits and orders.
              Critical actions like credits, files and order status stay
              controlled by backend logic and database rules.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {securityItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition duration-300 hover:-translate-y-2 hover:border-red-800/60 hover:bg-white/[0.07]"
                >
                  <Icon className="mb-4 h-7 w-7 text-red-600" />
                  <div className="font-black">{item.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </AnimatedSection>

      <section id="contact" className="bg-[#b1121b] py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-4xl font-black">
              Start your next file request.
            </h2>
            <p className="mt-3 text-red-100">
              {isLoggedIn
                ? "Open your dashboard or create a new MG AutoTech file request."
                : "Register, login and create your first MG AutoTech file request."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-white px-7 py-4 font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100"
                >
                  My Account
                </Link>
                <Link
                  href="/new-request"
                  className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                >
                  New Request
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="rounded-xl bg-white px-7 py-4 font-black text-[#b1121b] transition duration-300 hover:-translate-y-1 hover:bg-zinc-100"
                >
                  Create Account
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
                >
                  Login
                </Link>
              </>
            )}
            <a
              href="mailto:info@mgautotech.de"
              className="rounded-xl border border-white/30 px-7 py-4 font-black text-white transition duration-300 hover:-translate-y-1 hover:bg-white/10"
            >
              <MessageCircle className="mr-2 inline h-5 w-5" />
              Contact
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <OnlineStatus />
    </main>
  );
}
