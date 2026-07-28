"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Database,
  Download,
  FileCode2,
  FileDown,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  Wrench,
} from "lucide-react";
import { authenticatedFetch, getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import {
  adminWorkOrderStatuses,
  deliveryStatuses,
  finalFileStatuses,
  labelFromToken,
  paymentReviewStatuses,
  qualityCheckStatuses,
  tunerStatuses,
  workOrderNoteTypes,
  workOrderPriorities,
} from "@/lib/workOrders/types";
import type { ExpertRequestDtcAnalysis } from "@/lib/dtcAnalyzer/requestIntegration";
import type {
  DtcAnalyzerAdminConfigStatus,
  DtcAnalyzerUsageLimitPublicProjection,
} from "@/lib/dtcAnalyzer/config";

type DetailPayload = {
  migrationReady: boolean;
  order: Record<string, unknown> & { id: string };
  customer: Record<string, unknown> | null;
  workOrder: Record<string, unknown> | null;
  requestedServices: string[];
  requestMessages: Array<{
    id: string;
    sender_role: string;
    message: string;
    created_at: string;
    visibility_status?: "visible" | "hidden" | "archived";
    hidden_at?: string | null;
    hidden_reason?: string | null;
  }>;
  notes: Array<{
    id: string;
    note_type: string;
    body: string;
    pinned: boolean;
    customer_visible: boolean;
    visibility_status?: "visible" | "hidden" | "archived";
    hidden_at?: string | null;
    hidden_reason?: string | null;
    created_at: string;
  }>;
  events: Array<{ id: string; event_type: string; message: string | null; created_at: string; customer_visible: boolean }>;
  fileExpert: { linked: boolean; job: Record<string, unknown> | null; warning: string | null };
  aiEvidence: {
    trainingSamples: Array<Record<string, unknown>>;
    similarity: { count: number; maxScore: number | null };
    clusters: Array<Record<string, unknown>>;
    warnings: string[];
  };
  vehicleDb: {
    found: boolean;
    vehicleId: string | null;
    vehicleKey: string | null;
    warning: string | null;
    serviceCapabilityWarnings: string[];
  };
  payment: {
    creditTransactions: Array<Record<string, unknown>>;
    paymentRecords: Array<Record<string, unknown>>;
    summary: { creditsRequired: number; customerBalance: number | null; paymentStatus: string };
  };
  qualityChecklist: Array<{ key: string; label: string; ok: boolean; detail: string }>;
};

type ModifiedFile = {
  id?: string;
  label?: string;
  file_name?: string;
  file_path?: string;
  uploaded_at?: string;
};

const WORK_ORDER_READ_ONLY_FALLBACK_MESSAGE =
  "Work Order migration is missing. This fallback view is read-only until the SQL migration is available.";

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "-";
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function badgeClass(value: unknown) {
  if (value === "completed" || value === "delivered" || value === "paid" || value === "passed" || value === "approved") {
    return "border-emerald-700/40 bg-emerald-950/25 text-emerald-300";
  }
  if (value === "urgent" || value === "needs_review" || value === "requires_review" || value === "failed" || value === "blocked") {
    return "border-red-700/50 bg-red-950/35 text-red-200";
  }
  if (value === "high" || value === "payment_review" || value === "quality_check" || value === "pending") {
    return "border-amber-700/40 bg-amber-950/25 text-amber-200";
  }
  if (value === "in_progress" || value === "in_analysis" || value === "file_received" || value === "working") {
    return "border-blue-700/40 bg-blue-950/25 text-blue-300";
  }
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function parseModifiedFiles(value: unknown): ModifiedFile[] {
  return Array.isArray(value) ? value.filter((item): item is ModifiedFile => Boolean(item && typeof item === "object")) : [];
}

export default function WorkOrderDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params?.id;
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState("internal");
  const [dtcAnalysis, setDtcAnalysis] = useState<ExpertRequestDtcAnalysis | null>(null);
  const [dtcLoading, setDtcLoading] = useState(false);
  const [dtcError, setDtcError] = useState("");
  const [dtcConfiguration, setDtcConfiguration] =
    useState<DtcAnalyzerAdminConfigStatus | null>(null);
  const [dtcLimit, setDtcLimit] =
    useState<DtcAnalyzerUsageLimitPublicProjection | null>(null);
  const readOnlyFallback = payload?.migrationReady === false;

  function blockReadOnlyFallback() {
    if (!readOnlyFallback) return false;
    setMessage(WORK_ORDER_READ_ONLY_FALLBACK_MESSAGE);
    return true;
  }

  async function token() {
    const { session } = await getStableSession();
    const user = session?.user;
    if (!user) {
      notifySessionRequired();
      return null;
    }
    if (await signOutIfEmailUnverified(user)) {
      router.push("/login?verify_email=1");
      return null;
    }
    return session.access_token ?? null;
  }

  async function load() {
    if (!requestId) return;
    setLoading(true);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) {
      setMessage("Your secure session has ended. Please log in again.");
      setLoading(false);
      return;
    }
    const response = await authenticatedFetch(`/api/admin/requests/${requestId}`, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Work order could not be loaded.");
      setLoading(false);
      return;
    }
    setPayload(result);
    setLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function patchWorkOrder(patch: Record<string, unknown>) {
    if (!requestId) return;
    if (blockReadOnlyFallback()) return;
    setSaving(true);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) {
      setSaving(false);
      return;
    }
    const response = await authenticatedFetch(`/api/admin/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Work order update failed.");
      setSaving(false);
      return;
    }
    setPayload((current) => current ? { ...current, workOrder: result.workOrder } : current);
    setSaving(false);
    await load();
  }

  async function addNote() {
    if (!requestId || !noteBody.trim()) return;
    if (blockReadOnlyFallback()) return;
    setSaving(true);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) {
      setSaving(false);
      return;
    }
    const response = await authenticatedFetch(`/api/admin/requests/${requestId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_type: noteType, body: noteBody, pinned: noteType === "pinned" }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Note could not be saved.");
      setSaving(false);
      return;
    }
    setNoteBody("");
    setSaving(false);
    await load();
  }

  async function updateCustomerMessageVisibility(messageId: string, action: "hide" | "restore") {
    if (!requestId) return;
    if (blockReadOnlyFallback()) return;
    const confirmed = window.confirm(
      action === "hide"
        ? "Hide this message from the customer? The message will remain visible to admins and the action will be logged."
        : "Restore this message to the customer chat? The action will be logged."
    );
    if (!confirmed) return;
    const reason = action === "hide"
      ? window.prompt("Reason for hiding this message:", "Production smoke test cleanup")
      : window.prompt("Reason for restoring this message:", "Admin restored message");
    if (reason === null) return;

    setSaving(true);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) {
      setSaving(false);
      return;
    }
    const response = await authenticatedFetch(`/api/admin/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_visibility: { message_id: messageId, action, reason } }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Message visibility could not be updated.");
      setSaving(false);
      return;
    }
    setMessage(action === "hide" ? "Message hidden from customer." : "Message restored to customer.");
    setSaving(false);
    await load();
  }

  async function toggleCustomerUpload(enabled: boolean) {
    if (!requestId) return;
    if (blockReadOnlyFallback()) return;
    setSaving(true);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) {
      setSaving(false);
      return;
    }
    const response = await authenticatedFetch(`/api/admin/orders/${requestId}/upload-permission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Customer upload permission could not be updated.");
      setSaving(false);
      return;
    }
    setMessage(enabled ? "Customer can upload one additional file for this request." : "Customer upload permission disabled.");
    setSaving(false);
    await load();
  }

  async function downloadPrivateFile(path: unknown) {
    if (typeof path !== "string" || !path) {
      setMessage("File path is not available.");
      return;
    }
    const { data, error } = await supabase.storage.from("customer-files").createSignedUrl(path, 60);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function loadDtcAnalysis() {
    if (!requestId || dtcLoading) return;
    setDtcLoading(true);
    setDtcError("");
    setDtcLimit(null);
    const accessToken = await token();
    if (!accessToken) {
      setDtcLoading(false);
      return;
    }
    try {
      const response = await authenticatedFetch(`/api/admin/requests/${requestId}/dtc-analysis`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        setDtcConfiguration(result.configuration ?? null);
        setDtcLimit(result.limit ?? null);
        setDtcError(result.error || "DTC expert review could not be prepared.");
        return;
      }
      setDtcAnalysis(result.analysis);
      setDtcConfiguration(result.analysis.configuration ?? null);
      await load();
    } catch {
      setDtcError("DTC expert review could not be prepared.");
    } finally {
      setDtcLoading(false);
    }
  }

  const modifiedFiles = useMemo(() => parseModifiedFiles(payload?.order.modified_files), [payload]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 text-sm font-bold text-zinc-300">
          <Loader2 className="mr-2 inline h-5 w-5 animate-spin text-red-500" />
          Loading work order...
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white">
        <div className="max-w-md rounded-[2rem] border border-red-900/40 bg-red-950/20 p-8 text-center">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="text-3xl font-black">Work order unavailable</h1>
          <p className="mt-3 text-sm text-zinc-400">{message || "This request could not be loaded."}</p>
          <Link href="/admin/requests" className="mt-6 inline-flex rounded-xl bg-[#b1121b] px-5 py-3 font-black">Back to requests</Link>
        </div>
      </main>
    );
  }

  const order = payload.order;
  const workOrder = payload.workOrder ?? {};
  const customer = payload.customer;
  const customerAdminNote = typeof customer?.internal_admin_note === "string" && customer.internal_admin_note.trim()
    ? customer.internal_admin_note
    : "";

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(180,18,28,0.22),transparent_34%),linear-gradient(135deg,#050505,#101012_52%,#170507)]" />
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link href="/admin/requests" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Request Control Center
            </Link>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-red-800/40 bg-red-950/25 px-3 py-1 text-xs font-black text-red-200">Work Order #{shortId(order.id)}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(workOrder.priority)}`}>{labelFromToken(String(workOrder.priority ?? "normal"))}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(workOrder.admin_status)}`}>{labelFromToken(String(workOrder.admin_status ?? order.status ?? "new"))}</span>
            </div>
            <h1 className="break-words text-4xl font-black md:text-5xl">
              {text(order.vehicle_brand)} <span className="text-red-600">{text(order.vehicle_model)}</span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              {text(order.vehicle_generation)} - {text(order.vehicle_engine)} - Created {formatDate(order.created_at)}
            </p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap lg:justify-end">
            <button onClick={load} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black hover:bg-white/10">
              <RefreshCcw className="mr-2 inline h-4 w-4" /> Refresh
            </button>
            <button onClick={() => patchWorkOrder({ admin_status: "in_progress", tuner_status: "working" })} disabled={saving || readOnlyFallback} title={readOnlyFallback ? WORK_ORDER_READ_ONLY_FALLBACK_MESSAGE : undefined} className="rounded-xl bg-[#b1121b] px-4 py-3 text-sm font-black hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Wrench className="mr-2 inline h-4 w-4" />}
              Start Work
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {message && <div className="mb-5 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">{message}</div>}
        {!payload.migrationReady && (
          <div className="mb-5 rounded-2xl border border-amber-700/40 bg-amber-950/25 p-4 text-sm text-amber-100">
            Work Order migration is missing. This page is showing read-only fallback data; notes, customer message visibility, upload permissions and status actions require the SQL migration.
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center gap-3"><User className="h-7 w-7 text-red-400" /><h2 className="text-2xl font-black">Customer</h2></div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Info label="Customer ID" value={customer?.customer_id ?? order.customer_id} />
                <Info label="Name / Company" value={customer?.company_name ?? customer?.full_name} />
                <Info label="Email" value={customer?.email ?? order.customer_email} />
                <Info label="Phone" value={customer?.phone} />
              </div>
              {customerAdminNote && <Warning title="Admin customer warning" text={customerAdminNote} />}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center gap-3"><Car className="h-7 w-7 text-red-400" /><h2 className="text-2xl font-black">Vehicle & ECU</h2></div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Info label="Brand" value={order.vehicle_brand} />
                <Info label="Model" value={order.vehicle_model} />
                <Info label="Generation" value={order.vehicle_generation} />
                <Info label="Engine" value={order.vehicle_engine} />
                <Info label="Year" value={order.vehicle_year} />
                <Info label="ECU / TCU" value={order.ecu} />
                <Info label="Gearbox" value={order.gearbox} />
                <Info label="Read method" value={order.read_method} />
                <Info label="HW / SW" value={order.hw_sw} />
                <Info label="Master / Slave" value={order.master_slave} />
                <Info label="Vehicle DB" value={payload.vehicleDb.found ? payload.vehicleDb.vehicleKey || "Matched" : "No match"} />
                <Info label="Source" value={payload.vehicleDb.found ? "Vehicle DB candidate" : "Request data / legacy"} />
              </div>
              {payload.vehicleDb.found && payload.vehicleDb.vehicleId && (
                <Link href={`/admin/vehicles/${payload.vehicleDb.vehicleId}`} className="mt-4 inline-flex rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black hover:bg-white/10">
                  <Database className="mr-2 h-4 w-4" /> Open Vehicle DB record
                </Link>
              )}
              {payload.vehicleDb.warning && <Warning title="Vehicle DB note" text={payload.vehicleDb.warning} />}
              {payload.vehicleDb.serviceCapabilityWarnings.map((warning) => <Warning key={warning} title="Service capability warning" text={warning} />)}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3"><ClipboardCheck className="h-7 w-7 text-red-400" /><h2 className="text-2xl font-black">Services</h2></div>
                <span className="rounded-xl border border-red-800/40 bg-red-950/25 px-3 py-2 text-xs font-black text-red-200">{Number(order.credits_required ?? 0)} credits</span>
              </div>
              {payload.requestedServices.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {payload.requestedServices.map((service) => <div key={service} className="rounded-2xl border border-emerald-700/30 bg-emerald-950/15 p-4 font-black text-emerald-100">{service}</div>)}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm text-zinc-400">No structured service label. Raw value: {text(order.service_type)}</div>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center gap-3"><FileDown className="h-7 w-7 text-red-400" /><h2 className="text-2xl font-black">Files</h2></div>
              <div className="grid gap-3 md:grid-cols-2">
                <FileCard title="Original file" ready={Boolean(order.original_file_path)} fileName={text(order.uploaded_file_name)} onDownload={() => downloadPrivateFile(order.original_file_path)} />
                <FileCard title="Legacy latest modified" ready={Boolean(order.modified_file_path)} fileName={order.modified_file_path ? "Stored privately" : "Not delivered"} onDownload={() => downloadPrivateFile(order.modified_file_path)} />
              </div>
              {modifiedFiles.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {modifiedFiles.map((file, index) => (
                    <FileCard key={file.id || `${file.file_name}-${index}`} title={`Delivered ${labelFromToken(file.label || "file")}`} ready fileName={file.file_name || "Modified file"} onDownload={() => downloadPrivateFile(file.file_path)} />
                  ))}
                </div>
              )}
              <div className="mt-4 rounded-2xl border border-blue-700/30 bg-blue-950/15 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-black text-blue-100">Additional customer upload</div>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      Enable one extra customer upload when another read, log or supporting file is needed.
                    </p>
                  </div>
                  <button
                    onClick={() => toggleCustomerUpload(!Boolean(order.customer_upload_enabled))}
                    disabled={saving || readOnlyFallback}
                    title={readOnlyFallback ? WORK_ORDER_READ_ONLY_FALLBACK_MESSAGE : undefined}
                    className="shrink-0 rounded-xl border border-blue-700/40 bg-blue-950/30 px-4 py-3 text-sm font-black text-blue-100 hover:bg-blue-900/35 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="mr-2 inline h-4 w-4" />
                    {order.customer_upload_enabled ? "Disable upload" : "Enable upload"}
                  </button>
                </div>
                <div className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-blue-300">
                  Current state: {order.customer_upload_enabled ? "enabled for customer" : "disabled"}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Panel title="File Expert" icon={<FileCode2 />}>
                {payload.fileExpert.job ? (
                  <div className="space-y-3">
                    <Info label="Status" value={payload.fileExpert.job.status} />
                    <Info label="Confidence" value={payload.fileExpert.job.confidence_score != null ? `${payload.fileExpert.job.confidence_score}%` : "-"} />
                    <Info label="Risk level" value={payload.fileExpert.job.risk_level} />
                    <p className="rounded-2xl bg-black/25 p-4 text-sm leading-6 text-zinc-300">{text(payload.fileExpert.job.executive_summary)}</p>
                  </div>
                ) : <Empty text={payload.fileExpert.warning || "No File Expert job linked."} />}
              </Panel>
              <Panel title="AI Evidence" icon={<BrainCircuit />}>
                <div className="grid gap-3">
                  <Info label="Training samples" value={payload.aiEvidence.trainingSamples.length} />
                  <Info label="Similarity runs" value={payload.aiEvidence.similarity.count} />
                  <Info label="Best similarity" value={payload.aiEvidence.similarity.maxScore == null ? "-" : `${payload.aiEvidence.similarity.maxScore}%`} />
                  <Info label="Cluster memberships" value={payload.aiEvidence.clusters.length} />
                </div>
                {payload.aiEvidence.warnings.map((warning) => <Warning key={warning} title="Evidence warning" text={warning} />)}
                <p className="mt-4 rounded-2xl border border-amber-700/30 bg-amber-950/15 p-4 text-xs leading-5 text-amber-100">
                  Evidence-only. Human tuner verification and checksum validation are required before any real file delivery.
                </p>
              </Panel>
            </section>

            <DtcExpertReviewPanel
              analysis={dtcAnalysis}
              configuration={dtcConfiguration ?? dtcAnalysis?.configuration ?? null}
              limit={dtcLimit}
              loading={dtcLoading}
              error={dtcError}
              onRun={() => { void loadDtcAnalysis(); }}
            />

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center gap-3"><MessageSquare className="h-7 w-7 text-red-400" /><h2 className="text-2xl font-black">Internal & Customer Notes</h2></div>
              <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
                <select value={noteType} onChange={(event) => setNoteType(event.target.value)} disabled={readOnlyFallback} className="h-12 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-black outline-none disabled:cursor-not-allowed disabled:opacity-50">
                  {workOrderNoteTypes.map((item) => <option key={item} value={item} className="bg-[#111]">{labelFromToken(item)}</option>)}
                </select>
                <input value={noteBody} onChange={(event) => setNoteBody(event.target.value)} disabled={readOnlyFallback} placeholder="Add internal, tuner, pinned or customer-visible note..." className="h-12 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-bold outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50" />
                <button onClick={addNote} disabled={saving || readOnlyFallback || !noteBody.trim()} title={readOnlyFallback ? WORK_ORDER_READ_ONLY_FALLBACK_MESSAGE : undefined} className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black hover:bg-[#c91824] disabled:cursor-not-allowed disabled:opacity-50">
                  <Save className="mr-2 inline h-4 w-4" /> Add note
                </button>
              </div>
              <div className="mt-5 grid gap-3">
                {payload.notes.length === 0 ? <Empty text="No internal notes yet." /> : payload.notes.map((note) => {
                  const hiddenNote = note.visibility_status === "hidden" || note.visibility_status === "archived";
                  return (
                  <div key={note.id} className={`rounded-2xl border p-4 ${hiddenNote ? "border-amber-700/40 bg-amber-950/20" : note.customer_visible ? "border-blue-700/30 bg-blue-950/15" : note.pinned ? "border-amber-700/30 bg-amber-950/15" : "border-white/10 bg-black/25"}`}>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black">
                      <span className={`rounded-full border px-2 py-1 ${badgeClass(note.note_type)}`}>{labelFromToken(note.note_type)}</span>
                      {hiddenNote && <span className="rounded-full border border-amber-700/40 bg-amber-950/30 px-2 py-1 text-amber-200">Hidden from customer</span>}
                      <span className="text-zinc-500">{formatDate(note.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{note.body}</p>
                    {hiddenNote && (
                      <p className="mt-3 rounded-xl border border-amber-700/30 bg-black/20 p-3 text-xs leading-5 text-amber-100">
                        Hidden {formatDate(note.hidden_at)}{note.hidden_reason ? ` - ${note.hidden_reason}` : ""}
                      </p>
                    )}
                  </div>
                );})}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center gap-3"><Clock3 className="h-7 w-7 text-red-400" /><h2 className="text-2xl font-black">Status Timeline & Audit</h2></div>
              <div className="space-y-3">
                {payload.events.length === 0 ? <Empty text="No work-order events yet." /> : payload.events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="break-words font-black">{labelFromToken(event.event_type)}</div>
                        <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-black ${event.customer_visible ? "border-blue-700/40 bg-blue-950/30 text-blue-100" : "border-zinc-700/60 bg-zinc-950/50 text-zinc-300"}`}>
                          {event.customer_visible ? <User className="h-3.5 w-3.5 shrink-0" /> : <ShieldCheck className="h-3.5 w-3.5 shrink-0" />}
                          {event.customer_visible ? "Customer-visible" : "Internal-only"}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">{formatDate(event.created_at)}</div>
                    </div>
                    <p className="mt-2 break-words text-sm text-zinc-400">{event.message || (event.customer_visible ? "Customer-visible event" : "Internal admin event")}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <Panel title="Actions" icon={<Sparkles />}>
              {readOnlyFallback && (
                <p className="mb-4 rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100">
                  {WORK_ORDER_READ_ONLY_FALLBACK_MESSAGE}
                </p>
              )}
              <ActionSelect disabled={readOnlyFallback} label="Admin status" value={String(workOrder.admin_status ?? "new")} options={adminWorkOrderStatuses} onChange={(value) => patchWorkOrder({ admin_status: value })} />
              <ActionSelect disabled={readOnlyFallback} label="Priority" value={String(workOrder.priority ?? "normal")} options={workOrderPriorities} onChange={(value) => patchWorkOrder({ priority: value })} />
              <ActionSelect disabled={readOnlyFallback} label="Tuner status" value={String(workOrder.tuner_status ?? "unassigned")} options={tunerStatuses} onChange={(value) => patchWorkOrder({ tuner_status: value })} />
              <ActionSelect disabled={readOnlyFallback} label="Payment review" value={String(workOrder.payment_review_status ?? "not_checked")} options={paymentReviewStatuses} onChange={(value) => patchWorkOrder({ payment_review_status: value })} />
              <ActionSelect disabled={readOnlyFallback} label="Quality check" value={String(workOrder.quality_check_status ?? "pending")} options={qualityCheckStatuses} onChange={(value) => patchWorkOrder({ quality_check_status: value })} />
              <ActionSelect disabled={readOnlyFallback} label="Delivery" value={String(workOrder.delivery_status ?? "not_ready")} options={deliveryStatuses} onChange={(value) => patchWorkOrder({ delivery_status: value })} />
              <ActionSelect disabled={readOnlyFallback} label="Final file" value={String(workOrder.final_file_status ?? "not_ready")} options={finalFileStatuses} onChange={(value) => patchWorkOrder({ final_file_status: value })} />
              {saving && <div className="mt-3 text-xs text-zinc-500"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Saving...</div>}
            </Panel>

            <Panel title="Payment / Credits" icon={<CreditCard />}>
              <Info label="Credits required" value={payload.payment.summary.creditsRequired} />
              <Info label="Customer balance" value={payload.payment.summary.customerBalance ?? "-"} />
              <Info label="Payment status" value={payload.payment.summary.paymentStatus} />
              <Info label="Payment records" value={payload.payment.paymentRecords.length} />
              <Info label="Credit ledger rows" value={payload.payment.creditTransactions.length} />
              <p className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-5 text-zinc-500">
                Read-only summary. This screen does not mutate payments, credits or refunds.
              </p>
            </Panel>

            <Panel title="Quality Checklist" icon={<ClipboardCheck />}>
              <div className="space-y-3">
                {payload.qualityChecklist.map((item) => (
                  <div key={item.key} className={`rounded-2xl border p-4 ${item.ok ? "border-emerald-700/30 bg-emerald-950/15" : "border-amber-700/30 bg-amber-950/15"}`}>
                    <div className="flex items-center gap-2 font-black">
                      {item.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}
                      {item.label}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">{item.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Customer Messages" icon={<MessageSquare />}>
              <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                {payload.requestMessages.length === 0 ? <Empty text="No customer messages yet." /> : payload.requestMessages.map((entry) => {
                  const hidden = entry.visibility_status === "hidden" || entry.visibility_status === "archived";
                  return (
                  <div key={entry.id} className={`rounded-2xl border p-4 ${hidden ? "border-amber-700/40 bg-amber-950/20" : entry.sender_role === "admin" ? "border-blue-700/30 bg-blue-950/15" : "border-white/10 bg-black/25"}`}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      <span>{entry.sender_role} - {formatDate(entry.created_at)}</span>
                      {hidden && <span className="rounded-full border border-amber-700/40 bg-amber-950/30 px-2 py-1 text-amber-200">Hidden from customer</span>}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{entry.message}</p>
                    {hidden && (
                      <p className="mt-3 rounded-xl border border-amber-700/30 bg-black/20 p-3 text-xs leading-5 text-amber-100">
                        Hidden {formatDate(entry.hidden_at)}{entry.hidden_reason ? ` - ${entry.hidden_reason}` : ""}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => updateCustomerMessageVisibility(entry.id, hidden ? "restore" : "hide")}
                      disabled={saving || readOnlyFallback}
                      title={readOnlyFallback ? WORK_ORDER_READ_ONLY_FALLBACK_MESSAGE : undefined}
                      className={`mt-3 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${
                        hidden
                          ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-200 hover:bg-emerald-900/30"
                          : "border-amber-700/40 bg-amber-950/20 text-amber-100 hover:bg-amber-900/30"
                      }`}
                    >
                      {hidden ? "Restore to customer" : "Hide from customer"}
                    </button>
                  </div>
                );})}
              </div>
            </Panel>
          </aside>
        </div>
      </section>
    </main>
  );
}

function DtcExpertReviewPanel({
  analysis,
  configuration,
  limit,
  loading,
  error,
  onRun,
}: {
  analysis: ExpertRequestDtcAnalysis | null;
  configuration: DtcAnalyzerAdminConfigStatus | null;
  limit: DtcAnalyzerUsageLimitPublicProjection | null;
  loading: boolean;
  error: string;
  onRun: () => void;
}) {
  return (
    <Panel title="DTC Expert Review" icon={<BrainCircuit />}>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <p className="text-sm leading-6 text-zinc-400">
          Request-level DTC analysis uses existing request fields only. It never approves file edits, checksum work or customer-ready output.
        </p>
        <button
          type="button"
          onClick={onRun}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex items-center justify-center rounded-xl border border-red-800/40 bg-red-950/25 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          {analysis ? "Refresh DTC review" : "Run DTC review"}
        </button>
      </div>

      {loading && (
        <div role="status" aria-live="polite" className="rounded-2xl border border-blue-700/30 bg-blue-950/15 p-4 text-sm text-blue-100">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Preparing expert DTC review...
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-100">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {error}
          <button type="button" onClick={onRun} className="ml-3 font-black underline decoration-red-400 underline-offset-4">
            Retry
          </button>
        </div>
      )}

      {limit && (
        <Warning
          title="Usage limit state"
          text={`${limit.statusLabel}${
            limit.retryAfterSeconds ? ` Retry after ${limit.retryAfterSeconds} seconds.` : ""
          }`}
        />
      )}

      {!analysis && !loading && !error && <Empty text="No DTC expert review has been generated for this request yet." />}

      {(analysis || configuration) && (
        <div aria-live="polite" className="space-y-5">
          {configuration && (
            <div className="rounded-2xl border border-blue-700/30 bg-blue-950/15 p-4">
              <div className="mb-3 text-sm font-black text-blue-100">DTC analyzer configuration</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Provider availability" value={configuration.provider.availabilityLabel} />
                <Info label="Fallback mode" value={configuration.fallback.modeLabel} />
                <Info
                  label="Usage limit"
                  value={`${configuration.usageLimits.requestsPerWindow} requests / ${Math.ceil(configuration.usageLimits.windowSeconds / 60)} min`}
                />
                <Info
                  label="Text and code limits"
                  value={`${configuration.usageLimits.maxRequestTextLength} request chars, ${configuration.usageLimits.maxAnalyzedTextLength} analyzed chars, ${configuration.usageLimits.maxCodesPerRequest} DTC codes`}
                />
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-blue-100">
                Failure handling: {configuration.failureHandling[0]}
              </div>
            </div>
          )}

          {analysis && (
            <>
          <div className="grid gap-3 md:grid-cols-4">
            <Info label="State" value={analysis.stateLabel} />
            <Info label="Provider status" value={analysis.provider.providerStatus} />
            <Info label="Provider kind" value={analysis.provider.providerKind} />
            <Info label="Fallback" value={analysis.fallback.used ? "used" : "not used"} />
            <Info label="Confidence" value={analysis.confidence} />
            <Info label="Detected DTCs" value={analysis.detectedCodes.length > 0 ? analysis.detectedCodes.join(", ") : "None"} />
            <Info label="Rejected token count" value={analysis.rejectedCodeLikeTokenCount} />
            <Info label="AI generated" value={analysis.isAiGenerated ? "yes" : "no"} />
          </div>

          {analysis.fallback.reason && (
            <Warning title="Fallback reason" text={analysis.fallback.reason} />
          )}

          <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-300">
            {analysis.summary}
          </p>

          {analysis.codes.length > 0 ? (
            <div className="grid gap-4">
              {analysis.codes.map((code) => (
                <div key={code.code} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xl border border-red-800/40 bg-red-950/30 px-3 py-1 text-sm font-black text-red-100">{code.code}</span>
                    <span className={`rounded-xl border px-3 py-1 text-xs font-black ${badgeClass(code.confidence)}`}>{code.confidence}</span>
                    <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-300">{code.standardizationLabel}</span>
                  </div>
                  <h3 className="mt-4 break-words text-lg font-black text-white">{code.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{code.customerExplanation}</p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div>
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Evidence</div>
                      <ul className="space-y-2 text-sm leading-6 text-zinc-300">
                        {code.evidence.map((item) => <li key={item.id}>- {item.severity}: {item.text}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Risk Flags</div>
                      <ul className="space-y-2 text-sm leading-6 text-zinc-300">
                        {code.riskFlags.map((item) => <li key={item.id}>- {item.kind}: {item.text}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Recommendations</div>
                      <ul className="space-y-2 text-sm leading-6 text-zinc-300">
                        {code.recommendations.map((item) => <li key={item.id}>- {item.category}: {item.text}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No valid DTC code was detected in the current request fields." />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-2 text-sm font-black text-white">Missing Information</div>
              <ul className="space-y-2 text-sm leading-6 text-zinc-400">
                {analysis.missingInformation.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-2 text-sm font-black text-white">Safety Boundaries</div>
              <ul className="space-y-2 text-sm leading-6 text-zinc-400">
                {analysis.safetyBoundaries.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-950/40 text-red-400">{icon}</div>
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-2 break-words font-black text-white">{text(value)}</div>
    </div>
  );
}

function Warning({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-100">
      <AlertTriangle className="mr-2 inline h-4 w-4" />
      <span className="font-black">{title}:</span> {text}
    </div>
  );
}

function Empty({ text: value }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-zinc-500">{value}</div>;
}

function FileCard({ title, ready, fileName, onDownload }: { title: string; ready: boolean; fileName: string; onDownload: () => void }) {
  return (
    <div className={`rounded-2xl border p-4 ${ready ? "border-emerald-700/30 bg-emerald-950/15" : "border-white/10 bg-black/25"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-black">{title}</div>
          <div className="mt-1 break-all text-xs text-zinc-500">{fileName}</div>
        </div>
        {ready ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Clock3 className="h-5 w-5 text-zinc-500" />}
      </div>
      <button onClick={onDownload} disabled={!ready} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
        <Download className="mr-2 inline h-4 w-4" />Download
      </button>
    </div>
  );
}

function ActionSelect<T extends readonly string[]>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: T;
  onChange: (value: T[number]) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mb-3 block">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <select value={value} onChange={(event) => onChange(event.target.value as T[number])} disabled={disabled} title={disabled ? WORK_ORDER_READ_ONLY_FALLBACK_MESSAGE : undefined} className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-black outline-none focus:border-red-700 disabled:cursor-not-allowed disabled:opacity-50">
        {options.map((option) => <option key={option} value={option} className="bg-[#111]">{labelFromToken(option)}</option>)}
      </select>
    </label>
  );
}
