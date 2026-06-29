"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Braces, Check, ChevronDown, CircleHelp, Code2, CreditCard, Globe2, KeyRound, Loader2, LockKeyhole, Mail, MessageCircle, Save, Settings2 } from "lucide-react";
import { EmbedCodeBox } from "@/components/widget/EmbedCodeBox";
import { SubscriptionNotice } from "@/components/widget/SubscriptionNotice";
import { VehicleLookupPreview } from "@/components/widget/VehicleLookupPreview";
import { widgetT } from "@/lib/i18n/widget-translations";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import { widgetLanguageCodes, type WidgetClient, type WidgetLanguage, type WidgetSettings } from "@/lib/widget/types";

type Payload = { client: WidgetClient | null; publicKey?: string | null; settings: WidgetSettings; domainRequests?: Array<{ id: string; requested_domain: string; status: string; created_at: string }> };
const languageNames: Record<WidgetLanguage, string> = { de: "Deutsch", en: "English", tr: "Türkçe", fr: "Français", es: "Español", it: "Italiano", nl: "Nederlands", pl: "Polski", ro: "Română", pt: "Português", ru: "Русский", ar: "العربية" };
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de").replace(/\/$/, "");

export default function CustomerWidgetPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [client, setClient] = useState<WidgetClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [domainRequest, setDomainRequest] = useState("");

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("Unauthorized");
    return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` } });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) { window.location.href = "/login"; return; }
    if (await signOutIfEmailUnverified(user)) { window.location.href = "/login?verify_email=1"; return; }
    try {
      const response = await authFetch("/api/widget/client", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Widget account could not be loaded.");
      setPayload(data); setClient(data.client);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Widget account could not be loaded."); }
    finally { setLoading(false); }
  }, [authFetch]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const language = client?.default_language ?? "en";
  const active = client?.status === "active" && client.widget_enabled && (!client.stripe_subscription_status || ["active", "trialing"].includes(client.stripe_subscription_status));
  const publicKey = payload?.publicKey ?? "PUBLIC_KEY_PENDING";
  const scriptCode = `<div id="mga-vehicle-lookup"></div>\n<script\n  src="${siteUrl}/widget/vehicle-lookup.js"\n  data-client-key="${publicKey}"\n  data-target="#mga-vehicle-lookup">\n</script>`;
  const iframeCode = `<iframe\n  src="${siteUrl}/embed/vehicle-selector?key=${publicKey}"\n  style="width:100%;height:700px;border:0;border-radius:12px;"\n  loading="lazy">\n</iframe>`;
  const advancedCode = `<script>\nwindow.addEventListener("message", function(event) {\n  if (!event.data || event.data.dataType !== "mga-vehicle-data") {\n    return;\n  }\n  var vehicleName = event.data.vehicleName;\n  var make = event.data.make;\n  var model = event.data.model;\n  var year = event.data.year;\n  var engine = event.data.engine;\n  var ecu = event.data.ecu;\n  var powerHp = event.data.powerHp;\n  console.log("Selected vehicle:", vehicleName);\n  var input = document.querySelector('input[name="vehicle"]');\n  if (input) {\n    input.value = vehicleName;\n  }\n});\n</script>`;

  function update<K extends keyof WidgetClient>(key: K, value: WidgetClient[K]) { setClient((current) => current ? { ...current, [key]: value } : current); }
  function toggleLanguage(code: WidgetLanguage) {
    if (!client?.can_edit_language) return;
    const next = client.allowed_languages.includes(code) ? client.allowed_languages.filter((item) => item !== code) : [...client.allowed_languages, code];
    if (next.length) update("allowed_languages", next);
  }
  async function save() {
    if (!client) return; setSaving(true); setMessage("");
    const response = await authFetch("/api/widget/client", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(client) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(data.error || "Settings could not be saved."); return; }
    setClient(data.client); setMessage("Widget settings saved.");
  }
  async function manageBilling() {
    setMessage(""); const response = await authFetch("/api/stripe/widget-customer-portal", { method: "POST" }); const data = await response.json();
    if (!response.ok || !data.url) { setMessage(data.error || "Billing portal could not be opened."); return; } window.location.href = data.url;
  }
  async function requestDomainChange() {
    if (!domainRequest.trim()) return; const response = await authFetch("/api/widget/domain-change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: domainRequest }) }); const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Request could not be sent."); return; } setDomainRequest(""); setMessage("Domain change request sent for admin review."); void load();
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="mr-3 h-6 w-6 animate-spin text-red-500" />Loading widget workspace...</main>;
  if (!client || !payload) return <main className="min-h-screen bg-[#050505] px-4 py-20 text-white"><div className="mx-auto max-w-2xl border-y border-white/10 py-10 text-center"><Braces className="mx-auto h-10 w-10 text-red-500" /><h1 className="mt-5 text-3xl font-black">Vehicle Selector Widget</h1><p className="mt-3 text-zinc-400">{message || "No widget subscription is linked to this account."}</p><div className="mt-7 flex justify-center gap-3"><Link href="/widget" className="rounded-lg bg-[#b1121b] px-5 py-3 text-sm font-black">View plans</Link><Link href="/dashboard" className="rounded-lg border border-white/10 px-5 py-3 text-sm font-black">Dashboard</Link></div></div></main>;

  return <main className="min-h-screen bg-[#050505] text-white"><header className="border-b border-white/10 bg-black/90"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/30"><Braces className="h-5 w-5 text-red-500" /></span><div className="min-w-0"><div className="truncate text-xs font-black uppercase tracking-[0.16em] text-red-500">MG AutoTech SaaS</div><h1 className="truncate text-lg font-black sm:text-2xl">{widgetT(language, "vehicleLookupCodeGenerator")}</h1></div></div><Link href="/dashboard" className="rounded-lg border border-white/10 px-3 py-2.5 text-sm font-black"><ArrowLeft className="mr-2 inline h-4 w-4" />Dashboard</Link></div></header>
  <section className="mx-auto max-w-[1500px] px-4 py-8">{!active && <SubscriptionNotice onManage={manageBilling} />}{message && <div className="mb-6 border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-100">{message}</div>}
    <div className="mb-7 flex flex-col gap-4 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-400"><LockKeyhole className="h-4 w-4" />{widgetT(language, "domainLocked")} · {client.allowed_domain}</div><h2 className="mt-3 text-3xl font-black">Configure, preview and publish.</h2><p className="mt-2 text-sm text-zinc-500">Plan: {client.plan} · Status: {client.status} · {client.monthly_usage_limit.toLocaleString()} loads/month</p></div><button onClick={save} disabled={saving} className="flex h-12 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save settings</>}</button></div>
    <div className="grid gap-8 xl:grid-cols-[430px_1fr]"><aside className="space-y-8"><SettingsCard title={widgetT(language, "widgetSettings")} icon={<Settings2 />}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><Select label={widgetT(language, "themeMode")} value={client.theme_mode} disabled={!client.can_edit_colours} onChange={(value) => update("theme_mode", value as WidgetClient["theme_mode"])} options={[["light","Light"],["dark","Dark"],["auto","Auto"]]} /><Input label="Widget title" value={client.widget_title} disabled={!client.can_edit_colours} onChange={(value) => update("widget_title", value)} /><Input label="Button text" value={client.button_text} disabled={!client.can_edit_colours} onChange={(value) => update("button_text", value)} /><Colour label={widgetT(language, "mainColour")} value={client.main_color} disabled={!client.can_edit_colours} onChange={(value) => update("main_color", value)} /><Colour label={widgetT(language, "buttonTextColour")} value={client.button_text_color} disabled={!client.can_edit_colours} onChange={(value) => update("button_text_color", value)} /><Colour label={widgetT(language, "differenceColour")} value={client.difference_color} disabled={!client.can_edit_colours} onChange={(value) => update("difference_color", value)} /></div></SettingsCard>
      <SettingsCard title={widgetT(language, "otherSettings")} icon={<Globe2 />}><Select label={widgetT(language, "language")} value={client.default_language} disabled={!client.can_edit_language} onChange={(value) => update("default_language", value as WidgetLanguage)} options={widgetLanguageCodes.filter((code) => payload.settings.enabled_languages.includes(code)).map((code) => [code, languageNames[code]])} /><div className="mt-4"><div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{widgetT(language, "enabledLanguages")}</div><div className="flex flex-wrap gap-2">{widgetLanguageCodes.filter((code) => payload.settings.enabled_languages.includes(code)).map((code) => <button type="button" key={code} disabled={!client.can_edit_language} onClick={() => toggleLanguage(code)} className={`rounded-lg border px-3 py-2 text-xs font-black ${client.allowed_languages.includes(code) ? "border-red-700 bg-red-950/35 text-white" : "border-white/10 text-zinc-600"}`}>{code.toUpperCase()}</button>)}</div></div><div className="mt-4 space-y-4"><Input label={widgetT(language, "emailAddressForEnquiries")} value={client.enquiry_email ?? ""} disabled={!client.can_edit_contact} onChange={(value) => update("enquiry_email", value)} type="email" /><Input label={widgetT(language, "whatsappNumber")} value={client.whatsapp_number ?? ""} disabled={!client.can_edit_contact} onChange={(value) => update("whatsapp_number", value)} /><Input label={widgetT(language, "websiteDomain")} value={client.allowed_domain} disabled onChange={() => undefined} />{client.can_hide_branding ? <label className="flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm font-black">Show MG AutoTech branding<input type="checkbox" checked={client.show_branding} onChange={(e) => update("show_branding", e.target.checked)} /></label> : <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs font-bold text-zinc-500"><Check className="h-4 w-4 text-emerald-400" />MG AutoTech branding is included in this plan.</div>}</div></SettingsCard>
      <SettingsCard title={widgetT(language, "domainChangeRequest")} icon={<KeyRound />}><p className="mb-4 text-sm leading-6 text-zinc-500">The active domain cannot be changed directly. Send a request for admin approval.</p><div className="flex gap-2"><input value={domainRequest} onChange={(e) => setDomainRequest(e.target.value)} placeholder="new-domain.com" className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none" /><button onClick={requestDomainChange} className="rounded-lg border border-white/10 px-3 text-xs font-black">Send</button></div>{payload.domainRequests?.map((item) => <div key={item.id} className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="truncate text-zinc-400">{item.requested_domain}</span><span className="font-black uppercase text-amber-300">{item.status}</span></div>)}</SettingsCard></aside>
      <div className="min-w-0 space-y-8"><section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">{widgetT(language, "livePreview")}</h2><span className="text-xs font-black uppercase text-emerald-400">Live</span></div><VehicleLookupPreview client={client} language={language} /></section>
      <section className="space-y-6 border-y border-white/10 py-7"><div><div className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Installation</div><h2 className="mt-2 text-2xl font-black">{widgetT(language, "yourEmbedCodeIs")}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Use one integration method. Script embed is recommended; iframe is the compatibility fallback.</p></div>{payload.settings.allow_script_embed && client.allow_script_embed && <EmbedCodeBox title="Script embed" code={scriptCode} disabled={!active || !payload.publicKey} />}{payload.settings.allow_iframe_embed && client.allow_iframe_embed && <EmbedCodeBox title="Iframe fallback" code={iframeCode} disabled={!active || !payload.publicKey} />}</section>
      <section className="grid gap-6 lg:grid-cols-2"><InfoBox icon={<CreditCard />} title="Subscription"><p>You can update or cancel your subscription at any time from your billing area.</p><button onClick={manageBilling} className="mt-5 rounded-lg bg-white px-4 py-3 text-sm font-black text-black">{widgetT(language, "manageSubscription")}</button></InfoBox><InfoBox icon={<CircleHelp />} title={widgetT(language, "doYouNeedSupport")}><p>{widgetT(language, "supportText")}</p><div className="mt-5 flex flex-wrap gap-2"><a href="mailto:info@mgautotech.de" className="rounded-lg border border-white/10 px-4 py-3 text-sm font-black"><Mail className="mr-2 inline h-4 w-4" />Email support</a>{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/\D/g, "")}`} className="rounded-lg border border-white/10 px-4 py-3 text-sm font-black"><MessageCircle className="mr-2 inline h-4 w-4" />WhatsApp</a>}</div></InfoBox></section>
      <section className="border-t border-white/10 pt-7"><div className="mb-5 flex items-start gap-3"><Code2 className="mt-1 h-6 w-6 text-red-500" /><div><div className="text-xs font-black uppercase tracking-[0.18em] text-red-500">{widgetT(language, "advanced")}</div><h2 className="mt-1 text-2xl font-black">{widgetT(language, "getVehicleDataOnceSelected")}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{widgetT(language, "advancedDescription")}</p></div></div><EmbedCodeBox title="JavaScript listener" code={advancedCode} /></section></div></div>
  </section></main>;
}

function SettingsCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="border-t border-white/10 pt-5"><h2 className="mb-5 flex items-center gap-2 text-xl font-black"><span className="text-red-500">{icon}</span>{title}</h2>{children}</section>; }
function Input({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) { return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span><input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm font-bold outline-none focus:border-red-700 disabled:opacity-45" /></label>; }
function Select({ label, value, onChange, disabled, options }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; options: Array<readonly [string,string] | string[]> }) { return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span><div className="relative"><select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-12 w-full appearance-none rounded-lg border border-white/10 bg-black/30 px-3 pr-10 text-sm font-bold outline-none disabled:opacity-45">{options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /></div></label>; }
function Colour({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) { return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span><div className="flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3"><input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 border-0 bg-transparent p-0" /><input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" /></div></label>; }
function InfoBox({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <div className="border-l border-red-800/50 bg-red-950/10 p-6"><div className="mb-4 flex items-center gap-3 text-red-400">{icon}<h3 className="text-xl font-black text-white">{title}</h3></div><div className="text-sm leading-6 text-zinc-400">{children}</div></div>; }
