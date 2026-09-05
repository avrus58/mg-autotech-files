"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Globe2,
  Inbox,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  RotateCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { EmbedCodeBox } from "@/components/widget/EmbedCodeBox";
import { authenticatedFetch } from "@/lib/authGuards";
import type { AdminWidgetClient } from "@/lib/widget/adminTypes";
import type { WidgetCommercialHealth, WidgetCommercialMetrics } from "@/lib/widget/commercial";
import { widgetLanguageCodes, type WidgetLanguage } from "@/lib/widget/types";

type ApiKey = { id: string; public_key: string; is_active: boolean; created_at: string; revoked_at: string | null };
type AccessLog = { id: string; request_domain: string | null; path: string | null; language: string | null; status: string; block_reason: string | null; created_at: string };
type DomainRequest = { id: string; old_domain: string | null; requested_domain: string; status: string; admin_note: string | null; created_at: string; resolved_at: string | null };
type AuditLog = { id: string; action: string; details: Record<string, unknown>; created_at: string };
type Enquiry = { id: string; vehicle_name: string; stage: string; selected_services: string[]; visitor_name: string; visitor_email: string; visitor_phone: string | null; visitor_location: string | null; vehicle_registration: string | null; message: string | null; status: string; created_at: string };
type DetailPayload = { client: AdminWidgetClient; commercial: WidgetCommercialHealth; metrics: WidgetCommercialMetrics; keys: ApiKey[]; logs: AccessLog[]; domainRequests: DomainRequest[]; auditLogs: AuditLog[]; enquiries: Enquiry[] };
type Tab = "overview" | "configuration" | "security" | "leads" | "activity";
type ActionName = "activate" | "suspend" | "cancel" | "regenerate_key" | "revoke_key" | "approve_domain" | "reject_domain" | "replace_domain";
type PendingAction = { action: ActionName; title: string; detail: string; requestId?: string; domain?: string; reasonRequired?: boolean };

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://file.mgautotech.de").replace(/\/$/, "");
const tabDefinitions: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", icon: <Activity /> },
  { id: "configuration", label: "Configuration", icon: <SlidersHorizontal /> },
  { id: "security", label: "Security & install", icon: <ShieldCheck /> },
  { id: "leads", label: "Leads", icon: <Inbox /> },
  { id: "activity", label: "Activity", icon: <ClipboardCheck /> },
];

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function configurationPayload(client: AdminWidgetClient) {
  const payload: Record<string, unknown> = {
    company_name: client.company_name,
    email: client.email,
    allow_www_alias: client.allow_www_alias,
    allow_subdomains: client.allow_subdomains,
    widget_enabled: client.widget_enabled,
    widget_title: client.widget_title,
    button_text: client.button_text,
    enquiry_email: client.enquiry_email,
    whatsapp_number: client.whatsapp_number,
    email_enquiries_enabled: client.email_enquiries_enabled,
    whatsapp_enquiries_enabled: client.whatsapp_enquiries_enabled,
    main_color: client.main_color,
    button_text_color: client.button_text_color,
    difference_color: client.difference_color,
    theme_mode: client.theme_mode,
    default_language: client.default_language,
    allowed_languages: client.allowed_languages,
    show_branding: client.show_branding,
    allow_script_embed: client.allow_script_embed,
    allow_iframe_embed: client.allow_iframe_embed,
    can_edit_colours: client.can_edit_colours,
    can_edit_language: client.can_edit_language,
    can_edit_contact: client.can_edit_contact,
    can_hide_branding: client.can_hide_branding,
    monthly_usage_limit: client.monthly_usage_limit,
  };
  if (!client.subscription_linked) {
    payload.plan = client.plan;
    payload.monthly_price = client.monthly_price;
    payload.currency = client.currency;
  }
  return payload;
}

export default function AdminWidgetClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [replacementDomain, setReplacementDomain] = useState("");

  const authFetch = useCallback((url: string, init?: RequestInit) => authenticatedFetch(url, { ...init, cache: "no-store" }), []);
  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await authFetch(`/api/admin/widget-clients/${id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Widget client could not be loaded.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Widget client could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const client = data?.client;
  const activeKey = data?.keys.find((key) => key.is_active && !key.revoked_at)?.public_key ?? "";
  const scriptCode = `<div id="mga-vehicle-lookup"></div>\n<script src="${siteUrl}/widget/vehicle-lookup.js" data-client-key="${activeKey}" data-target="#mga-vehicle-lookup"></script>`;
  const iframeCode = `<iframe src="${siteUrl}/embed/vehicle-selector?key=${activeKey}" style="width:100%;height:700px;border:0;border-radius:8px;" loading="lazy"></iframe>`;
  const blockedDomains = useMemo(() => [...new Set((data?.logs ?? []).filter((log) => log.status === "blocked" && log.request_domain).map((log) => log.request_domain as string))], [data]);

  function update<K extends keyof AdminWidgetClient>(key: K, value: AdminWidgetClient[K]) {
    setData((current) => current ? { ...current, client: { ...current.client, [key]: value } } : current);
  }

  async function save() {
    if (!client) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await authFetch(`/api/admin/widget-clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configurationPayload(client)),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Widget client settings could not be saved.");
      setData((current) => current ? { ...current, client: payload.client } : current);
      setMessage("Widget settings saved and added to the audit trail.");
      await load(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Widget client settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function openAction(action: PendingAction) {
    setPendingAction(action);
    setActionReason("");
    setReplacementDomain(action.domain ?? "");
    setError("");
    setMessage("");
  }

  async function executeAction() {
    if (!pendingAction) return;
    setWorking(true);
    setError("");
    try {
      const response = await authFetch(`/api/admin/widget-clients/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pendingAction.action,
          requestId: pendingAction.requestId,
          adminNote: actionReason || undefined,
          domain: pendingAction.action === "replace_domain" ? replacementDomain : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The requested operation failed.");
      setMessage(payload.warning || `${pendingAction.title} completed.`);
      setPendingAction(null);
      await load(true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The requested operation failed.");
    } finally {
      setWorking(false);
    }
  }

  if (loading && !data) return <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-red-500" /><div className="mt-4 font-black">Reconciling widget account...</div><p className="mt-1 text-sm text-zinc-600">Commercial, installation and lead signals are loading.</p></div></main>;
  if (!client || !data) return <main className="min-h-screen bg-[#050505] px-4 py-20 text-white"><div className="mx-auto max-w-xl border-y border-red-900/40 py-10 text-center"><XCircle className="mx-auto h-8 w-8 text-red-500" /><h1 className="mt-4 text-2xl font-black">Widget client unavailable</h1><p className="mt-2 text-sm text-zinc-500">{error || "The client record could not be found."}</p><Link href="/admin/widget-clients" className="mt-6 inline-flex h-11 items-center rounded-lg border border-white/10 px-4 text-sm font-black">Back to clients</Link></div></main>;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/85">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 sm:flex-row sm:items-end sm:justify-between lg:px-6">
          <div className="min-w-0">
            <Link href="/admin/widget-clients" className="inline-flex items-center text-xs font-black uppercase tracking-[0.12em] text-zinc-500"><ArrowLeft className="mr-2 h-4 w-4" />Widget portfolio</Link>
            <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="min-w-0 break-words text-2xl font-black sm:text-3xl">{client.company_name}</h1><HealthBadge health={data.commercial} /></div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 break-all text-sm text-zinc-500"><span>{client.email}</span><span>{client.allowed_domain}</span><span>{client.plan.toUpperCase()}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="h-11 rounded-lg border border-white/10 px-4 text-sm font-black"><RefreshCw className={`mr-2 inline h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
            {client.status !== "active" && <button type="button" onClick={() => openAction({ action: "activate", title: "Activate widget access", detail: "This checks billing state, issues a key when needed and enables public delivery." })} className="h-11 rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-4 text-sm font-black text-emerald-300"><CheckCircle2 className="mr-2 inline h-4 w-4" />Activate</button>}
            {client.status === "active" && <button type="button" onClick={() => openAction({ action: "suspend", title: "Suspend widget access", detail: "Public widget delivery will stop immediately. Billing is not changed.", reasonRequired: true })} className="h-11 rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 text-sm font-black text-amber-200"><Ban className="mr-2 inline h-4 w-4" />Suspend</button>}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-4 py-7 lg:px-6">
        {error && <div role="alert" className="mb-5 border-l-2 border-red-600 bg-red-950/15 p-4 text-sm text-red-100">{error}</div>}
        {message && <div role="status" className="mb-5 border-l-2 border-emerald-600 bg-emerald-950/15 p-4 text-sm text-emerald-100">{message}</div>}

        <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Health score" value={`${data.commercial.score}/100`} detail={data.commercial.level} />
          <Metric label="Setup" value={`${data.commercial.onboarding_completed}/${data.commercial.onboarding_total}`} detail="required checkpoints" />
          <Metric label="Usage" value={`${data.metrics.usage_this_month.toLocaleString()} / ${client.monthly_usage_limit.toLocaleString()}`} detail={`${data.commercial.usage_percent}% consumed`} />
          <Metric label="Leads" value={data.metrics.enquiries_this_month.toString()} detail={`${data.metrics.failed_enquiries_this_month} failed`} />
          <Metric label="Blocked" value={data.metrics.blocked_this_month.toString()} detail="this month" />
          <Metric label="Plan value" value={`${client.monthly_price.toFixed(2)} ${client.currency.toUpperCase()}`} detail="per month" />
        </div>

        <nav aria-label="Widget client sections" className="mt-7 flex max-w-full gap-2 overflow-x-auto border-b border-white/10 pb-3">
          {tabDefinitions.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex h-10 shrink-0 items-center rounded-lg border px-3 text-xs font-black ${tab === item.id ? "border-red-700 bg-red-950/25 text-white" : "border-transparent text-zinc-500 hover:text-white"}`}><span className="mr-2 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>{item.label}{item.id === "leads" && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5">{data.enquiries.length}</span>}</button>)}
        </nav>

        <div className="pt-7">
          {tab === "overview" && <OverviewTab data={data} openAction={openAction} />}
          {tab === "configuration" && <ConfigurationTab client={client} update={update} save={save} saving={saving} />}
          {tab === "security" && <SecurityTab data={data} activeKey={activeKey} scriptCode={scriptCode} iframeCode={iframeCode} blockedDomains={blockedDomains} openAction={openAction} />}
          {tab === "leads" && <LeadsTab enquiries={data.enquiries} />}
          {tab === "activity" && <ActivityTab logs={data.logs} auditLogs={data.auditLogs} />}
        </div>
      </section>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !working) setPendingAction(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="widget-action-title" className="w-full max-w-lg rounded-lg border border-white/10 bg-[#0b0b0b] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[0.16em] text-red-500">Audited operation</div><h2 id="widget-action-title" className="mt-2 text-2xl font-black">{pendingAction.title}</h2></div><button type="button" onClick={() => setPendingAction(null)} disabled={working} aria-label="Close dialog" className="rounded-lg border border-white/10 p-2"><X className="h-4 w-4" /></button></div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">{pendingAction.detail}</p>
            {pendingAction.action === "replace_domain" && <Input label="New public domain" value={replacementDomain} onChange={setReplacementDomain} placeholder="client-domain.com" />}
            {(pendingAction.reasonRequired || ["reject_domain", "regenerate_key", "revoke_key"].includes(pendingAction.action)) && <label className="mt-5 block"><span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Audit reason</span><textarea value={actionReason} onChange={(event) => setActionReason(event.target.value)} rows={3} placeholder="Explain why this operation is required" className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-red-700" /></label>}
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setPendingAction(null)} disabled={working} className="h-11 rounded-lg border border-white/10 px-4 text-sm font-black">Cancel</button><button type="button" onClick={() => void executeAction()} disabled={working || (pendingAction.reasonRequired && actionReason.trim().length < 3) || (pendingAction.action === "replace_domain" && !replacementDomain.trim())} className="inline-flex h-11 items-center rounded-lg bg-[#b1121b] px-5 text-sm font-black disabled:opacity-40">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm operation"}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

function OverviewTab({ data, openAction }: { data: DetailPayload; openAction: (action: PendingAction) => void }) {
  const client = data.client;
  return <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
    <div className="space-y-8">
      <SectionHeader eyebrow="Commercial readiness" title="Account health and next action" description="Operational signals are calculated from billing, domain, key, live usage and lead delivery evidence." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.commercial.onboarding_steps.map((step) => <div key={step.id} className={`flex min-h-24 items-start gap-3 rounded-lg border p-4 ${step.complete ? "border-emerald-800/30 bg-emerald-950/10" : "border-white/10 bg-white/[0.02]"}`}><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${step.complete ? "border-emerald-600 text-emerald-400" : "border-zinc-700 text-zinc-600"}`}>{step.complete ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><div><div className="text-sm font-black">{step.label}</div><div className="mt-1 text-xs text-zinc-500">{step.complete ? "Verified" : "Still required"}</div></div></div>)}</div>
      <section className="border-t border-white/10 pt-5"><h3 className="text-xl font-black">Operational signals</h3><div className="mt-4 divide-y divide-white/10 border-y border-white/10">{data.commercial.issues.map((issue) => <div key={issue.code} className="flex gap-3 py-4"><AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${issue.severity === "critical" ? "text-red-400" : "text-amber-300"}`} /><div><div className="font-black">{issue.title}</div><p className="mt-1 text-sm leading-6 text-zinc-500">{issue.detail}</p></div></div>)}{!data.commercial.issues.length && <div className="flex items-center gap-3 py-7 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" />All commercial and delivery checks are healthy.</div>}</div></section>
    </div>
    <aside className="space-y-6">
      <InfoPanel icon={<CircleDollarSign />} title="Subscription"><InfoRow label="Local access" value={client.status} /><InfoRow label="Stripe state" value={client.stripe_subscription_status || "Manual account"} /><InfoRow label="Billing profile" value={client.billing_profile_linked ? "Linked" : "Not linked"} /><InfoRow label="Plan" value={client.plan} /></InfoPanel>
      <InfoPanel icon={<Globe2 />} title="Installation"><InfoRow label="Approved domain" value={client.allowed_domain} /><InfoRow label="Origin evidence" value={client.domain_verified ? "Verified" : "Waiting for first live load"} /><InfoRow label="Active keys" value={data.metrics.active_key_count.toString()} /><InfoRow label="Last live load" value={formatDate(data.metrics.last_allowed_at)} /></InfoPanel>
      <InfoPanel icon={<LockKeyhole />} title="Account controls"><div className="grid gap-2"><button type="button" onClick={() => openAction({ action: "replace_domain", title: "Replace approved domain", detail: "The new domain will require a successful live request before it is marked verified.", reasonRequired: true, domain: client.allowed_domain })} className="h-11 rounded-lg border border-white/10 text-sm font-black">Replace domain</button><button type="button" onClick={() => openAction({ action: "cancel", title: "Close manual widget access", detail: client.subscription_linked ? "This account is linked to Stripe and cannot be cancelled locally. Use billing controls instead." : "This closes local access without deleting account history.", reasonRequired: true })} disabled={client.subscription_linked || client.status === "cancelled"} className="h-11 rounded-lg border border-red-800/40 text-sm font-black text-red-300 disabled:cursor-not-allowed disabled:opacity-35">Close manual access</button></div></InfoPanel>
    </aside>
  </div>;
}

function ConfigurationTab({ client, update, save, saving }: { client: AdminWidgetClient; update: <K extends keyof AdminWidgetClient>(key: K, value: AdminWidgetClient[K]) => void; save: () => Promise<void>; saving: boolean }) {
  return <div className="space-y-9"><SectionHeader eyebrow="Configuration" title="Commercial and widget settings" description="Billing-linked commercial values are read-only. Design and contact permissions remain explicit per client." />
    <FormBand title="Account identity" description="Public client name and operational contact."><div className="grid gap-4 sm:grid-cols-2"><Input label="Company name" value={client.company_name} onChange={(value) => update("company_name", value)} /><Input label="Account email" type="email" value={client.email} onChange={(value) => update("email", value)} /></div></FormBand>
    <FormBand title="Commercial terms" description={client.subscription_linked ? "Synced from the linked billing lifecycle and protected from manual drift." : "Manual commercial account values."}><div className="grid gap-4 sm:grid-cols-3"><Select label="Plan" value={client.plan} disabled={client.subscription_linked} onChange={(value) => update("plan", value)} options={["starter", "pro", "white_label"]} /><NumberInput label="Monthly price" value={client.monthly_price} disabled={client.subscription_linked} onChange={(value) => update("monthly_price", value)} /><Input label="Currency" value={client.currency} disabled={client.subscription_linked} onChange={(value) => update("currency", value)} /></div></FormBand>
    <FormBand title="Brand and appearance" description="Configuration delivered to the approved domain only."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Input label="Widget title" value={client.widget_title} onChange={(value) => update("widget_title", value)} /><Input label="Primary button" value={client.button_text} onChange={(value) => update("button_text", value)} /><Select label="Theme mode" value={client.theme_mode} onChange={(value) => update("theme_mode", value as AdminWidgetClient["theme_mode"])} options={["light", "dark", "auto"]} /><ColourInput label="Main colour" value={client.main_color} onChange={(value) => update("main_color", value)} /><ColourInput label="Button text" value={client.button_text_color} onChange={(value) => update("button_text_color", value)} /><ColourInput label="Difference highlight" value={client.difference_color} onChange={(value) => update("difference_color", value)} /></div></FormBand>
    <FormBand title="Lead delivery" description="A channel must have a destination before it can be enabled."><div className="grid gap-4 sm:grid-cols-2"><Input label="Enquiry email" type="email" value={client.enquiry_email ?? ""} onChange={(value) => update("enquiry_email", value || null)} /><Input label="WhatsApp number" value={client.whatsapp_number ?? ""} onChange={(value) => update("whatsapp_number", value || null)} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Toggle label="Email enquiries" checked={client.email_enquiries_enabled} onChange={(value) => update("email_enquiries_enabled", value)} /><Toggle label="WhatsApp enquiries" checked={client.whatsapp_enquiries_enabled} onChange={(value) => update("whatsapp_enquiries_enabled", value)} /></div></FormBand>
    <FormBand title="Language catalogue" description="The default language must remain inside the client allowlist."><div className="flex flex-wrap gap-2">{widgetLanguageCodes.map((code) => <button type="button" key={code} onClick={() => { const next = client.allowed_languages.includes(code) ? client.allowed_languages.filter((item) => item !== code) : [...client.allowed_languages, code]; if (next.length) update("allowed_languages", next); }} className={`rounded-lg border px-3 py-2 text-xs font-black ${client.allowed_languages.includes(code) ? "border-red-700 bg-red-950/25" : "border-white/10 text-zinc-600"}`}>{code.toUpperCase()}</button>)}</div><div className="mt-4 max-w-sm"><Select label="Default language" value={client.default_language} onChange={(value) => update("default_language", value as WidgetLanguage)} options={client.allowed_languages} /></div></FormBand>
    <FormBand title="Delivery permissions" description="These limits define what the customer can edit and which installation modes are available."><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Toggle label="Widget delivery enabled" checked={client.widget_enabled} onChange={(value) => update("widget_enabled", value)} /><Toggle label="Allow www alias" checked={client.allow_www_alias} onChange={(value) => update("allow_www_alias", value)} /><Toggle label="Allow subdomains" checked={client.allow_subdomains} onChange={(value) => update("allow_subdomains", value)} /><Toggle label="Script embed" checked={client.allow_script_embed} onChange={(value) => update("allow_script_embed", value)} /><Toggle label="Iframe embed" checked={client.allow_iframe_embed} onChange={(value) => update("allow_iframe_embed", value)} /><Toggle label="Show branding" checked={client.show_branding} onChange={(value) => update("show_branding", value)} /><Toggle label="Customer edits colours" checked={client.can_edit_colours} onChange={(value) => update("can_edit_colours", value)} /><Toggle label="Customer edits language" checked={client.can_edit_language} onChange={(value) => update("can_edit_language", value)} /><Toggle label="Customer edits contact" checked={client.can_edit_contact} onChange={(value) => update("can_edit_contact", value)} /><Toggle label="Customer may hide branding" checked={client.can_hide_branding} onChange={(value) => update("can_hide_branding", value)} /></div><div className="mt-4 max-w-sm"><NumberInput label="Monthly live-load allowance" value={client.monthly_usage_limit} onChange={(value) => update("monthly_usage_limit", Math.round(value))} /></div></FormBand>
    <div className="sticky bottom-3 z-10 flex justify-end border-t border-white/10 bg-[#050505]/95 py-4"><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-12 min-w-52 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />Save configuration</>}</button></div>
  </div>;
}

function SecurityTab({ data, activeKey, scriptCode, iframeCode, blockedDomains, openAction }: { data: DetailPayload; activeKey: string; scriptCode: string; iframeCode: string; blockedDomains: string[]; openAction: (action: PendingAction) => void }) {
  return <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]"><div className="space-y-8"><SectionHeader eyebrow="Installation security" title="Keys, origin and embed delivery" description="Keys are public installation identifiers. Domain allowlisting and server-side account validation remain authoritative." />
    <FormBand title="Installation key" description={activeKey ? `Issued ${formatDate(data.keys.find((key) => key.public_key === activeKey)?.created_at ?? null)}` : "No active installation key is available."}><div className="break-all rounded-lg border border-white/10 bg-black/35 p-4 font-mono text-xs text-red-200">{activeKey || "No active key"}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openAction({ action: "regenerate_key", title: "Rotate installation key", detail: "The previous key is revoked and its replacement is issued in one atomic operation. Existing embeds must then be updated.", reasonRequired: true })} className="h-11 rounded-lg border border-white/10 px-4 text-xs font-black"><RotateCw className="mr-2 inline h-4 w-4" />Rotate key</button><button type="button" disabled={!activeKey} onClick={() => openAction({ action: "revoke_key", title: "Revoke installation key", detail: "Public widget requests using the current key will stop immediately.", reasonRequired: true })} className="h-11 rounded-lg border border-red-800/40 px-4 text-xs font-black text-red-300 disabled:opacity-35"><KeyRound className="mr-2 inline h-4 w-4" />Revoke key</button></div></FormBand>
    {activeKey && <FormBand title="Approved installation methods" description="Use one integration method. Script is preferred and iframe is the compatibility option.">{data.client.allow_script_embed && <EmbedCodeBox title="Script embed" code={scriptCode} />}{data.client.allow_iframe_embed && <div className="mt-5"><EmbedCodeBox title="Iframe embed" code={iframeCode} /></div>}</FormBand>}
    <FormBand title="Observed blocked origins" description="Recent domains that attempted to use this client's installation key."><div className="flex flex-wrap gap-2">{blockedDomains.map((domain) => <span key={domain} className="rounded-lg border border-red-800/30 bg-red-950/15 px-3 py-2 text-xs font-black text-red-200">{domain}</span>)}{!blockedDomains.length && <span className="text-sm text-zinc-500">No blocked origin has been recorded.</span>}</div></FormBand>
  </div><aside className="space-y-6"><InfoPanel icon={<Globe2 />} title="Approved origin"><InfoRow label="Domain" value={data.client.allowed_domain} /><InfoRow label="Live verification" value={data.client.domain_verified ? "Verified by successful request" : "Waiting for first successful request"} /><InfoRow label="www alias" value={data.client.allow_www_alias ? "Allowed" : "Blocked"} /><InfoRow label="Subdomains" value={data.client.allow_subdomains ? "Allowed" : "Blocked"} /></InfoPanel>
    <InfoPanel icon={<RefreshCw />} title="Domain review queue"><div className="space-y-4">{data.domainRequests.map((request) => <div key={request.id} className="border-t border-white/10 pt-4 first:border-0 first:pt-0"><div className="break-all text-sm font-black">{request.requested_domain}</div><div className="mt-1 flex justify-between gap-3 text-xs text-zinc-500"><span>{request.status.toUpperCase()}</span><span>{formatDate(request.created_at)}</span></div>{request.status === "pending" && <div className="mt-3 flex gap-2"><button type="button" onClick={() => openAction({ action: "approve_domain", title: "Approve domain change", detail: `Replace the approved origin with ${request.requested_domain}. Live verification resets until the first successful request.`, requestId: request.id })} className="h-9 flex-1 rounded-lg bg-emerald-800 px-3 text-xs font-black">Approve</button><button type="button" onClick={() => openAction({ action: "reject_domain", title: "Reject domain change", detail: `Keep ${data.client.allowed_domain} as the approved origin.`, requestId: request.id, reasonRequired: true })} className="h-9 flex-1 rounded-lg bg-red-900 px-3 text-xs font-black">Reject</button></div>}</div>)}{!data.domainRequests.length && <div className="text-sm text-zinc-500">No domain changes have been requested.</div>}</div></InfoPanel>
  </aside></div>;
}

function LeadsTab({ enquiries }: { enquiries: Enquiry[] }) {
  return <div><SectionHeader eyebrow="Commercial leads" title="Widget enquiry delivery" description="Customer contact data is admin-only and shown only to staff with widget management permission." /><div className="mt-6 hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="text-[11px] font-black uppercase tracking-[0.13em] text-zinc-600"><tr><th className="py-4 pr-4">Received</th><th className="px-4 py-4">Visitor</th><th className="px-4 py-4">Vehicle</th><th className="px-4 py-4">Request</th><th className="px-4 py-4">Delivery</th><th className="px-4 py-4">Message</th></tr></thead><tbody className="divide-y divide-white/10">{enquiries.map((enquiry) => <tr key={enquiry.id}><td className="py-4 pr-4 text-xs text-zinc-500">{formatDate(enquiry.created_at)}</td><td className="px-4 py-4"><div className="font-black">{enquiry.visitor_name}</div><div className="mt-1 text-xs text-zinc-500">{enquiry.visitor_email}</div></td><td className="px-4 py-4"><div className="max-w-[250px] font-black">{enquiry.vehicle_name}</div><div className="mt-1 text-xs text-zinc-500">{enquiry.vehicle_registration || "No registration"}</div></td><td className="px-4 py-4"><div className="font-black">{enquiry.stage}</div><div className="mt-1 max-w-[230px] text-xs text-zinc-500">{enquiry.selected_services?.join(", ") || "No additional services"}</div></td><td className="px-4 py-4"><StatusBadge value={enquiry.status} /></td><td className="max-w-[280px] px-4 py-4 text-xs leading-5 text-zinc-400">{enquiry.message || "No message"}</td></tr>)}</tbody></table></div><div className="grid gap-3 pt-5 md:hidden">{enquiries.map((enquiry) => <div key={enquiry.id} className="rounded-lg border border-white/10 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-black">{enquiry.visitor_name}</div><div className="mt-1 text-xs text-zinc-500">{enquiry.visitor_email}</div></div><StatusBadge value={enquiry.status} /></div><div className="mt-4 text-sm font-black">{enquiry.vehicle_name}</div><div className="mt-1 text-xs text-zinc-500">{enquiry.stage} · {formatDate(enquiry.created_at)}</div>{enquiry.message && <p className="mt-3 text-sm leading-6 text-zinc-400">{enquiry.message}</p>}</div>)}</div>{!enquiries.length && <EmptyState icon={<Inbox />} title="No widget enquiries yet" detail="Lead submissions will appear here after delivery attempts." />}</div>;
}

function ActivityTab({ logs, auditLogs }: { logs: AccessLog[]; auditLogs: AuditLog[] }) {
  return <div className="grid gap-9 xl:grid-cols-2"><section><SectionHeader eyebrow="Runtime" title="Access activity" description="Customer-safe request outcomes without IP hashes or browser fingerprints." /><div className="mt-5 divide-y divide-white/10 border-y border-white/10">{logs.slice(0, 80).map((log) => <div key={log.id} className="grid gap-2 py-3 text-xs sm:grid-cols-[150px_1fr_100px]"><span className="text-zinc-600">{formatDate(log.created_at)}</span><span className="min-w-0 truncate"><strong>{log.request_domain || "Unknown origin"}</strong><span className="ml-2 text-zinc-600">{log.path || "-"}</span></span><StatusBadge value={log.status} /></div>)}{!logs.length && <div className="py-8 text-sm text-zinc-600">No runtime activity recorded.</div>}</div></section><section><SectionHeader eyebrow="Audit" title="Administrative history" description="Every sensitive lifecycle operation remains attributable and reviewable." /><div className="mt-5 divide-y divide-white/10 border-y border-white/10">{auditLogs.map((entry) => <div key={entry.id} className="py-4"><div className="flex items-start justify-between gap-4"><div className="font-black">{entry.action.replaceAll("_", " ")}</div><time className="shrink-0 text-xs text-zinc-600">{formatDate(entry.created_at)}</time></div>{Object.keys(entry.details ?? {}).length > 0 && <div className="mt-2 text-xs leading-5 text-zinc-500">{Object.entries(entry.details).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</div>}</div>)}{!auditLogs.length && <div className="py-8 text-sm text-zinc-600">No audit events recorded.</div>}</div></section></div>;
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div><div className="text-xs font-black uppercase tracking-[0.16em] text-red-500">{eyebrow}</div><h2 className="mt-2 text-2xl font-black">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{description}</p></div>; }
function FormBand({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-[250px_1fr]"><div><h3 className="font-black">{title}</h3><p className="mt-2 text-xs leading-5 text-zinc-500">{description}</p></div><div>{children}</div></section>; }
function InfoPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5"><div className="mb-5 flex items-center gap-3 text-red-400"><span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span><h3 className="text-lg font-black text-white">{title}</h3></div><div className="space-y-3">{children}</div></section>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 text-sm"><span className="text-zinc-500">{label}</span><span className="max-w-[240px] break-words text-right font-black capitalize">{value}</span></div>; }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="bg-[#090909] p-4"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{label}</div><div className="mt-2 truncate text-xl font-black">{value}</div><div className="mt-1 truncate text-xs capitalize text-zinc-600">{detail}</div></div>; }
function Input({ label, value, onChange, type = "text", disabled, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; placeholder?: string }) { return <label className="mt-5 block first:mt-0"><span className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">{label}</span><input type={type} value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold outline-none focus:border-red-700 disabled:opacity-40" /></label>; }
function NumberInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) { return <label className="block"><span className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">{label}</span><input type="number" min="0" step="0.01" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold outline-none focus:border-red-700 disabled:opacity-40" /></label>; }
function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[]; disabled?: boolean }) { return <label className="block"><span className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm font-bold outline-none disabled:opacity-40">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function ColourInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">{label}</span><div className="mt-2 flex h-11 items-center gap-3 rounded-lg border border-white/10 bg-black/35 px-3"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-9 border-0 bg-transparent p-0" /><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" /></div></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm font-black ${checked ? "border-emerald-800/35 bg-emerald-950/10" : "border-white/10 bg-white/[0.02]"}`}><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-emerald-500" /></label>; }
function StatusBadge({ value }: { value: string }) { const good = ["allowed", "delivered", "active", "approved"].includes(value); return <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${good ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-300" : "border-red-800/40 bg-red-950/20 text-red-300"}`}>{value.replaceAll("_", " ")}</span>; }
function HealthBadge({ health }: { health: WidgetCommercialHealth }) { const styles = health.level === "healthy" ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-300" : health.level === "watch" ? "border-amber-700/40 bg-amber-950/20 text-amber-200" : health.level === "inactive" ? "border-white/10 text-zinc-500" : "border-red-800/40 bg-red-950/20 text-red-300"; return <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${styles}`}>{health.stage} · {health.score}</span>; }
function EmptyState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="border-y border-white/10 py-14 text-center"><span className="mx-auto block w-fit text-zinc-700 [&>svg]:h-7 [&>svg]:w-7">{icon}</span><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm text-zinc-600">{detail}</p></div>; }
