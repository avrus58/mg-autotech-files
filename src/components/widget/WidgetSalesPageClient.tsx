"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Braces, Check, Code2, CreditCard, DatabaseZap, Globe2, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { PublicVehicleSelector } from "@/components/widget/PublicVehicleSelector";
import { getStableSession } from "@/lib/authGuards";
import { widgetSiteT, translateWidgetSiteExact } from "@/lib/i18n/widget-site-translations";
import { widgetT } from "@/lib/i18n/widget-translations";
import { intlLocaleByCode } from "@/lib/i18nConfig";
import { getLocalizedPublicHref } from "@/lib/i18nRoutes";
import { useActiveLocale } from "@/lib/useActiveLocale";
import { widgetLanguageCodes, type WidgetLanguage, type WidgetSettings, type WidgetTheme } from "@/lib/widget/types";

const names: Record<WidgetLanguage, string> = { de: "Deutsch", en: "English", tr: "Türkçe", fr: "Français", es: "Español", it: "Italiano", nl: "Nederlands", pl: "Polski", ro: "Română", pt: "Português", ru: "Русский", ar: "العربية" };

export function WidgetSalesPageClient({ initialSettings, databaseReady, initialLanguage }: { initialSettings: WidgetSettings; databaseReady: boolean; initialLanguage: WidgetLanguage }) {
  const router = useRouter();
  const siteLocale = useActiveLocale();
  const [language, setLanguage] = useState<WidgetLanguage>(initialLanguage);
  const [theme, setTheme] = useState<WidgetTheme>("dark");
  const [mainColor, setMainColor] = useState("#c1121f");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const priceLabel = useMemo(() => {
    const currency = (initialSettings.currency || "EUR").toUpperCase();
    try {
      return new Intl.NumberFormat(intlLocaleByCode[siteLocale], {
        style: "currency",
        currency,
      }).format(Number(initialSettings.monthly_price));
    } catch {
      return `${Number(initialSettings.monthly_price).toFixed(2)} ${currency}`;
    }
  }, [initialSettings.currency, initialSettings.monthly_price, siteLocale]);

  async function checkout(event: React.FormEvent) {
    event.preventDefault(); setSubmitting(true); setMessage("");
    const session = (await getStableSession()).session;
    if (!session) {
      setSubmitting(false);
      setMessage(widgetSiteT(siteLocale, "verifiedBillingEmailRequired"));
      return;
    }
    const response = await fetch("/api/stripe/widget-checkout", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ companyName, email, websiteDomain: domain, preferredLanguage: language }),
    });
    const payload = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok || !payload.url) {
      setMessage(translateWidgetSiteExact(siteLocale, payload.error, "checkoutFailed"));
      return;
    }
    router.push(payload.url);
  }

  const disabledReason = !initialSettings.widget_product_enabled || !initialSettings.public_signup_enabled
    ? widgetSiteT(siteLocale, "subscriptionsUnavailable")
    : !initialSettings.checkout_enabled
      ? widgetSiteT(siteLocale, "checkoutUnavailable")
      : !databaseReady
        ? widgetSiteT(siteLocale, "subscriptionsPreparing")
        : "";

  const featureRows = [
    { icon: Globe2, title: widgetSiteT(siteLocale, "oneWebsiteDomain"), text: widgetSiteT(siteLocale, "strictDomainAccess") },
    { icon: DatabaseZap, title: widgetSiteT(siteLocale, "automaticUpdates"), text: widgetSiteT(siteLocale, "noDatabaseMaintenance") },
    { icon: Code2, title: widgetSiteT(siteLocale, "scriptIframe"), text: widgetSiteT(siteLocale, "noNpmPackages") },
    { icon: BadgeCheck, title: widgetSiteT(siteLocale, "mgHosted"), text: widgetSiteT(siteLocale, "controlledAccessLogs") },
  ];
  const operationalRows = [
    { icon: CreditCard, text: widgetSiteT(siteLocale, "secureStripePayments") },
    { icon: ShieldCheck, text: widgetSiteT(siteLocale, "hostedEu") },
    { icon: BadgeCheck, text: widgetSiteT(siteLocale, "automaticSubscriptionControl") },
    { icon: LockKeyhole, text: widgetSiteT(siteLocale, "domainLockedAccess") },
    { icon: DatabaseZap, text: widgetSiteT(siteLocale, "noDatabaseExport") },
  ];
  const includedRows = [
    widgetSiteT(siteLocale, "customerLanguages"),
    widgetSiteT(siteLocale, "automaticVehicleUpdates"),
    widgetSiteT(siteLocale, "liveCodePreview"),
    widgetSiteT(siteLocale, "scriptIframeFallback"),
    widgetSiteT(siteLocale, "domainValidationLogs"),
    widgetSiteT(siteLocale, "stripeBillingPortal"),
    widgetSiteT(siteLocale, "cancelAnytime"),
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href={getLocalizedPublicHref("/", siteLocale)} className="flex items-center gap-3 font-black">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/30"><Braces className="h-5 w-5 text-red-500" /></span>
            <span>MG <span className="text-red-500">AUTOTECH</span> <span className="hidden text-zinc-500 sm:inline">{widgetSiteT(siteLocale, "vehicleWidget")}</span></span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-bold">{widgetSiteT(siteLocale, "login")}</Link>
            <Link href="/dashboard/widget" className="hidden rounded-lg bg-[#b1121b] px-4 py-2.5 text-sm font-bold sm:block">{widgetSiteT(siteLocale, "customerDashboard")}</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-white/10 bg-[linear-gradient(135deg,#050505_15%,#130709_62%,#050505)]">
        <div className="mx-auto grid min-h-[640px] max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-red-300"><LockKeyhole className="h-4 w-4" />{widgetSiteT(siteLocale, "hostedDataEyebrow")}</div>
            <h1 className="max-w-4xl text-5xl font-black leading-[1.02] sm:text-6xl">{widgetSiteT(siteLocale, "salesTitle")}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">{widgetSiteT(siteLocale, "salesLead")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#subscribe" className="inline-flex items-center rounded-lg bg-[#c1121f] px-6 py-4 text-sm font-black shadow-xl shadow-red-950/40">{widgetSiteT(siteLocale, "startMonthly", { price: priceLabel })}<ArrowRight className="ml-2 h-4 w-4" /></a>
              {initialSettings.demo_enabled && <a href="#demo" className="rounded-lg border border-white/15 px-6 py-4 text-sm font-black">{widgetSiteT(siteLocale, "tryDemo")}</a>}
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-zinc-400">
              {[widgetSiteT(siteLocale, "customerLanguages"), widgetSiteT(siteLocale, "scriptIframeFallback"), widgetSiteT(siteLocale, "noCoding")].map((item) => <span key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />{item}</span>)}
            </div>
          </div>
          <div className="border-l border-red-900/40 pl-0 lg:pl-8">
            <div className="mb-4 flex items-end justify-between">
              <div><div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">MG AutoTech SaaS</div><div className="mt-2 text-3xl font-black">{priceLabel}<span className="text-base text-zinc-500"> / {widgetSiteT(siteLocale, "perMonth")}</span></div></div>
              <div className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-black text-emerald-300">{widgetSiteT(siteLocale, "hosted")}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">{featureRows.map(({ icon: Icon, title, text }) => <div key={title} className="border-t border-white/10 py-4"><Icon className="mb-3 h-5 w-5 text-red-500" /><div className="font-black">{title}</div><div className="mt-1 text-sm text-zinc-500">{text}</div></div>)}</div>
          </div>
        </div>
      </section>

      {initialSettings.demo_enabled && (
        <section id="demo" className="mx-auto max-w-7xl px-4 py-20">
          <div className="mb-8 max-w-3xl"><div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">{widgetSiteT(siteLocale, "interactiveDemo")}</div><h2 className="mt-3 text-4xl font-black">{widgetSiteT(siteLocale, "seeBeforeSubscribe")}</h2><p className="mt-3 leading-7 text-zinc-400">{widgetSiteT(siteLocale, "demoDescription")}</p></div>
          <div className="grid gap-8 lg:grid-cols-[330px_1fr]">
            <div className="border-y border-white/10 py-6">
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{widgetSiteT(siteLocale, "language")}<select value={language} onChange={(event) => setLanguage(event.target.value as WidgetLanguage)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm font-bold text-white">{widgetLanguageCodes.map((code) => <option key={code} value={code}>{names[code]}</option>)}</select></label>
              <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{widgetSiteT(siteLocale, "theme")}<select value={theme} onChange={(event) => setTheme(event.target.value as WidgetTheme)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm font-bold text-white"><option value="dark">{widgetSiteT(siteLocale, "dark")}</option><option value="light">{widgetSiteT(siteLocale, "light")}</option><option value="auto">{widgetSiteT(siteLocale, "auto")}</option></select></label>
              <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{widgetSiteT(siteLocale, "mainColour")}<input type="color" value={mainColor} onChange={(event) => setMainColor(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#111] p-2" /></label>
            </div>
            <div className="min-w-0"><PublicVehicleSelector demo config={{ widget_title: widgetT(language, "selectVehicle"), button_text: widgetT(language, "showTuningOptions"), main_color: mainColor, button_text_color: "#ffffff", difference_color: "#20c997", theme_mode: theme, show_branding: true, language }} /></div>
          </div>
        </section>
      )}

      <section className="border-y border-white/10 bg-[#0a0a0c]">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="mb-10 text-center"><div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">{widgetSiteT(siteLocale, "controlledB2b")}</div><h2 className="mt-3 text-3xl font-black">{widgetSiteT(siteLocale, "operationalControl")}</h2></div>
          <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-5">{operationalRows.map(({ icon: Icon, text }) => <div key={text} className="bg-[#0a0a0c] p-6 text-center"><Icon className="mx-auto h-6 w-6 text-red-500" /><div className="mt-3 text-sm font-black">{text}</div></div>)}</div>
        </div>
      </section>

      <section id="subscribe" className="mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-[.8fr_1.2fr]">
        <div><div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">{widgetSiteT(siteLocale, "includedStarter")}</div><h2 className="mt-3 text-4xl font-black">{widgetSiteT(siteLocale, "oneDomainControl", { price: priceLabel })}</h2><div className="mt-7 space-y-4">{includedRows.map((item) => <div key={item} className="flex items-center gap-3 text-zinc-300"><Check className="h-5 w-5 text-emerald-400" />{item}</div>)}</div></div>
        <form onSubmit={checkout} className="border-l border-white/10 pl-0 lg:pl-10">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={widgetSiteT(siteLocale, "companyName")} value={companyName} onChange={setCompanyName} placeholder="Muster Tuning GmbH" />
            <Field label={widgetSiteT(siteLocale, "emailAddress")} value={email} onChange={setEmail} placeholder="office@example.com" type="email" />
            <Field label={widgetSiteT(siteLocale, "websiteDomain")} value={domain} onChange={setDomain} placeholder="example.com" />
            <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{widgetSiteT(siteLocale, "preferredLanguage")}</span><select value={language} onChange={(event) => setLanguage(event.target.value as WidgetLanguage)} className="h-14 w-full rounded-lg border border-white/10 bg-[#0c0c0e] px-4 text-sm font-bold">{widgetLanguageCodes.map((code) => <option key={code} value={code}>{names[code]}</option>)}</select></label>
          </div>
          {disabledReason && <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200"><X className="mt-0.5 h-4 w-4 shrink-0" />{disabledReason}</div>}
          {message && <div className="mt-5 rounded-lg border border-red-800/50 bg-red-950/25 p-4 text-sm text-red-200">{message}</div>}
          <button disabled={Boolean(disabledReason) || submitting} className="mt-5 flex h-14 w-full items-center justify-center rounded-lg bg-[#c1121f] px-6 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45">{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{widgetSiteT(siteLocale, "startSubscription")}<ArrowRight className="ml-2 h-4 w-4" /></>}</button>
          <p className="mt-3 text-xs leading-5 text-zinc-600">{widgetSiteT(siteLocale, "softwareTerms")}</p>
        </form>
      </section>
      <footer className="border-t border-white/10 px-4 py-8 text-center text-sm text-zinc-600">{widgetSiteT(siteLocale, "vehicleSelectorFooter")} · <Link href="/agb" className="hover:text-white">{widgetSiteT(siteLocale, "terms")}</Link> · <Link href={siteLocale === "de" ? "/datenschutz" : "/privacy"} className="hover:text-white">{widgetSiteT(siteLocale, "privacy")}</Link></footer>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</span><input translate="no" data-no-translate required type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-14 w-full rounded-lg border border-white/10 bg-[#0c0c0e] px-4 text-sm font-bold outline-none focus:border-red-700" /></label>; }
