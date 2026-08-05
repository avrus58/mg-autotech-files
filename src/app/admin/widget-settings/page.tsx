"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Braces,
  CheckCircle2,
  CircleDollarSign,
  Globe2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Save,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import { defaultWidgetSettings, widgetLanguageCodes, type WidgetLanguage, type WidgetSettings } from "@/lib/widget/types";

type SecurityState = {
  dedicated_session_secret: boolean;
  dedicated_ip_hash_salt: boolean;
  distributed_rate_limit: boolean;
};

const names: Record<WidgetLanguage, string> = { de: "German", en: "English", tr: "Turkish", fr: "French", es: "Spanish", it: "Italian", nl: "Dutch", pl: "Polish", ro: "Romanian", pt: "Portuguese", ru: "Russian", ar: "Arabic" };
const DISABLE_CONFIRMATION = "DISABLE ALL WIDGETS";

export default function AdminWidgetSettingsPage() {
  const [settings, setSettings] = useState<WidgetSettings>(defaultWidgetSettings);
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [originalProductEnabled, setOriginalProductEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const authFetch = useCallback((url: string, init?: RequestInit) => authenticatedFetch(url, { ...init, cache: "no-store" }), []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/api/admin/widget-settings");
      const data = await response.json();
      setSecurity(data.security ?? null);
      if (!response.ok) {
        setSetupRequired(Boolean(data.setupRequired));
        throw new Error(data.error || "Widget controls could not be loaded.");
      }
      setSettings(data.settings);
      setOriginalProductEnabled(Boolean(data.settings.widget_product_enabled));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Widget controls could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const securityReady = useMemo(() => security ? Object.values(security).filter(Boolean).length : 0, [security]);
  function set<K extends keyof WidgetSettings>(key: K, value: WidgetSettings[K]) { setSettings((current) => ({ ...current, [key]: value })); }
  function toggleLanguage(code: WidgetLanguage) {
    const next = settings.enabled_languages.includes(code) ? settings.enabled_languages.filter((item) => item !== code) : [...settings.enabled_languages, code];
    if (!next.length) return;
    set("enabled_languages", next);
    if (!next.includes(settings.default_language)) set("default_language", next[0]);
  }

  async function save(emergencyConfirmation?: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await authFetch("/api/admin/widget-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, emergency_confirmation: emergencyConfirmation }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Global widget settings could not be saved.");
      setSettings(data.settings);
      setSecurity(data.security ?? security);
      setOriginalProductEnabled(Boolean(data.settings.widget_product_enabled));
      setMessage("Global widget controls saved and audited.");
      setConfirmDisable(false);
      setConfirmation("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Global widget settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function requestSave() {
    if (originalProductEnabled && !settings.widget_product_enabled) {
      setConfirmDisable(true);
      return;
    }
    void save();
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-red-500" /><div className="mt-4 font-black">Loading Widget SaaS controls...</div><p className="mt-1 text-sm text-zinc-600">Global delivery and security state are being checked.</p></div></main>;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/20"><ServerCog className="h-5 w-5 text-red-500" /></span><div><div className="text-xs font-black uppercase tracking-[0.17em] text-red-500">Product governance</div><h1 className="text-2xl font-black">Global Widget SaaS Controls</h1><p className="mt-1 text-sm text-zinc-500">Commercial availability, catalogue defaults and runtime safeguards.</p></div></div>
          <Link href="/admin/widget-clients" className="inline-flex h-11 w-fit items-center rounded-lg border border-white/10 px-4 text-sm font-black"><ArrowLeft className="mr-2 h-4 w-4" />Widget clients</Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] space-y-8 px-4 py-7 lg:px-6">
        {error && <div role="alert" className="border-l-2 border-red-600 bg-red-950/15 p-4 text-sm text-red-100">{error}{setupRequired && <p className="mt-2 font-black">Apply the existing widget foundation SQL before this commercial hardening patch.</p>}</div>}
        {message && <div role="status" className="border-l-2 border-emerald-600 bg-emerald-950/15 p-4 text-sm text-emerald-100">{message}</div>}

        <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          <StateMetric label="Product delivery" value={settings.widget_product_enabled ? "Enabled" : "Stopped"} good={settings.widget_product_enabled} />
          <StateMetric label="New subscriptions" value={settings.public_signup_enabled && settings.checkout_enabled ? "Open" : "Restricted"} good={settings.public_signup_enabled && settings.checkout_enabled} />
          <StateMetric label="Installation modes" value={`${settings.allow_script_embed ? "Script" : ""}${settings.allow_script_embed && settings.allow_iframe_embed ? " + " : ""}${settings.allow_iframe_embed ? "Iframe" : "None"}`} good={settings.allow_script_embed || settings.allow_iframe_embed} />
          <StateMetric label="Security readiness" value={`${securityReady}/3 checks`} good={securityReady === 3} />
        </div>

        <div className="grid gap-9 xl:grid-cols-[1fr_420px]">
          <div className="space-y-9">
            <ControlBand icon={<Braces />} title="Commercial availability" description="These switches affect product sales and delivery. They do not alter existing Stripe subscriptions.">
              <div className="grid gap-3 sm:grid-cols-2"><Toggle label="Widget product enabled" detail="Global delivery kill switch" checked={settings.widget_product_enabled} onChange={(value) => set("widget_product_enabled", value)} critical /><Toggle label="Public signup enabled" detail="Allow new customer onboarding" checked={settings.public_signup_enabled} onChange={(value) => set("public_signup_enabled", value)} /><Toggle label="Checkout enabled" detail="Allow new subscription checkout" checked={settings.checkout_enabled} onChange={(value) => set("checkout_enabled", value)} /><Toggle label="Public demo enabled" detail="Keep the sales demo available" checked={settings.demo_enabled} onChange={(value) => set("demo_enabled", value)} /></div>
            </ControlBand>

            <ControlBand icon={<CircleDollarSign />} title="Catalogue defaults" description="These are the existing server-side defaults used for new widget subscriptions. No payment formula is changed here.">
              <div className="grid gap-4 sm:grid-cols-3"><NumberField label="Monthly price" value={settings.monthly_price} onChange={(value) => set("monthly_price", value)} step="0.01" /><TextField label="Currency" value={settings.currency} onChange={(value) => set("currency", value.toLowerCase())} /><NumberField label="Default monthly loads" value={settings.default_monthly_usage_limit} onChange={(value) => set("default_monthly_usage_limit", Math.round(value))} step="1" /></div>
            </ControlBand>

            <ControlBand icon={<Globe2 />} title="Language catalogue" description="Languages enabled globally become the maximum allowlist for every customer widget.">
              <div className="grid gap-5 sm:grid-cols-[260px_1fr]"><label className="block text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Default language<select value={settings.default_language} onChange={(event) => set("default_language", event.target.value as WidgetLanguage)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold">{settings.enabled_languages.map((code) => <option key={code} value={code}>{names[code]}</option>)}</select></label><div><div className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Enabled languages</div><div className="mt-2 flex flex-wrap gap-2">{widgetLanguageCodes.map((code) => <button key={code} type="button" onClick={() => toggleLanguage(code)} className={`rounded-lg border px-3 py-2 text-xs font-black ${settings.enabled_languages.includes(code) ? "border-red-700 bg-red-950/25" : "border-white/10 text-zinc-600"}`}>{code.toUpperCase()} · {names[code]}</button>)}</div></div></div>
            </ControlBand>

            <ControlBand icon={<ShieldCheck />} title="Delivery policy" description="Domain allowlisting and installation modes are enforced again on every server request.">
              <div className="grid gap-3 sm:grid-cols-2"><Toggle label="Require domain whitelist" detail="Required while public delivery is enabled" checked={settings.require_domain_whitelist} onChange={(value) => set("require_domain_whitelist", value)} critical /><Toggle label="Usage logging" detail="Required for limits, audit and commercial reporting" checked={settings.usage_logging_enabled} onChange={(value) => set("usage_logging_enabled", value)} critical /><Toggle label="MG AutoTech branding" detail="Default client branding policy" checked={settings.show_mg_branding} onChange={(value) => set("show_mg_branding", value)} /><Toggle label="Script embed" detail="Recommended integration" checked={settings.allow_script_embed} onChange={(value) => set("allow_script_embed", value)} /><Toggle label="Iframe embed" detail="Compatibility integration" checked={settings.allow_iframe_embed} onChange={(value) => set("allow_iframe_embed", value)} /></div>
            </ControlBand>
          </div>

          <aside className="space-y-6">
            <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-red-400" /><h2 className="text-lg font-black">Runtime security</h2></div><p className="mt-2 text-xs leading-5 text-zinc-500">Only configuration presence is shown. Secret values never leave the server.</p><div className="mt-5 space-y-3"><SecurityCheck icon={<KeyRound />} label="Dedicated session signing secret" ready={Boolean(security?.dedicated_session_secret)} /><SecurityCheck icon={<LockKeyhole />} label="Dedicated IP privacy salt" ready={Boolean(security?.dedicated_ip_hash_salt)} /><SecurityCheck icon={<ServerCog />} label="Distributed rate limiter" ready={Boolean(security?.distributed_rate_limit)} /></div>{securityReady < 3 && <div className="mt-5 border-l border-amber-700 bg-amber-950/10 p-3 text-xs leading-5 text-amber-100">The product remains manageable, but all three controls should be ready before a broader commercial rollout.</div>}</section>
            <section className="rounded-lg border border-red-900/30 bg-red-950/10 p-5"><div className="flex items-center gap-3 text-red-300"><ShieldAlert className="h-5 w-5" /><h2 className="text-lg font-black text-white">Emergency boundary</h2></div><p className="mt-3 text-sm leading-6 text-zinc-400">Disabling the global product blocks public widget responses immediately. It does not cancel billing, delete customers or revoke history.</p><div className="mt-4 flex items-start gap-2 text-xs text-zinc-500"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />Use client suspension for a single account; use the global switch only for a platform-wide incident.</div></section>
          </aside>
        </div>

        <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-lg border border-white/10 bg-[#090909]/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-zinc-500">Changes are server-side, permission-protected and written to the widget audit trail.</div><button type="button" onClick={requestSave} disabled={saving || setupRequired} className="inline-flex h-12 min-w-52 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save global controls</>}</button></div>
      </section>

      {confirmDisable && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><section role="dialog" aria-modal="true" aria-labelledby="disable-widget-title" className="w-full max-w-lg rounded-lg border border-red-900/50 bg-[#0b0b0b] p-6"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.15em] text-red-500">Emergency confirmation</div><h2 id="disable-widget-title" className="mt-2 text-2xl font-black">Stop every public widget?</h2></div><button type="button" onClick={() => setConfirmDisable(false)} aria-label="Close dialog" className="rounded-lg border border-white/10 p-2"><X className="h-4 w-4" /></button></div><p className="mt-4 text-sm leading-6 text-zinc-400">Existing subscriptions remain billed unless managed separately, but all public widget delivery will be blocked.</p><label className="mt-5 block text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Type {DISABLE_CONFIRMATION}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm font-bold outline-none focus:border-red-700" /></label><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setConfirmDisable(false)} className="h-11 rounded-lg border border-white/10 px-4 text-sm font-black">Keep widgets live</button><button type="button" disabled={saving || confirmation !== DISABLE_CONFIRMATION} onClick={() => void save(confirmation)} className="h-11 rounded-lg bg-[#b1121b] px-5 text-sm font-black disabled:opacity-35">Confirm global stop</button></div></section></div>}
    </main>
  );
}

function StateMetric({ label, value, good }: { label: string; value: string; good: boolean }) { return <div className="bg-[#090909] p-4"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{label}</div><div className={`mt-2 text-xl font-black ${good ? "text-emerald-300" : "text-amber-200"}`}>{value}</div></div>; }
function ControlBand({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) { return <section className="grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-[245px_1fr]"><div><div className="flex items-center gap-2 text-red-400"><span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span><h2 className="font-black text-white">{title}</h2></div><p className="mt-2 text-xs leading-5 text-zinc-500">{description}</p></div><div>{children}</div></section>; }
function Toggle({ label, detail, checked, onChange, critical }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void; critical?: boolean }) { return <label className={`flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-lg border p-4 ${checked ? "border-emerald-800/30 bg-emerald-950/10" : critical ? "border-red-900/40 bg-red-950/10" : "border-white/10 bg-white/[0.02]"}`}><span><span className="block text-sm font-black">{label}</span><span className="mt-1 block text-xs text-zinc-500">{detail}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-emerald-500" /></label>; }
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-xs font-black uppercase tracking-[0.1em] text-zinc-500">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold text-white outline-none focus:border-red-700" /></label>; }
function NumberField({ label, value, onChange, step }: { label: string; value: number; onChange: (value: number) => void; step: string }) { return <label className="block text-xs font-black uppercase tracking-[0.1em] text-zinc-500">{label}<input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold text-white outline-none focus:border-red-700" /></label>; }
function SecurityCheck({ icon, label, ready }: { icon: React.ReactNode; label: string; ready: boolean }) { return <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0"><span className="flex items-center gap-3 text-sm font-black"><span className={ready ? "text-emerald-400" : "text-amber-300"}>{icon}</span>{label}</span><span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-black uppercase ${ready ? "border-emerald-700/40 text-emerald-300" : "border-amber-700/40 text-amber-200"}`}>{ready ? <><CheckCircle2 className="mr-1 h-3 w-3" />Ready</> : "Action needed"}</span></div>; }
