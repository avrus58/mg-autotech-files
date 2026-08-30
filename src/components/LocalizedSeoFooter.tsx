import Link from "next/link";
import { ArrowRight, Cpu, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import type { LocaleCode } from "@/lib/i18nConfig";
import {
  companyAddress,
  contactEmail,
  contactPhone,
  getServiceSeo,
  localizedPath,
  publicServiceSlugs,
  seoLabels,
} from "@/lib/seo";
import { seoUiCopy } from "@/lib/seo-ui";
import { getHowItWorksCopy } from "@/lib/howItWorksI18n";
import { getFileServiceCopy } from "@/lib/fileServiceI18n";

type LocalizedSeoFooterCopy = {
  brandLine: string;
  widget: string;
  country: string;
};

export const localizedSeoFooterCopy: Record<LocaleCode, LocalizedSeoFooterCopy> = {
  en: { brandLine: "ECU / TCU File Service", widget: "Vehicle Selector Widget", country: "Germany" },
  nl: { brandLine: "ECU-/TCU-file service", widget: "Widget voor voertuigselectie", country: "Duitsland" },
  de: { brandLine: "ECU-/TCU-Dateiservice", widget: "Fahrzeugauswahl-Widget", country: "Deutschland" },
  fr: { brandLine: "Service de fichiers ECU / TCU", widget: "Widget de sélection du véhicule", country: "Allemagne" },
  it: { brandLine: "Servizio file ECU / TCU", widget: "Widget di selezione veicolo", country: "Germania" },
  ru: { brandLine: "Файловый сервис ECU / TCU", widget: "Виджет выбора автомобиля", country: "Германия" },
  es: { brandLine: "Servicio de archivos ECU / TCU", widget: "Widget de selección de vehículo", country: "Alemania" },
  tr: { brandLine: "ECU / TCU Dosya Servisi", widget: "Araç Seçim Widget'ı", country: "Almanya" },
  pt: { brandLine: "Serviço de ficheiros ECU / TCU", widget: "Widget de seleção de veículo", country: "Alemanha" },
  zh: { brandLine: "ECU / TCU 文件服务", widget: "车辆选择组件", country: "德国" },
  pl: { brandLine: "Obsługa plików ECU / TCU", widget: "Widżet wyboru pojazdu", country: "Niemcy" },
  sq: { brandLine: "Shërbim skedarësh ECU / TCU", widget: "Moduli i përzgjedhjes së automjetit", country: "Gjermani" },
};

export function LocalizedSeoFooter({ locale }: { locale: LocaleCode }) {
  const labels = seoLabels[locale];
  const ui = seoUiCopy[locale];
  const howItWorks = getHowItWorksCopy(locale);
  const fileService = getFileServiceCopy(locale);
  const footerCopy = localizedSeoFooterCopy[locale];

  return (
    <footer className="border-t border-white/10 bg-[#07090d] text-white">
      <div className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr]">
          <div>
            <Link href={localizedPath(locale)} className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-red-800/50 bg-[#111]">
                <Cpu className="h-7 w-7 text-red-500" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xl font-black">MG <span className="text-red-500">AUTOTECH</span></span>
                <span className="block text-xs text-zinc-400">{footerCopy.brandLine}</span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-7 text-zinc-400">
              {ui.secureAccount}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">{labels.navServices}</h2>
            <div className="mt-5 space-y-3">
              {publicServiceSlugs.map((slug) => (
                <Link key={slug} href={localizedPath(locale, `/services/${slug}`)} className="block text-sm text-zinc-400 hover:text-white">
                  {getServiceSeo(slug, locale).name}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">{ui.platform}</h2>
            <div className="mt-5 space-y-3">
              <Link href={localizedPath(locale, "/file-service")} className="block text-sm text-zinc-400 hover:text-white">{fileService.nav.fileService}</Link>
              <Link href={localizedPath(locale, "/how-it-works")} className="block text-sm text-zinc-400 hover:text-white">{howItWorks.navLabel}</Link>
              <Link href="/tools" className="block text-sm text-zinc-400 hover:text-white">{ui.tools}</Link>
              <Link href="/widget" className="block text-sm text-zinc-400 hover:text-white">{footerCopy.widget}</Link>
              <Link href="/login" className="block text-sm text-zinc-400 hover:text-white">{labels.login}</Link>
              <Link href="/register" className="block text-sm text-zinc-400 hover:text-white">{labels.register}</Link>
              <Link href="/impressum" className="block text-sm text-zinc-400 hover:text-white">{ui.legal}</Link>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">{ui.contact}</h2>
            <address className="mt-5 space-y-4 text-sm not-italic text-zinc-400">
              <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-red-500" /><span>{companyAddress.streetAddress}<br />{companyAddress.postalCode} {companyAddress.addressLocality}, {footerCopy.country}</span></div>
              <div className="flex gap-3"><Phone className="h-5 w-5 shrink-0 text-red-500" /><a href={`tel:${contactPhone.replace(/\s/g, "")}`} className="hover:text-white">{contactPhone}</a></div>
              <div className="flex gap-3"><Mail className="h-5 w-5 shrink-0 text-red-500" /><a href={`mailto:${contactEmail}`} className="hover:text-white">{contactEmail}</a></div>
              <div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-red-500" /><span>{ui.secureAccount}</span></div>
            </address>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-5 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-500">© 2026 MG AutoTech. {ui.rights}</p>
          <Link href="/new-request" className="inline-flex items-center justify-center rounded-lg bg-[#b1121b] px-5 py-3 text-sm font-black hover:bg-[#c91824]">
            {labels.startRequest}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
