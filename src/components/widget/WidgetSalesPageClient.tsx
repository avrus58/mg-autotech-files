"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Braces, Check, Code2, CreditCard, DatabaseZap, Globe2, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { PublicVehicleSelector } from "@/components/widget/PublicVehicleSelector";
import { getStableSession } from "@/lib/authGuards";
import { widgetT } from "@/lib/i18n/widget-translations";
import { widgetLanguageCodes, type WidgetLanguage, type WidgetSettings, type WidgetTheme } from "@/lib/widget/types";

const names: Record<WidgetLanguage, string> = { de: "Deutsch", en: "English", tr: "Türkçe", fr: "Français", es: "Español", it: "Italiano", nl: "Nederlands", pl: "Polski", ro: "Română", pt: "Português", ru: "Русский", ar: "العربية" };

export function WidgetSalesPageClient({ initialSettings, databaseReady, initialLanguage }: { initialSettings: WidgetSettings; databaseReady: boolean; initialLanguage: WidgetLanguage }) {
  const router = useRouter();
  const [language, setLanguage] = useState<WidgetLanguage>(initialLanguage);
  const [theme, setTheme] = useState<WidgetTheme>("dark");
  const [mainColor, setMainColor] = useState("#c1121f");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const german = language === "de";
  const priceLabel = Number(initialSettings.monthly_price).toFixed(2);
  const copy = useMemo(() => german ? {
    nav: "MG AutoTech Widget", login: "Anmelden", dashboard: "Kundenportal",
    eyebrow: "Gehostete Fahrzeugdaten für Ihre Website", title: "Professionelle Fahrzeugauswahl für Ihre Website",
    lead: "Fügen Sie Ihrer Tuning-, Werkstatt- oder Automotive-Website eine gepflegte Fahrzeugdatenbank hinzu. Ein Code, eine geschützte Domain, automatische Updates.",
    start: `Jetzt für €${priceLabel} / Monat starten`, demo: "Live-Demo testen", included: "Im Starter-Paket enthalten",
    company: "Firmenname", email: "E-Mail-Adresse", domain: "Website-Domain", preferred: "Bevorzugte Sprache",
    subscribe: "Abonnement starten", noCode: "Keine Programmierung erforderlich", trust: "Entwickelt für kontrollierte B2B-Integration",
    how: "In drei Schritten online", configure: "Design konfigurieren", embed: "Code einfügen", maintain: "Automatisch aktuell",
  } : {
    nav: "MG AutoTech Widget", login: "Login", dashboard: "Customer dashboard",
    eyebrow: "Hosted vehicle data for your website", title: "Professional Vehicle Selector for Your Website",
    lead: "Add a maintained vehicle database to your tuning, workshop or automotive website. One code, one protected domain and automatic updates.",
    start: `Start for €${priceLabel} / month`, demo: "Try the live demo", included: "Included in Starter",
    company: "Company name", email: "Email address", domain: "Website domain", preferred: "Preferred language",
    subscribe: "Start subscription", noCode: "No coding required", trust: "Built for controlled B2B integration",
    how: "Live in three steps", configure: "Configure the design", embed: "Paste the code", maintain: "Stay automatically updated",
  }, [german, priceLabel]);

  async function checkout(event: React.FormEvent) {
    event.preventDefault(); setSubmitting(true); setMessage("");
    const session = (await getStableSession()).session;
    if (!session) {
      setSubmitting(false);
      setMessage("Please sign in with your verified billing e-mail before starting a subscription.");
      return;
    }
    const response = await fetch("/api/stripe/widget-checkout", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ companyName, email, websiteDomain: domain, preferredLanguage: language }),
    });
    const payload = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok || !payload.url) { setMessage(payload.error || "Checkout could not be started."); return; }
    router.push(payload.url);
  }

  const disabledReason = !initialSettings.widget_product_enabled || !initialSettings.public_signup_enabled
    ? "New widget subscriptions are currently unavailable."
    : !initialSettings.checkout_enabled ? "Online checkout is currently unavailable. Please contact MG AutoTech." : !databaseReady ? "Widget subscriptions are being prepared." : "";

  return <main data-no-translate className="min-h-screen bg-[#050505] text-white">
    <header className="border-b border-white/10 bg-black/90"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4"><Link href="/" className="flex items-center gap-3 font-black"><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/30"><Braces className="h-5 w-5 text-red-500" /></span><span>MG <span className="text-red-500">AUTOTECH</span> <span className="hidden text-zinc-500 sm:inline">VEHICLE WIDGET</span></span></Link><nav className="flex items-center gap-2"><Link href="/login" className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-bold">{copy.login}</Link><Link href="/dashboard/widget" className="hidden rounded-lg bg-[#b1121b] px-4 py-2.5 text-sm font-bold sm:block">{copy.dashboard}</Link></nav></div></header>

    <section className="border-b border-white/10 bg-[linear-gradient(135deg,#050505_15%,#130709_62%,#050505)]"><div className="mx-auto grid min-h-[640px] max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_.95fr]"><div><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/25 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-red-300"><LockKeyhole className="h-4 w-4" />{copy.eyebrow}</div><h1 className="max-w-4xl text-5xl font-black leading-[1.02] sm:text-6xl">{copy.title}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">{copy.lead}</p><div className="mt-8 flex flex-wrap items-center gap-3"><a href="#subscribe" className="inline-flex items-center rounded-lg bg-[#c1121f] px-6 py-4 text-sm font-black shadow-xl shadow-red-950/40">{copy.start}<ArrowRight className="ml-2 h-4 w-4" /></a>{initialSettings.demo_enabled && <a href="#demo" className="rounded-lg border border-white/15 px-6 py-4 text-sm font-black">{copy.demo}</a>}</div><div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-zinc-400">{[widgetT(language, "languagesIncluded"), widgetT(language, "easyIntegration"), copy.noCode].map((item) => <span key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />{item}</span>)}</div></div>
      <div className="border-l border-red-900/40 pl-0 lg:pl-8"><div className="mb-4 flex items-end justify-between"><div><div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">MG AutoTech SaaS</div><div className="mt-2 text-3xl font-black">€{priceLabel}<span className="text-base text-zinc-500"> / month</span></div></div><div className="rounded-full border border-emerald-700/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-black text-emerald-300">Hosted</div></div><div className="grid gap-3 sm:grid-cols-2">{[{ icon: Globe2, title: "1 website / domain", text: "Strict domain-locked access" },{ icon: DatabaseZap, title: "Automatic updates", text: "No database maintenance" },{ icon: Code2, title: "Script + iframe", text: "Works without npm packages" },{ icon: BadgeCheck, title: "MG AutoTech hosted", text: "Controlled access and logs" }].map(({icon: Icon,title,text}) => <div key={title} className="border-t border-white/10 py-4"><Icon className="mb-3 h-5 w-5 text-red-500" /><div className="font-black">{title}</div><div className="mt-1 text-sm text-zinc-500">{text}</div></div>)}</div></div></div></section>

    {initialSettings.demo_enabled && <section id="demo" className="mx-auto max-w-7xl px-4 py-20"><div className="mb-8 max-w-3xl"><div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Interactive demo</div><h2 className="mt-3 text-4xl font-black">See it before you subscribe.</h2><p className="mt-3 leading-7 text-zinc-400">Change the language, colour and display mode. Your customer dashboard provides the same controls with a production embed code.</p></div><div className="grid gap-8 lg:grid-cols-[330px_1fr]"><div className="border-y border-white/10 py-6"><label className="block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Language<select value={language} onChange={(e) => setLanguage(e.target.value as WidgetLanguage)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm font-bold text-white">{widgetLanguageCodes.map((code) => <option key={code} value={code}>{names[code]}</option>)}</select></label><label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Theme<select value={theme} onChange={(e) => setTheme(e.target.value as WidgetTheme)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm font-bold text-white"><option value="dark">Dark</option><option value="light">Light</option><option value="auto">Auto</option></select></label><label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Main colour<input type="color" value={mainColor} onChange={(e) => setMainColor(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#111] p-2" /></label></div><div className="min-w-0"><PublicVehicleSelector demo config={{ widget_title: widgetT(language, "selectVehicle"), button_text: widgetT(language, "showTuningOptions"), main_color: mainColor, button_text_color: "#ffffff", difference_color: "#20c997", theme_mode: theme, show_branding: true, language }} /></div></div></section>}

    <section className="border-y border-white/10 bg-[#0a0a0c]"><div className="mx-auto max-w-7xl px-4 py-16"><div className="mb-10 text-center"><div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">{copy.trust}</div><h2 className="mt-3 text-3xl font-black">Operational control is built in.</h2></div><div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-5">{[{icon:CreditCard,t:"Secure payments by Stripe"},{icon:ShieldCheck,t:"Hosted in the EU"},{icon:BadgeCheck,t:"Automatic subscription control"},{icon:LockKeyhole,t:"Domain-locked access"},{icon:DatabaseZap,t:"No database export"}].map(({icon:Icon,t}) => <div key={t} className="bg-[#0a0a0c] p-6 text-center"><Icon className="mx-auto h-6 w-6 text-red-500" /><div className="mt-3 text-sm font-black">{t}</div></div>)}</div></div></section>

    <section id="subscribe" className="mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-[.8fr_1.2fr]"><div><div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">{copy.included}</div><h2 className="mt-3 text-4xl font-black">One domain. Full control. €{priceLabel} / month.</h2><div className="mt-7 space-y-4">{["12 customer-facing languages", "Automatic vehicle database updates", "Live code generator and preview", "Script embed and iframe fallback", "Domain validation and access logs", "Stripe billing portal", widgetT(language, "cancelAnytime")].map((item) => <div key={item} className="flex items-center gap-3 text-zinc-300"><Check className="h-5 w-5 text-emerald-400" />{item}</div>)}</div></div><form onSubmit={checkout} className="border-l border-white/10 pl-0 lg:pl-10"><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.company} value={companyName} onChange={setCompanyName} placeholder="Muster Tuning GmbH" /><Field label={copy.email} value={email} onChange={setEmail} placeholder="office@example.com" type="email" /><Field label={copy.domain} value={domain} onChange={setDomain} placeholder="example.com" /><label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{copy.preferred}</span><select value={language} onChange={(e) => setLanguage(e.target.value as WidgetLanguage)} className="h-14 w-full rounded-lg border border-white/10 bg-[#0c0c0e] px-4 text-sm font-bold">{widgetLanguageCodes.map((code) => <option key={code} value={code}>{names[code]}</option>)}</select></label></div>{disabledReason && <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200"><X className="mt-0.5 h-4 w-4 shrink-0" />{disabledReason}</div>}{message && <div className="mt-5 rounded-lg border border-red-800/50 bg-red-950/25 p-4 text-sm text-red-200">{message}</div>}<button disabled={Boolean(disabledReason) || submitting} className="mt-5 flex h-14 w-full items-center justify-center rounded-lg bg-[#c1121f] px-6 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45">{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{copy.subscribe}<ArrowRight className="ml-2 h-4 w-4" /></>}</button><p className="mt-3 text-xs leading-5 text-zinc-600">B2B hosted software subscription. By continuing, you accept the MG AutoTech terms and privacy policy.</p></form></section>
    <footer className="border-t border-white/10 px-4 py-8 text-center text-sm text-zinc-600">MG AutoTech Vehicle Selector Widget · <Link href="/agb" className="hover:text-white">Terms</Link> · <Link href="/privacy" className="hover:text-white">Privacy</Link></footer>
  </main>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</span><input required type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-14 w-full rounded-lg border border-white/10 bg-[#0c0c0e] px-4 text-sm font-bold outline-none focus:border-red-700" /></label>; }
