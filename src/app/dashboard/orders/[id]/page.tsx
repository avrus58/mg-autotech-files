"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authenticatedFetch, getStableSession, notifySessionRequired, signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import RequestChat from "@/components/RequestChat";
import workspaceStyles from "./order-workspace.module.css";
import { formatFileVersionLabel } from "@/lib/fileVersionLabels";
import type { CustomerRequestDtcAnalysis } from "@/lib/dtcAnalyzer/requestIntegration";
import type { CustomerDeliveryHistory } from "@/lib/customerOrderDelivery";
import { customerWorkflowT } from "@/lib/i18n/customer-workflow-orders-translations";
import { localizeCustomerOrderStatus } from "@/lib/i18n/customer-runtime-translations";
import {
  localizeDtcAnalyzerMessage,
  localizeDtcConfidence,
} from "@/lib/i18n/dtc-analyzer-translations";
import { intlLocaleByCode, type LocaleCode } from "@/lib/i18nConfig";
import { useActiveLocale } from "@/lib/useActiveLocale";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  CopyPlus,
  Database,
  Download,
  FileCode2,
  FileDown,
  Gauge,
  Loader2,
  Mail,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  Upload,
  User,
  Wrench,
} from "lucide-react";

type Order = {
  id: string;
  customer_email: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  credits_required: number | string | null;
  status: string | null;
  notes: string | null;
  ecu: string | null;
  gearbox: string | null;
  vehicle_year: string | null;
  read_method: string | null;
  license_plate: string | null;
  hw_sw: string | null;
  master_slave: string | null;
  uploaded_file_name: string | null;
  estimated_delivery_label: DeliveryEstimate | null;
  estimated_delivery_note: string | null;
  customer_upload_enabled?: boolean | null;
  customer_uploads?: CustomerUpload[] | null;
  created_at: string;
};

type CustomerUpload = {
  id: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
};

type DeliveryEstimate = "usually_30_min" | "same_day" | "24h" | "48h" | "manual_review";

type AdditionalUploadPhase = "idle" | "preparing" | "uploading" | "verifying";

const additionalUploadSteps: Array<{
  phase: Exclude<AdditionalUploadPhase, "idle">;
  label: string;
  description: string;
}> = [
  {
    phase: "preparing",
    label: "Preparing upload",
    description: "Creating the secure upload slot.",
  },
  {
    phase: "uploading",
    label: "Uploading file",
    description: "Transferring the selected file.",
  },
  {
    phase: "verifying",
    label: "Verifying upload",
    description: "Saving it to this request.",
  },
];

function getStatusStyle(status: string | null) {
  const value = status?.toLowerCase() ?? "new_request";

  if (value.includes("completed")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (value.includes("progress")) {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  if (value.includes("file_check")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  if (value.includes("customer_info_needed")) {
    return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  }

  if (value.includes("revision")) {
    return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  }

  if (value.includes("cancel")) {
    return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  }

  return "border-red-700/40 bg-red-950/30 text-red-300";
}

function getCustomerStatusCopy(
  order: Order,
  completedFileReady: boolean,
  revisionRequested: boolean
) {
  if (revisionRequested) {
    return {
      title: "Revision waiting for review",
      description:
        "MG AutoTech has received your revision note and will publish the next file version here when it is ready.",
      iconClass: "text-purple-300",
    };
  }

  if (completedFileReady) {
    return {
      title: "Completed file ready",
      description:
        "Your delivered file is available in the Files & delivery panel through a secure temporary download link.",
      iconClass: "text-emerald-300",
    };
  }

  if (order.status === "customer_info_needed") {
    return {
      title: "Your response is needed",
      description:
        "MG AutoTech needs more information or another file. Use the conversation and upload areas below to respond.",
      iconClass: "text-orange-300",
    };
  }

  if (order.status === "in_progress") {
    return {
      title: "Work is in progress",
      description:
        "Your request is being processed. Status and delivery updates will appear here automatically.",
      iconClass: "text-blue-300",
    };
  }

  if (order.status === "file_check") {
    return {
      title: "File review in progress",
      description:
        "MG AutoTech is checking the original file, vehicle details and requested service before processing.",
      iconClass: "text-amber-300",
    };
  }

  if (order.status === "cancelled" || order.status === "canceled") {
    return {
      title: "Request closed",
      description:
        "This request is no longer in the active work queue. Contact MG AutoTech support if you need clarification or a new request.",
      iconClass: "text-zinc-300",
    };
  }

  return {
    title: "Request received",
    description:
      "Your order is in the secure MG AutoTech workflow and is waiting for its next review step.",
    iconClass: "text-red-300",
  };
}

function formatDate(date: string | null, locale: LocaleCode) {
  if (!date) return "-";

  return new Intl.DateTimeFormat(intlLocaleByCode[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(new Date(date));
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function buildCustomerSupportSummary(order: Order | null, fallbackId: string, locale: LocaleCode) {
  if (!order) return "";

  const vehicleSummary = [
    order.vehicle_brand,
    order.vehicle_model,
    order.vehicle_generation,
    order.vehicle_engine,
  ]
    .filter(Boolean)
    .join(" ");

  return customerWorkflowT(locale, "supportSummary", {
    requestId: shortId(order.id || fallbackId),
    status: localizeCustomerOrderStatus(locale, order.status),
    vehicle: vehicleSummary || customerWorkflowT(locale, "vehicleNotSet", {}),
    service: order.service_type || customerWorkflowT(locale, "serviceNotSet", {}),
    created: formatDate(order.created_at, locale),
  });
}

const deliveryEstimateLabels: Record<DeliveryEstimate, string> = {
  usually_30_min: "Usually around 30 min",
  same_day: "Same day",
  "24h": "24h",
  "48h": "48h",
  manual_review: "Manual review",
};

function getDeliveryEstimateDisplay(value: DeliveryEstimate | string | null) {
  const label = value ? deliveryEstimateLabels[value as DeliveryEstimate] : null;

  return {
    isExplicit: Boolean(label),
    label: label ?? "Estimate not set yet",
  };
}

type TimelineStep = {
  key: "new_request" | "file_check" | "customer_info_needed" | "in_progress" | "completed" | "revision";
  label: string;
  description: string;
};

const timelineStepDefinitions = {
  newRequest: {
    key: "new_request",
    label: "Request Created",
    description: "Your file request has been created.",
  },
  fileCheck: {
    key: "file_check",
    label: "File Check",
    description: "MG AutoTech checks your original file and vehicle data.",
  },
  customerInfoNeeded: {
    key: "customer_info_needed",
    label: "Waiting for Your Information",
    description: "MG AutoTech needs details from you before work can continue.",
  },
  inProgress: {
    key: "in_progress",
    label: "In Progress",
    description: "Your file is being prepared by MG AutoTech.",
  },
  completed: {
    key: "completed",
    label: "Completed",
    description: "Your modified file is ready to download.",
  },
  revision: {
    key: "revision",
    label: "Revision Review",
    description: "Your revision request is being reviewed after delivery.",
  },
} satisfies Record<string, TimelineStep>;

function getTimelineSteps(order: Order) {
  const status = order.status ?? "new_request";

  return [
    timelineStepDefinitions.newRequest,
    timelineStepDefinitions.fileCheck,
    ...(status === "customer_info_needed"
      ? [timelineStepDefinitions.customerInfoNeeded]
      : []),
    timelineStepDefinitions.inProgress,
    timelineStepDefinitions.completed,
    ...(status === "revision" ? [timelineStepDefinitions.revision] : []),
  ];
}

function getTimelineIndex(
  order: Order,
  timelineSteps: TimelineStep[],
  completedFileReady: boolean
) {
  const status = order.status ?? "new_request";

  if (status === "revision") {
    return timelineSteps.findIndex((step) => step.key === "revision");
  }

  if (status === "completed" || completedFileReady) {
    return timelineSteps.findIndex((step) => step.key === "completed");
  }

  if (status === "in_progress") {
    return timelineSteps.findIndex((step) => step.key === "in_progress");
  }

  if (status === "customer_info_needed") {
    return timelineSteps.findIndex((step) => step.key === "customer_info_needed");
  }

  if (status === "file_check") {
    return timelineSteps.findIndex((step) => step.key === "file_check");
  }

  return 0;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const locale = useActiveLocale();

  const [order, setOrder] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<CustomerDeliveryHistory | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedSupportSummary, setCopiedSupportSummary] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionSubmitting, setRevisionSubmitting] = useState(false);
  const [downloadingVersionId, setDownloadingVersionId] = useState<string | null>(null);
  const [downloadingSourceFileId, setDownloadingSourceFileId] = useState<string | null>(null);
  const [dtcAnalysis, setDtcAnalysis] = useState<CustomerRequestDtcAnalysis | null>(null);
  const [dtcLoading, setDtcLoading] = useState(false);
  const [dtcError, setDtcError] = useState("");
  const hasLoadedOrderRef = useRef(false);
  const [additionalUploadPhase, setAdditionalUploadPhase] =
    useState<AdditionalUploadPhase>("idle");
  const additionalUploading = additionalUploadPhase !== "idle";
  const activeAdditionalUploadStepIndex = additionalUploadSteps.findIndex(
    (step) => step.phase === additionalUploadPhase
  );
  const activeAdditionalUploadStep =
    activeAdditionalUploadStepIndex >= 0
      ? additionalUploadSteps[activeAdditionalUploadStepIndex]
      : null;
  const supportSummaryText = useMemo(
    () => buildCustomerSupportSummary(order, params?.id ?? "", locale),
    [locale, order, params?.id]
  );

  useEffect(() => {
    let currentUserId: string | null = null;
    const orderId = params?.id;

    const loadOrder = async (options?: { silent?: boolean }) => {
      if (options?.silent) setLiveRefreshing(true);
      else setLoading(true);
      if (!options?.silent) setMessage("");

      const user = (await getStableSession()).session?.user;

      if (!user) {
        if (!options?.silent) notifySessionRequired();
        setLoading(false);
        setLiveRefreshing(false);
        return;
      }

      if (await signOutIfEmailUnverified(user)) {
        router.push("/login?verify_email=1");
        return;
      }

      currentUserId = user.id;
      setEmail(user.email ?? null);

      if (!orderId) {
        setMessage("Order ID is missing.");
        setLoading(false);
        return;
      }

      try {
        const response = await authenticatedFetch(`/api/requests/${orderId}`, {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          if (!options?.silent || !hasLoadedOrderRef.current) {
            setMessage("Order details could not be loaded.");
          }
          setLoading(false);
          setLiveRefreshing(false);
          return;
        }

        setOrder(payload.order as Order);
        setDelivery(payload.delivery as CustomerDeliveryHistory);
        hasLoadedOrderRef.current = true;
      } catch {
        if (!options?.silent || !hasLoadedOrderRef.current) {
          setMessage("Order details could not be loaded.");
        }
        setLoading(false);
        setLiveRefreshing(false);
        return;
      }
      setLoading(false);
      setLiveRefreshing(false);

    };

    loadOrder();

    if (!orderId) return;

    const interval = window.setInterval(() => {
      loadOrder({ silent: true });
    }, 20000);

    const channel = supabase
      .channel(`customer-order-live-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as
            | { customer_id?: string }
            | undefined;

          if (!currentUserId || row?.customer_id !== currentUserId) return;

          loadOrder({ silent: true });
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [params?.id, router]);

  const downloadCompletedFile = async () => {
    const latestVersion = delivery?.versions.at(-1);
    if (!latestVersion) {
      setMessage("Completed file is not available yet.");
      return;
    }
    await downloadModifiedVersion(latestVersion.id);
  };

  const downloadModifiedVersion = async (versionId: string) => {
    if (!order || downloadingVersionId) return;
    setMessage("");
    setDownloadingVersionId(versionId);

    try {
      const response = await authenticatedFetch(`/api/requests/${order.id}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage("Secure download could not be prepared.");
        return;
      }

      setDelivery(payload.delivery as CustomerDeliveryHistory);
      window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setMessage("Secure download could not be prepared.");
    } finally {
      setDownloadingVersionId(null);
    }
  };

  const downloadSourceFile = async (kind: "original" | "additional", fileId: string) => {
    if (!order || downloadingSourceFileId) return;
    const downloadKey = `${kind}:${fileId}`;
    setMessage("");
    setDownloadingSourceFileId(downloadKey);

    try {
      const response = await authenticatedFetch(`/api/requests/${order.id}/source-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, fileId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage("Secure source download could not be prepared.");
        return;
      }

      setDelivery(payload.delivery as CustomerDeliveryHistory);
      window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setMessage("Secure source download could not be prepared.");
    } finally {
      setDownloadingSourceFileId(null);
    }
  };

  const requestRevision = async () => {
    if (!order || revisionSubmitting) return;

    const cleanNote = revisionNote.trim();

    if (!cleanNote) {
      setMessage("Please describe what needs to be revised.");
      return;
    }

    setRevisionSubmitting(true);
    setMessage("");

    try {
      const user = (await getStableSession()).session?.user;

      if (!user) {
        notifySessionRequired();
        return;
      }

      if (await signOutIfEmailUnverified(user)) {
        router.push("/login?verify_email=1");
        return;
      }

      const response = await authenticatedFetch(`/api/requests/${order.id}/revision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ revisionNote: cleanNote }),
      });

      if (!response.ok) {
        setMessage("Revision request could not be sent.");
        return;
      }

      setOrder((current) =>
        current ? { ...current, status: "revision" } : current
      );
      setRevisionNote("");
      setMessage("Revision request sent. MG AutoTech will review your note.");
    } catch {
      setMessage("Revision request could not be sent.");
    } finally {
      setRevisionSubmitting(false);
    }
  };

  const uploadAdditionalFile = async (file: File | null) => {
    if (!file || !order || additionalUploading) return;
    if (file.size > 32 * 1024 * 1024) {
      setMessage("The additional file must be 32 MB or smaller.");
      return;
    }

    setAdditionalUploadPhase("preparing");
    setMessage("");
    try {
      const prepareResponse = await authenticatedFetch(`/api/requests/${order.id}/additional-file/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type }),
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) {
        setMessage("Additional file upload could not be prepared.");
        return;
      }

      setAdditionalUploadPhase("uploading");
      const { error: uploadError } = await supabase.storage
        .from("customer-files")
        .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, {
          contentType: prepared.upload.contentType,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) {
        setMessage("Additional file upload could not be completed.");
        return;
      }

      setAdditionalUploadPhase("verifying");
      const finalizeResponse = await authenticatedFetch(`/api/requests/${order.id}/additional-file/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadContract: prepared.uploadContract,
          path: prepared.upload.path,
          fileName: file.name,
          fileSize: file.size,
        }),
      });
      const finalized = await finalizeResponse.json();
      if (!finalizeResponse.ok) {
        setMessage("Additional file upload could not be completed.");
        return;
      }

      setOrder((current) => current ? {
        ...current,
        customer_upload_enabled: false,
        customer_uploads: [...(current.customer_uploads ?? []), finalized.upload],
      } : current);
      setMessage("Additional file uploaded. MG AutoTech can now review it inside this request.");
    } catch {
      setMessage("Additional file upload could not be completed.");
    } finally {
      setAdditionalUploadPhase("idle");
    }
  };

  const loadDtcAnalysis = async () => {
    if (!order || dtcLoading) return;

    setDtcLoading(true);
    setDtcError("");
    try {
      const user = (await getStableSession()).session?.user;
      if (!user) {
        notifySessionRequired();
        return;
      }
      if (await signOutIfEmailUnverified(user)) {
        router.push("/login?verify_email=1");
        return;
      }

      const response = await authenticatedFetch(`/api/requests/${order.id}/dtc-analysis`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setDtcError("DTC guidance could not be prepared.");
        return;
      }
      setDtcAnalysis(payload.analysis);
    } catch {
      setDtcError("DTC guidance could not be prepared.");
    } finally {
      setDtcLoading(false);
    }
  };

  const copySupportSummary = async () => {
    if (!supportSummaryText) return;

    try {
      await navigator.clipboard.writeText(supportSummaryText);
      setCopiedSupportSummary(true);
      window.setTimeout(() => setCopiedSupportSummary(false), 1800);
    } catch {
      setMessage("Support summary could not be copied. Please try again.");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          Loading order details...
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div className="max-w-md rounded-[2rem] border border-red-900/40 bg-red-950/20 p-8 text-center">
          <ShieldCheck className="mx-auto mb-5 h-12 w-12 text-red-500" />
          <h1 className="text-3xl font-black">Order not found</h1>
          <p className="mt-3 text-zinc-400">
            {message || "This order could not be found or you do not have access."}
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const modifiedVersions = delivery?.versions ?? [];
  const customerSourceActivity = new Map(
    (delivery?.customerUploads ?? []).map((file) => [file.id, file])
  );
  const completedFileReady = modifiedVersions.length > 0;
  const revisionRequested = order.status === "revision";
  const canRequestRevision = completedFileReady && !revisionRequested;
  const deliveryEstimate = getDeliveryEstimateDisplay(order.estimated_delivery_label);
  const statusCopy = getCustomerStatusCopy(order, completedFileReady, revisionRequested);

  return (
    <main className={`${workspaceStyles.viewportShell} mg-compact-ui min-h-screen bg-[var(--mg-portal-canvas)] text-white lg:h-screen lg:overflow-hidden`}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(177,18,27,0.25),transparent_34%),linear-gradient(135deg,#050505,#0c0c0e_48%,#170507)]" />

      <div className="flex min-h-screen lg:h-screen lg:overflow-hidden">
        <section className="min-w-0 flex-1 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
          <header className="sticky top-0 z-50 shrink-0 border-b border-[var(--mg-portal-border)] bg-[var(--mg-portal-header)] backdrop-blur-xl lg:static">
            <div className="border-b border-red-950/40 bg-[#b1121b] px-4 py-2 text-white lg:px-5 xl:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {completedFileReady && !revisionRequested ? (
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${statusCopy.iconClass}`} />
                  ) : revisionRequested ? (
                    <RefreshCcw className={`h-4 w-4 shrink-0 ${statusCopy.iconClass}`} />
                  ) : (
                    <Clock3 className={`h-4 w-4 shrink-0 ${statusCopy.iconClass}`} />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black uppercase tracking-[0.12em]">
                      {statusCopy.title} - #{shortId(order.id)}
                    </div>
                    <p className="hidden truncate text-xs text-white/80 xl:block">
                      {statusCopy.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadCompletedFile}
                  disabled={!completedFileReady || downloadingVersionId !== null}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-white/35 bg-black/10 px-3 text-xs font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {downloadingVersionId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download latest
                </button>
              </div>
            </div>

            <div className="flex min-h-[62px] items-center justify-between gap-3 px-4 py-2.5 lg:px-5 xl:px-6">
              <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-800/50 bg-[var(--mg-portal-control)] shadow-lg shadow-red-950/30">
                  <Gauge className="h-5 w-5 text-red-500" />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-base font-black tracking-wide">
                    MG <span className="text-red-600">AUTOTECH</span>
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">Secure order workspace</div>
                </div>
              </Link>

              <div className="flex min-w-0 items-center gap-2">
                <div className="hidden items-center gap-2 rounded-lg border border-emerald-700/30 bg-emerald-950/20 px-3 py-2 text-xs font-black text-emerald-300 md:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {liveRefreshing ? "Syncing" : "Live sync"}
                </div>

                <div className="hidden max-w-56 truncate rounded-lg border border-[var(--mg-portal-border)] bg-[var(--mg-portal-control)] px-3 py-2 text-xs font-bold text-zinc-300 xl:block">
                  <span translate="no" data-no-translate>{email}</span>
                </div>

                <Link
                  href="/dashboard"
                  className="rounded-lg border border-[var(--mg-portal-border)] bg-[var(--mg-portal-control)] px-3 py-2 text-sm font-bold text-white transition hover:border-zinc-500 hover:bg-[var(--mg-portal-control-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <ArrowLeft className="mr-2 inline h-4 w-4" />
                  Dashboard
                </Link>
              </div>
            </div>
          </header>

          <div
            role="region"
            aria-label="Order detail content"
            tabIndex={0}
            className={`${workspaceStyles.workspaceFrame} mg-dense-scroll min-w-0 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400 lg:flex-1 lg:overflow-y-auto lg:px-5 xl:px-6`}
          >
            <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3">
              {message && (
                <div role="status" className="shrink-0 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                  {message}
                </div>
              )}

        <section className="shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[var(--mg-portal-surface)] shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                  Vehicle file request
                </span>

                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-zinc-400">
                  <span translate="no" data-no-translate>#{shortId(order.id)}</span>
                </span>
              </div>

              <h1 className="break-words text-xl font-black sm:text-2xl">
                {order.vehicle_brand ? <span translate="no" data-no-translate>{order.vehicle_brand}</span> : "Vehicle"}{" "}
                <span className="text-red-600" translate="no" data-no-translate>{order.vehicle_model || ""}</span>
              </h1>

              <p className="mt-1 max-w-3xl break-words text-sm text-zinc-400">
                {order.vehicle_generation ? <span translate="no" data-no-translate>{order.vehicle_generation}</span> : "Generation not set"} / {order.vehicle_engine ? <span translate="no" data-no-translate>{order.vehicle_engine}</span> : "Engine not set"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:shrink-0">
              <Link
                href={`/new-request?repeat=${order.id}`}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-red-700/50 bg-red-950/30 px-4 text-center text-sm font-black text-red-100 transition hover:bg-red-950/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
              >
                <CopyPlus className="mr-2 inline h-4 w-4" />
                Create similar
              </Link>

              <Link
                href="/new-request"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-center text-sm font-black text-white transition hover:bg-white/10"
              >
                <Upload className="mr-2 inline h-4 w-4" />
                New Request
              </Link>

              <button
                type="button"
                onClick={downloadCompletedFile}
                disabled={!completedFileReady || downloadingVersionId !== null}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {downloadingVersionId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download latest
              </button>
            </div>
          </div>

          <div className="grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-4">
            <WorkspaceMetric label="Current status" value={localizeCustomerOrderStatus(locale, order.status)} accentClass={getStatusStyle(order.status)} />
            <WorkspaceMetric label="Requested service" value={order.service_type || "Not set"} rawValue={Boolean(order.service_type)} />
            <WorkspaceMetric label="Created" value={formatDate(order.created_at, locale)} />
            <WorkspaceMetric label="Credits used" value={String(Number(order.credits_required ?? 0))} />
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {completedFileReady && !revisionRequested ? (
                <CheckCircle2 className={`h-5 w-5 shrink-0 ${statusCopy.iconClass}`} />
              ) : revisionRequested ? (
                <RefreshCcw className={`h-5 w-5 shrink-0 ${statusCopy.iconClass}`} />
              ) : (
                <Clock3 className={`h-5 w-5 shrink-0 ${statusCopy.iconClass}`} />
              )}
              <div className="min-w-0">
                <h2 id="order-progress-title" className="truncate text-sm font-black text-white">{statusCopy.title}</h2>
                <p className="mt-0.5 truncate text-xs text-zinc-500" title={statusCopy.description}>{statusCopy.description}</p>
              </div>
            </div>
            <ProgressTimeline order={order} completedFileReady={completedFileReady} />
          </div>
        </section>

        <div className={`${workspaceStyles.workspaceColumns} grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(23rem,0.36fr)]`}>
          <div className="min-w-0 space-y-3">
          <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[var(--mg-portal-surface)]">
            <div className="shrink-0 border-b border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-red-400">Request specification</div>
                  <h2 className="mt-1 text-lg font-black">Vehicle & technical data</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-black text-zinc-400">Read only</span>
              </div>
            </div>

            <div className="space-y-3 p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Detail icon={<Gauge />} label="Engine" value={order.vehicle_engine} />
                <Detail icon={<FileCode2 />} label="Generation" value={order.vehicle_generation} />
                <Detail icon={<CalendarDays />} label="Year" value={order.vehicle_year} />
                <Detail icon={<Wrench />} label="ECU / TCU" value={order.ecu} />
                <Detail icon={<Wrench />} label="Gearbox" value={order.gearbox} />
                <Detail icon={<Database />} label="Read Method" value={order.read_method} />
                <Detail icon={<Database />} label="HW / SW" value={order.hw_sw} />
                <Detail icon={<PackageCheck />} label="Master / Slave" value={order.master_slave} />
              </div>

              {order.uploaded_file_name && (
                <CustomerSourceFileRow
                  title="Original uploaded file"
                  fileName={order.uploaded_file_name}
                  uploadedAt={delivery?.original.receivedAt ?? order.created_at}
                  downloadCount={delivery?.original.downloadCount ?? 0}
                  lastDownloadedAt={delivery?.original.lastDownloadedAt ?? null}
                  locale={locale}
                  downloading={downloadingSourceFileId === "original:original"}
                  onDownload={() => downloadSourceFile("original", "original")}
                />
              )}

              <div className="rounded-xl border border-red-900/30 bg-red-950/15 p-3">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-red-400">Requested service</div>
                <div className="mt-1 break-words text-sm font-black text-white" translate="no" data-no-translate>{order.service_type || "-"}</div>
              </div>

              <details className="group rounded-xl border border-white/10 bg-black/25">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden">
                  <span className="text-sm font-black text-white">Customer notes</span>
                  <span className="text-xs text-zinc-500 group-open:hidden">Open</span>
                  <span className="hidden text-xs text-zinc-500 group-open:inline">Close</span>
                </summary>
                <div className="border-t border-white/10 px-3 py-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
                  {order.notes ? <span translate="no" data-no-translate>{order.notes}</span> : "No additional customer notes were provided."}
                </div>
              </details>

              {(order.customer_upload_enabled || (order.customer_uploads?.length ?? 0) > 0) && (
                <details open={order.customer_upload_enabled || undefined} className="group rounded-xl border border-blue-700/30 bg-blue-950/15">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden">
                    <span className="flex items-center gap-2 text-sm font-black text-blue-100"><Upload className="h-4 w-4 text-blue-300" />Additional files</span>
                    <span className="text-xs text-blue-300/70">{order.customer_upload_enabled ? "Upload enabled" : customerWorkflowT(locale, "receivedCount", { count: (order.customer_uploads?.length ?? 0).toLocaleString(intlLocaleByCode[locale]) })}</span>
                  </summary>
                  <div className="border-t border-blue-700/20 p-3">

                    {order.customer_upload_enabled && (
                      <label aria-busy={additionalUploading} className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-500/40 bg-black/25 p-3 text-center transition hover:bg-blue-950/20 focus-within:ring-2 focus-within:ring-blue-300">
                        {additionalUploading ? <Loader2 className="mb-2 h-5 w-5 animate-spin text-blue-300" /> : <Upload className="mb-2 h-5 w-5 text-blue-300" />}
                        <span role={additionalUploading ? "status" : undefined} aria-live={additionalUploading ? "polite" : undefined} className="max-w-full break-words font-black text-white">
                          {activeAdditionalUploadStep?.label ?? "Upload requested file"}
                        </span>
                        <span className="mt-1 max-w-full break-words text-xs text-zinc-500">
                          {activeAdditionalUploadStep?.description ?? "One file, maximum 32 MB"}
                        </span>
                        <input type="file" disabled={additionalUploading} className="sr-only" onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          uploadAdditionalFile(file);
                          event.target.value = "";
                        }} />
                      </label>
                    )}

                    {Array.isArray(order.customer_uploads) && order.customer_uploads.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {order.customer_uploads.map((file) => (
                          <div key={file.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black text-white" translate="no" data-no-translate>{file.file_name}</div>
                              <div className="mt-1 text-xs text-zinc-500">Uploaded {formatDate(file.uploaded_at, locale)}</div>
                              <div className="mt-1 grid gap-0.5 text-[11px] text-zinc-500">
                                <span>Portal download requests: {customerSourceActivity.get(file.id)?.downloadCount ?? 0}</span>
                                <span>
                                  {customerSourceActivity.get(file.id)?.lastDownloadedAt
                                    ? customerWorkflowT(locale, "lastRequest", { date: formatDate(customerSourceActivity.get(file.id)?.lastDownloadedAt ?? null, locale) })
                                    : "No download request yet"}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => downloadSourceFile("additional", file.id)}
                              disabled={downloadingSourceFileId !== null}
                              aria-label={customerWorkflowT(locale, "downloadUploadedFile", { fileName: file.file_name })}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-600/35 bg-blue-950/30 text-blue-200 transition hover:bg-blue-900/40 disabled:cursor-wait disabled:opacity-50"
                            >
                              {downloadingSourceFileId === `additional:${file.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )}

              <details className="group rounded-xl border border-white/10 bg-black/25">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden">
                  <span className="flex items-center gap-2 text-sm font-black text-white"><BrainCircuit className="h-4 w-4 text-red-400" />DTC diagnostic guidance</span>
                  <span className="text-xs text-zinc-500">Optional</span>
                </summary>
                <div className="border-t border-white/10 p-2">
                  <CustomerDtcAnalysisPanel analysis={dtcAnalysis} loading={dtcLoading} error={dtcError} onRun={loadDtcAnalysis} embedded />
                </div>
              </details>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[var(--mg-portal-surface)]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">Secure delivery</div>
                <h2 className="mt-1 text-lg font-black">Delivery history</h2>
              </div>
              <div className="rounded-full border border-emerald-700/30 bg-emerald-950/20 px-3 py-1 text-xs font-black text-emerald-300">
                {modifiedVersions.length} delivered
              </div>
            </div>

            <div className="space-y-3 p-3 sm:p-4">
              {deliveryEstimate.isExplicit && (
                <div className="rounded-xl border border-blue-700/25 bg-blue-950/15 px-3 py-2 text-xs text-blue-100/80">
                  <span className="font-black text-blue-200">ETA: {deliveryEstimate.label}</span>
                  {order.estimated_delivery_note ? <> - <span translate="no" data-no-translate>{order.estimated_delivery_note}</span></> : null}
                </div>
              )}

              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-300"><FileDown className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500"><span>Original received</span><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /></div>
                  <div
                    title={delivery?.original.fileName || undefined}
                    className="mt-1 truncate text-sm font-black text-white"
                    translate={delivery?.original.fileName ? "no" : undefined}
                    data-no-translate={delivery?.original.fileName ? true : undefined}
                  >
                    {delivery?.original.fileName || "Filename not available"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">Received {formatDate(delivery?.original.receivedAt ?? order.created_at, locale)} (Berlin time)</div>
                </div>
              </div>

              {modifiedVersions.length > 0 ? modifiedVersions.map((version, index) => (
                <article key={version.id} className="rounded-xl border border-emerald-700/30 bg-emerald-950/10 p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-700/30 bg-emerald-950/40 text-xs font-black text-emerald-300">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-[0.12em] text-emerald-300">{formatFileVersionLabel(version.label)}</span>
                        {index === modifiedVersions.length - 1 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">Latest</span>}
                      </div>
                      <div title={version.fileName} className="mt-1 truncate text-sm font-black text-white" translate="no" data-no-translate>{version.fileName}</div>
                      <div className="mt-2 grid gap-1 text-xs text-zinc-500">
                        <span>Delivered {formatDate(version.deliveredAt, locale)} (Berlin time)</span>
                        <span className="font-bold text-zinc-300">Portal download requests: {version.downloadCount}</span>
                        {version.lastDownloadedAt && <span>{customerWorkflowT(locale, "lastRequest", { date: formatDate(version.lastDownloadedAt, locale) })}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={customerWorkflowT(locale, "downloadFile", { label: formatFileVersionLabel(version.label) })}
                      title={customerWorkflowT(locale, "downloadLabel", { label: formatFileVersionLabel(version.label) })}
                      onClick={() => downloadModifiedVersion(version.id)}
                      disabled={downloadingVersionId !== null}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      {downloadingVersionId === version.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </button>
                  </div>
                </article>
              )) : (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/25 p-5 text-center text-sm text-zinc-400">No modified file has been delivered yet.</div>
              )}

              <p className="px-1 text-[11px] leading-5 text-zinc-600">A portal download request is counted when MG AutoTech issues a secure temporary link; it does not confirm byte-complete transfer.</p>

              <details className="group rounded-xl border border-purple-700/30 bg-purple-950/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden">
                  <span className="flex items-center gap-2 text-sm font-black text-purple-100"><RefreshCcw className="h-4 w-4 text-purple-300" />Revision</span>
                  <span className="text-xs text-purple-300/70">{revisionRequested ? "Open" : canRequestRevision ? "Available" : "After delivery"}</span>
                </summary>
                <div className="border-t border-purple-700/20 p-3">
                  {canRequestRevision ? (
                    <>
                      <textarea value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} rows={3} placeholder="Describe the required adjustment." className="w-full resize-none rounded-lg border border-white/10 bg-black/35 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-purple-500" />
                      <button onClick={requestRevision} disabled={revisionSubmitting} className="mt-2 flex h-10 w-full items-center justify-center rounded-lg bg-purple-700 px-4 text-sm font-black text-white transition hover:bg-purple-600 disabled:opacity-60">
                        {revisionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}Request revision
                      </button>
                    </>
                  ) : <p className="text-sm leading-6 text-zinc-400">{revisionRequested ? "A revision request is already open for this order." : "Revision becomes available after delivery."}</p>}
                </div>
              </details>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={copySupportSummary} className="flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10"><Copy className="mr-2 h-4 w-4" />{copiedSupportSummary ? "Copied" : "Copy summary"}</button>
                <a href={`mailto:info@mgautotech.de?subject=Order ${shortId(order.id)} Support`} className="flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white transition hover:bg-white/10"><Mail className="mr-2 h-4 w-4" />Support</a>
              </div>
              <div className="flex min-w-0 items-center gap-2 px-1 text-xs text-zinc-600"><User className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{order.customer_email ? <span translate="no" data-no-translate>{order.customer_email}</span> : "Account email unavailable"}</span></div>
            </div>
          </section>
          </div>

          <aside className={`${workspaceStyles.workspaceChatColumn} min-w-0`}>
            <RequestChat requestId={order.id} senderRole="customer" variant="workspace" />
          </aside>
        </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function WorkspaceMetric({
  label,
  value,
  accentClass,
  rawValue = false,
}: {
  label: string;
  value: string;
  accentClass?: string;
  rawValue?: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-white/10 px-4 py-3 sm:border-r lg:border-b-0 last:border-r-0">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-600">{label}</div>
      {accentClass ? (
        <div className={`mt-1.5 inline-flex max-w-full rounded-full border px-2.5 py-0.5 text-[11px] font-black ${accentClass}`}>
          <span className="truncate" translate={rawValue ? "no" : undefined} data-no-translate={rawValue ? true : undefined}>{value}</span>
        </div>
      ) : (
        <div className="mt-1.5 truncate text-sm font-black text-zinc-200" title={value} translate={rawValue ? "no" : undefined} data-no-translate={rawValue ? true : undefined}>{value}</div>
      )}
    </div>
  );
}

function confidenceClass(confidence: string) {
  if (confidence === "medium" || confidence === "high") {
    return "border-emerald-700/30 bg-emerald-950/20 text-emerald-200";
  }
  if (confidence === "low") return "border-amber-700/40 bg-amber-950/20 text-amber-100";
  return "border-zinc-700/50 bg-zinc-950/40 text-zinc-300";
}

function CustomerDtcAnalysisPanel({
  analysis,
  loading,
  error,
  onRun,
  embedded = false,
}: {
  analysis: CustomerRequestDtcAnalysis | null;
  loading: boolean;
  error: string;
  onRun: () => void;
  embedded?: boolean;
}) {
  const locale = useActiveLocale();
  return (
    <section
      className={
        embedded
          ? "p-2 sm:p-3"
          : "rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
      }
    >
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <BrainCircuit className="mt-1 h-7 w-7 shrink-0 text-red-400" />
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-black">DTC Diagnostic Guidance</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Customer-safe DTC summary from this request. Human review remains required.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={loading}
          aria-busy={loading}
          className="inline-flex items-center justify-center rounded-xl border border-red-800/40 bg-red-950/25 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          {analysis ? "Refresh DTC guidance" : "Run DTC guidance"}
        </button>
      </div>

      {loading && (
        <div role="status" aria-live="polite" className="rounded-2xl border border-blue-700/30 bg-blue-950/15 p-4 text-sm text-blue-100">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Preparing deterministic DTC guidance...
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

      {!analysis && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm leading-6 text-zinc-400">
          No request-level DTC guidance has been prepared yet.
        </div>
      )}

      {analysis && (
        <div aria-live="polite" className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">State</div>
              <div className="mt-2 text-sm font-black text-white">
                {localizeDtcAnalyzerMessage(locale, analysis.stateLabelMessage)}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Detected DTCs</div>
              <div className="mt-2 break-words text-sm font-black text-white">
                {analysis.detectedCodes.length > 0 ? (
                  <span translate="no" data-no-translate>{analysis.detectedCodes.join(", ")}</span>
                ) : localizeDtcConfidence(locale, "none")}
              </div>
            </div>
            <div className={`rounded-2xl border p-4 ${confidenceClass(analysis.confidence)}`}>
              <div className="text-xs font-black uppercase tracking-[0.14em]">Confidence</div>
              <div className="mt-2 text-sm font-black">
                {localizeDtcConfidence(locale, analysis.confidence)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-700/30 bg-amber-950/15 p-4 text-sm leading-6 text-amber-100">
            <ShieldCheck className="mr-2 inline h-4 w-4" />
            {localizeDtcAnalyzerMessage(locale, analysis.providerNoticeMessage)}
          </div>

          <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-300">
            {localizeDtcAnalyzerMessage(locale, analysis.summaryMessage)}
          </p>

          {analysis.codes.length > 0 ? (
            <div className="grid gap-4">
              {analysis.codes.map((code) => (
                <div key={code.code} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xl border border-red-800/40 bg-red-950/30 px-3 py-1 text-sm font-black text-red-100" translate="no" data-no-translate>{code.code}</span>
                    <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-300">
                      {localizeDtcAnalyzerMessage(locale, code.systemLabelMessage)}
                    </span>
                    <span className={`rounded-xl border px-3 py-1 text-xs font-black ${confidenceClass(code.confidence)}`}>
                      {localizeDtcConfidence(locale, code.confidence)}
                    </span>
                  </div>
                  <h3 className="mt-4 break-words text-lg font-black text-white">
                    {localizeDtcAnalyzerMessage(locale, code.titleMessage)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {localizeDtcAnalyzerMessage(locale, code.customerExplanationMessage)}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Evidence</div>
                      <ul className="space-y-2 text-sm leading-6 text-zinc-300">
                        {code.evidence.slice(0, 3).map((item) => (
                          <li key={item.id}>- {localizeDtcAnalyzerMessage(locale, item.message ?? {
                            key: "evidence.generic",
                            fallback: "Diagnostic evidence requires expert review.",
                          })}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Next Checks</div>
                      <ul className="space-y-2 text-sm leading-6 text-zinc-300">
                        {code.recommendations.slice(0, 3).map((item) => (
                          <li key={item.id}>- {localizeDtcAnalyzerMessage(locale, item.message ?? {
                            key: "recommendation.generic",
                            fallback: "Continue with expert diagnostic review.",
                          })}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-sm leading-6 text-zinc-400">
              No valid DTC code was detected in the current request fields.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-2 text-sm font-black text-white">Missing Information</div>
              <ul className="space-y-2 text-sm leading-6 text-zinc-400">
                {analysis.missingInformationMessages.slice(0, 6).map((item) => (
                  <li key={item.key}>- {localizeDtcAnalyzerMessage(locale, item)}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-2 text-sm font-black text-white">Safety Boundaries</div>
              <ul className="space-y-2 text-sm leading-6 text-zinc-400">
                {analysis.safetyBoundaryMessages.map((item) => (
                  <li key={item.key}>- {localizeDtcAnalyzerMessage(locale, item)}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-700/30 bg-amber-950/15 p-4 text-sm leading-6 text-amber-100">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {localizeDtcAnalyzerMessage(locale, {
              key: "human.required_before",
              fallback: "Human review is required before {items}.",
              params: {
                items: analysis.humanReview.requiredBeforeMessages
                  .map((item) => localizeDtcAnalyzerMessage(locale, item))
                  .join(", "),
              },
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function CustomerSourceFileRow({
  title,
  fileName,
  uploadedAt,
  downloadCount,
  lastDownloadedAt,
  locale,
  downloading,
  onDownload,
}: {
  title: string;
  fileName: string;
  uploadedAt: string;
  downloadCount: number;
  lastDownloadedAt: string | null;
  locale: LocaleCode;
  downloading: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-blue-700/25 bg-blue-950/10 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-950/40 text-blue-300">
        <FileDown className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-300">{title}</div>
        <div title={fileName} className="mt-1 truncate text-sm font-black text-white" translate="no" data-no-translate>{fileName}</div>
        <div className="mt-1 grid gap-0.5 text-[11px] leading-5 text-zinc-500">
          <span>Uploaded {formatDate(uploadedAt, locale)}</span>
          <span>Portal download requests: {downloadCount}</span>
          <span>{lastDownloadedAt ? customerWorkflowT(locale, "lastRequest", { date: formatDate(lastDownloadedAt, locale) }) : "No download request yet"}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading}
        aria-label={customerWorkflowT(locale, "downloadLabel", { label: fileName })}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white transition hover:bg-blue-600 disabled:cursor-wait disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex min-h-16 min-w-0 gap-2.5 rounded-lg border border-white/[0.08] bg-black/25 p-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-950/40 text-red-400 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </div>
        <div className="mt-1 break-words text-sm font-bold text-white">{value ? <span translate="no" data-no-translate>{value}</span> : "-"}</div>
      </div>
    </div>
  );
}

function ProgressTimeline({
  order,
  completedFileReady,
}: {
  order: Order;
  completedFileReady: boolean;
}) {
  const timelineSteps = getTimelineSteps(order);
  const activeIndex = getTimelineIndex(order, timelineSteps, completedFileReady);

  return (
    <div aria-label="Order progress" className="min-w-0 lg:w-[48%] lg:max-w-[620px]">
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-800 via-red-600 to-emerald-500 transition-all duration-700"
          style={{
            width: `${((activeIndex + 1) / timelineSteps.length) * 100}%`,
          }}
        />
      </div>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${timelineSteps.length}, minmax(0, 1fr))` }}
      >
        {timelineSteps.map((step, index) => {
          const done = index <= activeIndex;
          const current = index === activeIndex;

          return (
            <div
              key={step.key}
              title={step.description}
              aria-current={current ? "step" : undefined}
              className={`min-w-0 truncate text-center text-[10px] font-black ${
                current ? "text-white" : done ? "text-emerald-400" : "text-zinc-600"
              }`}
            >
              {step.label.replace("Request ", "")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
