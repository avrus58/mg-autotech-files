"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  Eye,
  FlaskConical,
  Languages,
  ListChecks,
  LockKeyhole,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authGuards";
import { supportedLocales } from "@/lib/i18nConfig";
import type { TransactionalEmailLanguage } from "@/lib/email/types";

type EmailAdminData = {
  provider: {
    provider: string;
    configured: boolean;
    webhookConfigured: boolean;
    dryRun: boolean;
    sendingEnabled: boolean;
    fromEmail: string;
  };
  templates: Array<{ eventType: string; label: string; audience: string }>;
  authTemplates: Array<{
    key: string;
    label: string;
    category: string;
    supabaseKey: string;
  }>;
  recentEvents: Array<Record<string, unknown>>;
  deliveryEvents: Array<Record<string, unknown>>;
  activeSuppressions: Array<Record<string, unknown>>;
  eventSummary: {
    sent: number;
    delivered: number;
    delayed: number;
    bounced: number;
    complained: number;
    failed: number;
    suppressed: number;
    skipped: number;
    pending: number;
  };
  authFlows: Array<{
    key: string;
    label: string;
    managedBy: string;
    category: string;
    redirectPath: string | null;
  }>;
  lifecycleCoverage: Array<{
    source: string;
    status: string;
    eventType: string;
  }>;
  journeyCoverage: Array<{
    id: string;
    label: string;
    trigger: string;
    eventTypes: Array<{
      eventType: string;
      audience: string;
    }>;
  }>;
  deliveryHealth: {
    state: "healthy" | "monitoring" | "action_required" | "unavailable";
    activeIssueCount: number;
    delayed: number;
    failed: number;
    bounced: number;
    complained: number;
    suppressed: number;
    permanentSuppressions: number;
    message: string;
  };
  migrationReady: boolean;
  deliveryTrackingReady: boolean;
};

type EmailPreview = {
  subject: string;
  html: string;
  text: string;
};

type EmailCertification = {
  generatedAt: string;
  mode: "sample_render_only";
  sideEffects: {
    emailsSent: 0;
    databaseWrites: 0;
    customerRecordsRead: 0;
  };
  summary: {
    status: "passed" | "failed";
    passedChecks: number;
    failedChecks: number;
    renderedTemplates: number;
    languages: number;
    milestones: number;
    lifecycleTransitions: number;
  };
  checks: Array<{
    id: string;
    label: string;
    status: "passed" | "failed";
    checked: number;
    failures: string[];
  }>;
};

function formatBerlinDate(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function labelToken(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminEmailPage() {
  const [data, setData] = useState<EmailAdminData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewSource, setPreviewSource] = useState<"transactional" | "supabase_auth">("transactional");
  const [previewTemplate, setPreviewTemplate] = useState("request_created");
  const [previewLanguage, setPreviewLanguage] = useState<TransactionalEmailLanguage>("en");
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [certification, setCertification] = useState<EmailCertification | null>(null);
  const [certifying, setCertifying] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/email");
      const payload = await response.json();
      if (!response.ok) setMessage(payload.error || "Email settings could not be loaded.");
      else setData(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Email settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setSending(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_test",
          eventType: "admin_email_test",
          language: previewLanguage,
          testId: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();
      const resultMessage = response.ok
        ? `Test email result: ${payload.result?.status || "ok"}`
        : payload.error || "Test email failed.";
      await load();
      setMessage(resultMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test email failed.");
    } finally {
      setSending(false);
    }
  }

  async function loadPreview() {
    setPreviewing(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          source: previewSource,
          eventType: previewTemplate,
          language: previewLanguage,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.preview) {
        setMessage(payload.error || "Template preview could not be rendered.");
        setPreview(null);
      } else {
        setPreview(payload.preview as EmailPreview);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Template preview could not be rendered.");
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function runCertification() {
    setCertifying(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "certify" }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.certification) {
        setCertification(null);
        setMessage(payload.error || "Email journey certification could not be completed.");
      } else {
        setCertification(payload.certification as EmailCertification);
        setMessage(payload.certification.summary?.status === "passed"
          ? "Email journey certification passed without sending any email."
          : "Email journey certification found a blocking issue.");
      }
    } catch (error) {
      setCertification(null);
      setMessage(error instanceof Error ? error.message : "Email journey certification could not be completed.");
    } finally {
      setCertifying(false);
    }
  }

  function changePreviewSource(source: "transactional" | "supabase_auth") {
    setPreviewSource(source);
    setPreview(null);
    const first = source === "transactional"
      ? data?.templates[0]?.eventType
      : data?.authTemplates[0]?.key;
    if (first) setPreviewTemplate(first);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const previewOptions = data
    ? previewSource === "transactional"
      ? data.templates.map((template) => ({ value: template.eventType, label: template.label }))
      : data.authTemplates.map((template) => ({ value: template.key, label: template.label }))
    : [];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-black text-zinc-500">
              <ArrowLeft className="mr-2 inline h-4 w-4" />Admin
            </Link>
            <div className="mt-2 flex min-w-0 items-center gap-3 pr-12 sm:pr-0">
              <Mail className="h-7 w-7 text-red-500" />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Transactional Email</p>
                <h1 className="text-xl font-black sm:text-2xl">Email Control Center</h1>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void load()} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-black">
              <RefreshCw className="mr-2 inline h-4 w-4" />Refresh
            </button>
            <button disabled={certifying} onClick={() => void runCertification()} className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-3 py-2 text-sm font-black text-emerald-200 disabled:opacity-50">
              <FlaskConical className="mr-2 inline h-4 w-4" />{certifying ? "Checking..." : "Certify journey"}
            </button>
            <button disabled={sending} onClick={() => void sendTest()} className="rounded-lg bg-[#b1121b] px-3 py-2 text-sm font-black disabled:opacity-50">
              <Send className="mr-2 inline h-4 w-4" />Send admin test
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto min-w-0 max-w-7xl px-4 py-6">
        {message && <div className="mb-5 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">{message}</div>}
        {loading && <div className="rounded-lg border border-white/10 p-5 text-sm text-zinc-400">Loading email settings...</div>}
        {data && (
          <div className="min-w-0 space-y-5">
            <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="Sent" value={data.eventSummary.sent} icon={<CheckCircle2 />} tone="text-emerald-300" />
              <MetricCard label="Delivered" value={data.eventSummary.delivered} icon={<ShieldCheck />} tone="text-emerald-300" />
              <MetricCard label="Delayed" value={data.eventSummary.delayed} icon={<Clock3 />} tone="text-amber-300" />
              <MetricCard label="Bounced" value={data.eventSummary.bounced} icon={<AlertTriangle />} tone="text-red-300" />
              <MetricCard label="Complained" value={data.eventSummary.complained} icon={<Ban />} tone="text-fuchsia-300" />
              <MetricCard label="Suppressed" value={data.activeSuppressions.length} icon={<LockKeyhole />} tone="text-sky-300" />
            </section>

            <section className="grid min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0b0c0e] xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-black"><ListChecks className="h-4 w-4 text-emerald-300" />Customer email journey</div>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">One sample-only gate covers registration, request intake, review, customer action, visible messages, uploads, delivery and cancellation. It never reads a customer or sends mail.</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase text-zinc-400">{data.journeyCoverage.length} milestones</span>
                </div>
                <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
                  {data.journeyCoverage.map((milestone) => (
                    <div key={milestone.id} className="min-w-0 bg-[#0b0c0e] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs font-black text-white">{milestone.label}</h3>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-zinc-600">{milestone.trigger}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {milestone.eventTypes.map((event) => (
                          <span key={event.eventType} className="max-w-full truncate rounded border border-white/10 px-1.5 py-1 text-[8px] font-black uppercase text-zinc-500">{labelToken(event.eventType)} · {event.audience}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Safe certification</p>
                    <h2 className="mt-1 text-lg font-black">{certification ? certification.summary.status === "passed" ? "All checks passed" : "Review required" : "Ready to run"}</h2>
                  </div>
                  <span className={`grid h-10 w-10 place-items-center rounded-lg border ${certification?.summary.status === "passed" ? "border-emerald-700/40 bg-emerald-950/30 text-emerald-300" : certification?.summary.status === "failed" ? "border-red-700/40 bg-red-950/30 text-red-300" : "border-white/10 text-zinc-600"}`}>
                    {certification?.summary.status === "passed" ? <CheckCircle2 className="h-5 w-5" /> : certification?.summary.status === "failed" ? <AlertTriangle className="h-5 w-5" /> : <FlaskConical className="h-5 w-5" />}
                  </span>
                </div>
                {certification ? (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <CertificationMetric label="Rendered" value={certification.summary.renderedTemplates} />
                      <CertificationMetric label="Languages" value={certification.summary.languages} />
                      <CertificationMetric label="Transitions" value={certification.summary.lifecycleTransitions} />
                      <CertificationMetric label="Side effects" value={0} />
                    </div>
                    <div className="mt-3 space-y-2">
                      {certification.checks.map((check) => (
                        <div key={check.id} className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/25 p-2.5">
                          {check.status === "passed" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
                          <div className="min-w-0"><div className="text-[11px] font-black">{check.label}</div><div className="mt-0.5 text-[9px] text-zinc-600">{check.checked} checks · {check.failures.length} failures</div></div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] text-zinc-600">Last run {formatBerlinDate(certification.generatedAt)} · no sends, writes or customer reads</p>
                  </>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-white/10 p-4 text-xs leading-5 text-zinc-500">Run the certification after template or lifecycle changes. It uses fixed sample content only.</div>
                )}
              </div>
            </section>

            <div className="grid min-w-0 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="min-w-0 space-y-4">
              <section className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />Provider
                </div>
                <Info label="Provider" value={data.provider.provider} />
                <Info label="From" value={data.provider.fromEmail} />
                <Info label="Configured" value={data.provider.configured ? "Yes" : "No"} />
                <Info label="Signed webhook" value={data.provider.webhookConfigured ? "Configured" : "Not configured"} />
                <Info label="Dry-run" value={data.provider.dryRun ? "Enabled" : "Disabled"} />
                <Info label="Real sending" value={data.provider.sendingEnabled ? "Enabled" : "Safely disabled"} />
                <Info label="Log table" value={data.migrationReady ? "Ready" : "Migration needed"} />
                <Info label="Delivery tracking" value={data.deliveryTrackingReady ? "Ready" : "Migration needed"} />
                <Info label="Pending" value={String(data.eventSummary.pending)} />
                <Info label="Failed" value={String(data.eventSummary.failed)} />
                <Info label="Dry-run / skipped" value={String(data.eventSummary.skipped)} />
              </section>
              <section className={`min-w-0 overflow-hidden rounded-lg border p-4 ${data.deliveryHealth.state === "healthy" ? "border-emerald-800/30 bg-emerald-950/10" : data.deliveryHealth.state === "monitoring" ? "border-amber-800/30 bg-amber-950/10" : data.deliveryHealth.state === "action_required" ? "border-red-800/35 bg-red-950/15" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">Delivery response</p><h2 className="mt-1 text-sm font-black">{labelToken(data.deliveryHealth.state)}</h2></div>
                  {data.deliveryHealth.state === "healthy" ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <AlertTriangle className={`h-5 w-5 ${data.deliveryHealth.state === "action_required" ? "text-red-300" : "text-amber-300"}`} />}
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-400">{data.deliveryHealth.message}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  <InfoTile label="Active issues" value={data.deliveryHealth.activeIssueCount} />
                  <InfoTile label="Delayed" value={data.deliveryHealth.delayed} />
                  <InfoTile label="Hard failures" value={data.deliveryHealth.failed + data.deliveryHealth.bounced + data.deliveryHealth.complained + data.deliveryHealth.suppressed} />
                  <InfoTile label="Suppressed" value={data.deliveryHealth.permanentSuppressions} />
                </div>
                <p className="mt-3 text-[10px] leading-4 text-zinc-600">The admin notification bell reads this signed provider event stream. Delivered follow-up events automatically resolve earlier delays.</p>
              </section>
              <section className="min-w-0 overflow-hidden rounded-lg border border-sky-800/30 bg-sky-950/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black">
                  <LockKeyhole className="h-4 w-4 text-sky-300" />Authentication mail
                </div>
                <p className="text-xs leading-5 text-zinc-400">
                  Verification, recovery and security notices are issued by Supabase Auth. All 13 reviewed templates support every website language, with English as the safe fallback.
                </p>
                <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
                  {data.authFlows.map((flow) => (
                    <div key={flow.key} className="py-3">
                      <div className="text-xs font-black">{flow.label}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">{flow.managedBy}</div>
                      {flow.redirectPath && <div className="mt-1 break-all text-[10px] text-sky-300">{flow.redirectPath}</div>}
                    </div>
                  ))}
                </div>
              </section>
              <section className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-black">Safety Rules</h2>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-400">
                  <li>No raw binary, hex or storage paths in customer emails.</li>
                  <li>Internal notes never trigger customer emails.</li>
                  <li>Hidden customer messages are filtered before sending.</li>
                  <li>Admin test sends only to the current admin email.</li>
                </ul>
              </section>
              </aside>

            <div className="min-w-0 space-y-5">
              <section className="min-w-0 overflow-hidden rounded-lg border border-red-900/30 bg-[linear-gradient(135deg,rgba(127,29,29,0.13),rgba(255,255,255,0.025)_55%)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-black"><Eye className="h-4 w-4 text-red-400" />Safe template preview</div>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Render sample-only content. Preview never loads customer data and never sends an email.</p>
                  </div>
                  <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-1">
                    {(["transactional", "supabase_auth"] as const).map((source) => (
                      <button
                        key={source}
                        type="button"
                        onClick={() => changePreviewSource(source)}
                        className={`rounded-md px-3 py-2 text-xs font-black transition ${previewSource === source ? "bg-red-800/50 text-white" : "text-zinc-500 hover:text-white"}`}
                      >
                        {source === "transactional" ? "Platform mail" : "Supabase Auth"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_auto]">
                  <label className="min-w-0">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Template</span>
                    <select
                      value={previewTemplate}
                      onChange={(event) => { setPreviewTemplate(event.target.value); setPreview(null); }}
                      className="h-11 w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-sm font-bold outline-none focus:border-red-700"
                    >
                      {previewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Language</span>
                    <select
                      value={previewLanguage}
                      onChange={(event) => { setPreviewLanguage(event.target.value as TransactionalEmailLanguage); setPreview(null); }}
                      className="h-11 w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-3 text-sm font-bold outline-none focus:border-red-700"
                    >
                      {supportedLocales.map((locale) => (
                        <option key={locale.code} value={locale.code}>{locale.name}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={previewing || previewOptions.length === 0}
                    onClick={() => void loadPreview()}
                    className="mt-5 h-11 rounded-lg border border-red-700/50 bg-red-950/25 px-4 text-sm font-black text-red-100 transition hover:bg-red-900/30 disabled:opacity-50"
                  >
                    <Languages className="mr-2 inline h-4 w-4" />{previewing ? "Rendering..." : "Preview"}
                  </button>
                </div>

                {preview && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-white">
                    <div className="border-b border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-900">Subject: {preview.subject}</div>
                    <iframe
                      title="Email template preview"
                      sandbox=""
                      srcDoc={preview.html}
                      className="h-[560px] w-full bg-white"
                    />
                  </div>
                )}
              </section>

              <section className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-black"><Workflow className="h-4 w-4 text-red-400" />Lifecycle coverage</div>
                    <p className="mt-1 text-xs text-zinc-500">Meaningful status changes only; repeated saves and internal edits do not create customer mail.</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black text-zinc-400">{data.lifecycleCoverage.length} transitions</span>
                </div>
                <div className="mt-3 grid border-l border-t border-white/10 sm:grid-cols-2 xl:grid-cols-3">
                  {data.lifecycleCoverage.map((item) => (
                    <div key={`${item.source}:${item.status}`} className="border-b border-r border-white/10 p-3">
                      <div className="text-xs font-black">{labelToken(item.status)}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-zinc-500">{labelToken(item.source)}</div>
                      <div className="mt-2 text-[11px] text-red-300">{labelToken(item.eventType)}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-black">Templates</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {data.templates.map((template) => (
                    <div key={template.eventType} className="rounded-lg border border-white/10 bg-black/25 p-3">
                      <div className="text-sm font-black">{template.label}</div>
                      <div className="mt-1 text-xs text-zinc-500">{template.eventType}</div>
                      <div className="mt-2 inline-flex rounded-md border border-white/10 px-2 py-1 text-[10px] font-black uppercase text-zinc-400">{template.audience}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black">Provider delivery status</h2>
                    <p className="mt-1 text-xs text-zinc-500">Latest signed delivery event for each provider message.</p>
                  </div>
                  {!data.deliveryTrackingReady && <span className="rounded-full border border-amber-700/40 bg-amber-950/20 px-2 py-1 text-[10px] font-black uppercase text-amber-300">Migration required</span>}
                </div>
                <div className="mt-3 max-w-full overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <tr><th className="py-2 pr-3">Event</th><th className="py-2 pr-3">Recipient</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Reason</th><th className="py-2 pr-3">Updated</th></tr>
                    </thead>
                    <tbody>
                      {data.deliveryEvents.length === 0 && <tr><td colSpan={5} className="py-4 text-zinc-500">No signed provider delivery events logged yet.</td></tr>}
                      {data.deliveryEvents.map((event) => (
                        <tr key={String(event.provider_event_id)} className="border-t border-white/10">
                          <td className="py-3 pr-3 font-bold">{String(event.provider_event_type || "-")}</td>
                          <td className="py-3 pr-3 text-zinc-400">{String(event.recipient_email || "-")}</td>
                          <td className="py-3 pr-3"><StatusBadge value={String(event.delivery_status || "-")} /></td>
                          <td className="max-w-64 py-3 pr-3 text-xs text-zinc-500">{String(event.reason_message || event.reason_code || "-")}</td>
                          <td className="py-3 pr-3 text-zinc-500">{formatBerlinDate(event.occurred_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <h2 className="text-sm font-black">Application email log</h2>
                  <p className="mt-1 text-xs text-zinc-500">Idempotent platform send attempts, including dry-run and skipped events.</p>
                  <div className="mt-3 max-w-full overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                        <tr><th className="py-2 pr-3">Event</th><th className="py-2 pr-3">Recipient</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Created</th></tr>
                      </thead>
                      <tbody>
                        {data.recentEvents.length === 0 && <tr><td colSpan={4} className="py-4 text-zinc-500">No application email events logged yet.</td></tr>}
                        {data.recentEvents.map((event) => (
                          <tr key={String(event.id)} className="border-t border-white/10">
                            <td className="py-3 pr-3 font-bold">{String(event.event_type || "-")}</td>
                            <td className="py-3 pr-3 text-zinc-400">{String(event.recipient_email || "-")}</td>
                            <td className="py-3 pr-3"><StatusBadge value={String(event.delivery_status || event.status || "-")} /></td>
                            <td className="py-3 pr-3 text-zinc-500">{formatBerlinDate(event.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="min-w-0 overflow-hidden rounded-lg border border-sky-900/30 bg-sky-950/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-black">Suppressed recipients</h2>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">Hard bounces and complaints are not retried by the application email service.</p>
                    </div>
                    <span className="rounded-full border border-sky-700/40 px-2 py-1 text-[10px] font-black text-sky-300">{data.activeSuppressions.length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {data.activeSuppressions.length === 0 && <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-zinc-500">No active suppressions.</div>}
                    {data.activeSuppressions.map((suppression) => (
                      <div key={String(suppression.recipient_email)} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="break-all text-sm font-bold">{String(suppression.recipient_email)}</div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                          <span>{labelToken(String(suppression.reason || "suppressed"))}</span>
                          <span>{formatBerlinDate(suppression.last_event_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] ${tone}`}>
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}
      </div>
      <div className="mt-3 text-3xl font-black">{value}</div>
      <div className="mt-1 text-[11px] text-zinc-500">Recent event window</div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const tone = ["sent", "delivered"].includes(value)
    ? "border-emerald-700/40 bg-emerald-950/30 text-emerald-300"
    : ["failed", "bounced"].includes(value)
      ? "border-red-700/40 bg-red-950/30 text-red-300"
      : ["pending", "delayed"].includes(value)
        ? "border-amber-700/40 bg-amber-950/30 text-amber-300"
        : ["complained", "suppressed"].includes(value)
          ? "border-fuchsia-700/40 bg-fuchsia-950/30 text-fuchsia-300"
        : "border-sky-700/40 bg-sky-950/30 text-sky-300";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase ${tone}`}>{value}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-t border-white/10 py-2 text-sm first:border-t-0">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className="min-w-0 break-all text-right font-bold">{value}</span>
    </div>
  );
}

function CertificationMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-white/10 bg-black/25 p-3"><div className="text-lg font-black">{value}</div><div className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">{label}</div></div>;
}

function InfoTile({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-2.5"><div className="text-base font-black text-white">{value}</div><div className="mt-0.5 uppercase tracking-[0.1em] text-zinc-600">{label}</div></div>;
}
