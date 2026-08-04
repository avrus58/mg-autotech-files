import type { LocaleCode } from "@/lib/i18nConfig";

type HomepageHeroCopy = {
  customTitle: string;
  tuningFiles: string;
  securePortal: string;
  fastHandling: string;
  workshopReady: string;
};

export const homepageHeroCopy: Record<LocaleCode, HomepageHeroCopy> = {
  en: {
    customTitle: "Custom ECU & TCU",
    tuningFiles: "Tuning Files",
    securePortal: "Secure Portal",
    fastHandling: "Fast Handling",
    workshopReady: "Workshop Ready",
  },
  nl: {
    customTitle: "ECU & TCU op maat",
    tuningFiles: "Tuningbestanden",
    securePortal: "Veilig portaal",
    fastHandling: "Snelle verwerking",
    workshopReady: "Klaar voor werkplaatsen",
  },
  de: {
    customTitle: "Individuelle ECU & TCU",
    tuningFiles: "Tuning-Dateien",
    securePortal: "Sicheres Portal",
    fastHandling: "Schnelle Bearbeitung",
    workshopReady: "Werkstattbereit",
  },
  fr: {
    customTitle: "ECU & TCU sur mesure",
    tuningFiles: "Fichiers de calibration",
    securePortal: "Portail sécurisé",
    fastHandling: "Traitement rapide",
    workshopReady: "Prêt pour l'atelier",
  },
  it: {
    customTitle: "ECU & TCU su misura",
    tuningFiles: "File di calibrazione",
    securePortal: "Portale sicuro",
    fastHandling: "Elaborazione rapida",
    workshopReady: "Pronto per l'officina",
  },
  ru: {
    customTitle: "Индивидуальные ECU и TCU",
    tuningFiles: "Файлы калибровки",
    securePortal: "Защищенный портал",
    fastHandling: "Быстрая обработка",
    workshopReady: "Для автосервисов",
  },
  es: {
    customTitle: "ECU y TCU a medida",
    tuningFiles: "Archivos de calibración",
    securePortal: "Portal seguro",
    fastHandling: "Procesamiento rápido",
    workshopReady: "Listo para talleres",
  },
  tr: {
    customTitle: "Özel ECU & TCU",
    tuningFiles: "Tuning dosyaları",
    securePortal: "Güvenli portal",
    fastHandling: "Hızlı işlem",
    workshopReady: "Servise hazır",
  },
  pt: {
    customTitle: "ECU & TCU personalizados",
    tuningFiles: "Ficheiros de calibração",
    securePortal: "Portal seguro",
    fastHandling: "Processamento rápido",
    workshopReady: "Pronto para oficinas",
  },
  zh: {
    customTitle: "定制 ECU 与 TCU",
    tuningFiles: "调校文件",
    securePortal: "安全客户门户",
    fastHandling: "快速处理",
    workshopReady: "专为维修厂",
  },
  pl: {
    customTitle: "Indywidualne ECU i TCU",
    tuningFiles: "Pliki kalibracyjne",
    securePortal: "Bezpieczny portal",
    fastHandling: "Szybka obsługa",
    workshopReady: "Gotowe dla warsztatów",
  },
  sq: {
    customTitle: "ECU & TCU të personalizuara",
    tuningFiles: "Skedarë kalibrimi",
    securePortal: "Portal i sigurt",
    fastHandling: "Përpunim i shpejtë",
    workshopReady: "Gati për servise",
  },
};
