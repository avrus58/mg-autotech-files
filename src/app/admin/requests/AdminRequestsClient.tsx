"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileCode2,
  Loader2,
  RefreshCcw,
  Search,
  User,
} from "lucide-react";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import { labelFromToken } from "@/lib/workOrders/types";

type ApiItem = {
  order: {
    id: string;
    customer_id: string | null;
    customer_email: string | null;
    vehicle_brand: string | null;
    vehicle_model: string | null;
    vehicle_generation: string | null;
    vehicle_engine: string | null;
    service_type: string | null;
    credits_required: number | string | null;
    status: string | null;
    ecu: string | null;
    original_file_path: string | null;
    modified_file_path: string | null;
    created_at: string | null;
  };
  customer: {
    customer_id: string | null;
    full_name: string | null;
    company_name: string | null;
    email: string | null;
  } | null;
  workOrder: {
    priority: string;
    admin_status: string;
    payment_review_status: string;
    delivery_status: string;
    quality_check_status: string;
    updated_at: string;
  } | null;
  requestedServices: string[];
  indicators: {
    hasOriginalFile: boolean;
    hasDeliveredFile: boolean;
    hasCustomerUpload: boolean;
    trainingSampleCount: number;
    hasAiEvidence: boolean;
  };
};

type ApiPayload = {
  migrationReady: boolean;
  items: ApiItem[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function badgeClass(value: string | null | undefined) {
  if (value === "completed" || value === "delivered" || value === "paid" || value === "passed") {
    return "border-emerald-700/40 bg-emerald-950/25 text-emerald-300";
  }
  if (value === "urgent" || value === "needs_review" || value === "requires_review" || value === "failed") {
    return "border-red-700/50 bg-red-950/35 text-red-200";
  }
  if (value === "high" || value === "payment_review" || value === "quality_check" || value === "pending") {
    return "border-amber-700/40 bg-amber-950/25 text-amber-200";
  }
  if (value === "in_progress" || value === "in_analysis" || value === "file_received") {
    return "border-blue-700/40 bg-blue-950/25 text-blue-300";
  }
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

const adminReviewStatuses = new Set(["needs_review", "payment_review", "quality_check"]);
const paymentReviewSignals = new Set(["requires_review"]);
const qualityReviewSignals = new Set(["failed", "needs_review"]);
const deliveryReviewSignals = new Set(["blocked", "revision_requested"]);

function hasReviewSignal(item: ApiItem) {
  const workOrder = item.workOrder;
  if (!workOrder) return false;
  return (
    adminReviewStatuses.has(workOrder.admin_status) ||
    paymentReviewSignals.has(workOrder.payment_review_status) ||
    qualityReviewSignals.has(workOrder.quality_check_status) ||
    deliveryReviewSignals.has(workOrder.delivery_status)
  );
}

export default function AdminRequestsClient() {
  const router = useRouter();
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login?redirect=/admin/requests");
      return;
    }
    if (await signOutIfEmailUnverified(userData.user)) {
      router.push("/login?verify_email=1");
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setMessage("Unauthorized");
      setLoading(false);
      return;
    }
    const response = await fetch("/api/admin/requests", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Work orders could not be loaded.");
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
  }, []);

  const filtered = useMemo(() => {
    const items = payload?.items ?? [];
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const haystack = [
        item.order.id,
        item.order.customer_email,
        item.customer?.customer_id,
        item.customer?.full_name,
        item.customer?.company_name,
        item.order.vehicle_brand,
        item.order.vehicle_model,
        item.order.vehicle_engine,
        item.order.ecu,
        item.order.service_type,
      ].filter(Boolean).join(" ").toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (status !== "all" && item.workOrder?.admin_status !== status && item.order.status !== status) return false;
      if (priority !== "all" && item.workOrder?.priority !== priority) return false;
      if (onlyNeedsReview && !hasReviewSignal(item)) return false;
      return true;
    });
  }, [payload, priority, search, status, onlyNeedsReview]);

  const stats = useMemo(() => {
    const items = payload?.items ?? [];
    return {
      total: items.length,
      open: items.filter((item) => !["completed", "cancelled"].includes(item.workOrder?.admin_status ?? "")).length,
      review: items.filter((item) => hasReviewSignal(item)).length,
      delivered: items.filter((item) => item.indicators.hasDeliveredFile).length,
    };
  }, [payload]);

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(180,18,28,0.22),transparent_34%),linear-gradient(135deg,#050505,#101012_52%,#170507)]" />
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Admin dashboard
            </Link>
            <div className="text-sm font-black uppercase tracking-[0.22em] text-red-500">Admin Work Orders</div>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">Request Control Center</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              Daily file-service queue with customer, vehicle, payment, File Expert and AI evidence indicators.
            </p>
          </div>
          <button onClick={load} className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white hover:bg-white/10">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {message && <div className="mb-5 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">{message}</div>}
        {payload && !payload.migrationReady && (
          <div className="mb-5 rounded-2xl border border-amber-700/40 bg-amber-950/25 p-4 text-sm text-amber-100">
            Work Order migration is not installed yet. Existing orders are visible in fallback mode, but internal notes, events and status actions require the SQL migration.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={<FileCode2 />} label="Total requests" value={stats.total} />
          <Metric icon={<Clock3 />} label="Open work" value={stats.open} />
          <Metric icon={<AlertTriangle />} label="Needs review" value={stats.review} />
          <Metric icon={<CheckCircle2 />} label="Delivered files" value={stats.delivered} />
        </div>

        <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4">
              <Search className="h-5 w-5 text-zinc-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, vehicle, ECU, service or request id..." className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-zinc-600" />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-12 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-black outline-none">
              <option value="all">All statuses</option>
              {["new", "file_received", "in_analysis", "in_progress", "waiting_for_customer", "payment_review", "quality_check", "ready_for_delivery", "completed", "cancelled", "needs_review"].map((item) => (
                <option key={item} value={item} className="bg-[#111]">{labelFromToken(item)}</option>
              ))}
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-12 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-black outline-none">
              <option value="all">All priorities</option>
              {["low", "normal", "high", "urgent"].map((item) => <option key={item} value={item} className="bg-[#111]">{labelFromToken(item)}</option>)}
            </select>
            <button onClick={() => setOnlyNeedsReview((value) => !value)} className={`rounded-xl border px-4 text-sm font-black ${onlyNeedsReview ? "border-red-700/50 bg-red-950/30 text-red-200" : "border-white/10 bg-black/30 text-zinc-300"}`}>
              Review only
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center text-zinc-400">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-red-500" />
              Loading work orders...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-zinc-400">
              No work orders match this filter.
            </div>
          ) : filtered.map((item) => (
            <Link key={item.order.id} href={`/admin/requests/${item.order.id}`} className="block rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-red-800/50 hover:bg-red-950/10">
              <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr_1fr_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-red-800/40 bg-red-950/25 px-3 py-1 text-xs font-black text-red-200">#{shortId(item.order.id)}</span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(item.workOrder?.priority)}`}>{labelFromToken(item.workOrder?.priority)}</span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(item.workOrder?.admin_status)}`}>{labelFromToken(item.workOrder?.admin_status)}</span>
                  </div>
                  <h2 className="truncate text-2xl font-black">{item.order.vehicle_brand || "Vehicle"} {item.order.vehicle_model || ""}</h2>
                  <p className="mt-1 truncate text-sm text-zinc-400">{item.order.vehicle_generation || "Generation not set"} - {item.order.vehicle_engine || "Engine not set"}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-black text-white"><User className="h-4 w-4 text-red-400" />{item.customer?.company_name || item.customer?.full_name || item.order.customer_email || "Unknown customer"}</div>
                  <div className="mt-2 text-xs text-zinc-500">{item.customer?.customer_id || item.order.customer_id || "-"}</div>
                  <div className="mt-2 text-xs text-zinc-500">Created {formatDate(item.order.created_at)}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {item.requestedServices.slice(0, 3).map((service) => <span key={service} className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-xs font-bold text-zinc-300">{service}</span>)}
                    {item.requestedServices.length > 3 && <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-xs font-bold text-zinc-500">+{item.requestedServices.length - 3}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500">
                    <Indicator ok={item.indicators.hasOriginalFile} label="ORI" />
                    <Indicator ok={item.indicators.hasDeliveredFile} label="MOD" />
                    <Indicator ok={item.indicators.hasAiEvidence} label="AI" />
                  </div>
                </div>
                <div className="grid gap-2 text-right text-sm">
                  <div className={`rounded-xl border px-3 py-2 font-black ${badgeClass(item.workOrder?.payment_review_status)}`}><CreditCard className="mr-1 inline h-4 w-4" />{labelFromToken(item.workOrder?.payment_review_status)}</div>
                  <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-black text-zinc-300">{Number(item.order.credits_required ?? 0)} credits</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-950/40 text-red-400">{icon}</div>
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-4xl font-black">{value}</div>
    </div>
  );
}

function Indicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-lg border px-2 py-1 text-center font-black ${ok ? "border-emerald-700/30 bg-emerald-950/20 text-emerald-300" : "border-white/10 bg-black/20 text-zinc-600"}`}>
      {label}
    </span>
  );
}
