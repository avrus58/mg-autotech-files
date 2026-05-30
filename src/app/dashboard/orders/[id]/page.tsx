"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  Download,
  FileCode2,
  FileDown,
  Gauge,
  Loader2,
  Mail,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  Wrench,
} from "lucide-react";

type Order = {
  id: string;
  customer_id: string;
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
  original_file_path: string | null;
  modified_file_path: string | null;
  created_at: string;
};

function formatStatus(status: string | null) {
  if (!status) return "New Request";

  return status
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

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

function formatDate(date: string | null) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

const timelineSteps = [
  {
    key: "new_request",
    label: "Request Created",
    description: "Your file request has been created.",
  },
  {
    key: "file_check",
    label: "File Check",
    description: "MG AutoTech checks your original file and vehicle data.",
  },
  {
    key: "in_progress",
    label: "Processing",
    description: "Your file is being prepared by MG AutoTech.",
  },
  {
    key: "completed",
    label: "Completed",
    description: "Your modified file is ready to download.",
  },
];

function getTimelineIndex(order: Order) {
  const status = order.status ?? "new_request";

  if (status === "completed" || order.modified_file_path) return 3;
  if (status === "in_progress" || status === "revision") return 2;
  if (status === "file_check" || status === "customer_info_needed") return 1;

  return 0;
}


export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadOrder = async () => {
      setLoading(true);
      setMessage("");

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/login");
        return;
      }

      setEmail(userData.user.email ?? null);

      const orderId = params?.id;

      if (!orderId) {
        setMessage("Order ID is missing.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("customer_id", userData.user.id)
        .single();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setOrder(data as Order);
      setLoading(false);
    };

    loadOrder();
  }, [params?.id, router]);

  const downloadCompletedFile = async () => {
    if (!order?.modified_file_path) {
      setMessage("Completed file is not available yet.");
      return;
    }

    setMessage("");

    const { data, error } = await supabase.storage
      .from("customer-files")
      .createSignedUrl(order.modified_file_path, 60);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
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

  const completedFileReady =
    order.status === "completed" && Boolean(order.modified_file_path);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(160,18,28,0.25),transparent_34%),linear-gradient(135deg,#050505,#0c0c0e_48%,#170507)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
              <Gauge className="h-7 w-7 text-red-600" />
            </div>

            <div>
              <div className="text-xl font-black tracking-wide">
                MG <span className="text-red-600">AUTOTECH</span>
              </div>
              <div className="text-xs text-zinc-400">Order Details</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-zinc-300 md:block">
              {email}
            </div>

            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 inline h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {message && (
          <div className="mb-6 rounded-2xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                    order.status
                  )}`}
                >
                  {formatStatus(order.status)}
                </span>

                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-zinc-400">
                  #{shortId(order.id)}
                </span>
              </div>

              <h1 className="text-4xl font-black md:text-5xl">
                {order.vehicle_brand || "Vehicle"}{" "}
                <span className="text-red-600">{order.vehicle_model || ""}</span>
              </h1>

              <p className="mt-3 max-w-3xl text-zinc-400">
                {order.vehicle_generation || "Generation not set"} ·{" "}
                {order.vehicle_engine || "Engine not set"} · Created{" "}
                {formatDate(order.created_at)}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/new-request"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/10"
              >
                <Upload className="mr-2 inline h-4 w-4" />
                New Request
              </Link>

              <button
                onClick={downloadCompletedFile}
                disabled={!completedFileReady}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                <Download className="mr-2 inline h-4 w-4" />
                Download Completed File
              </button>
            </div>
          </div>
        </div>

        {completedFileReady ? (
          <div className="mb-8 rounded-[2rem] border border-emerald-700/30 bg-emerald-950/20 p-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-1 h-8 w-8 shrink-0 text-emerald-400" />
              <div>
                <h2 className="text-2xl font-black">Your modified file is ready</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  The completed file has been uploaded by MG AutoTech and can be
                  downloaded securely with a temporary download link.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-[2rem] border border-amber-700/30 bg-amber-950/20 p-6">
            <div className="flex items-start gap-4">
              <Clock3 className="mt-1 h-8 w-8 shrink-0 text-amber-400" />
              <div>
                <h2 className="text-2xl font-black">File is not ready yet</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Your request is currently being checked or processed. The download
                  button will appear automatically once the completed file is uploaded.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-5 text-2xl font-black">Vehicle & ECU Data</h2>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Detail icon={<Gauge />} label="Engine" value={order.vehicle_engine} />
                <Detail icon={<FileCode2 />} label="Generation" value={order.vehicle_generation} />
                <Detail icon={<CalendarDays />} label="Year" value={order.vehicle_year} />
                <Detail icon={<Wrench />} label="ECU / TCU" value={order.ecu} />
                <Detail icon={<Wrench />} label="Gearbox" value={order.gearbox} />
                <Detail icon={<Database />} label="Read Method" value={order.read_method} />
                <Detail icon={<Database />} label="HW / SW" value={order.hw_sw} />
                <Detail icon={<PackageCheck />} label="Master / Slave" value={order.master_slave} />
                <Detail icon={<FileDown />} label="Uploaded File" value={order.uploaded_file_name} />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-5 text-2xl font-black">Requested Service</h2>
              <div className="rounded-2xl bg-black/30 p-5 text-sm leading-7 text-zinc-300">
                {order.service_type || "-"}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-5 text-2xl font-black">Customer Notes</h2>
              <div className="min-h-32 whitespace-pre-wrap rounded-2xl bg-black/30 p-5 text-sm leading-7 text-zinc-300">
                {order.notes || "-"}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-red-900/40 bg-red-950/20 p-6">
              <CreditCard className="mb-4 h-8 w-8 text-red-400" />
              <div className="text-sm text-zinc-400">Credits Used</div>
              <div className="mt-2 text-5xl font-black">
                {Number(order.credits_required ?? 0)}
              </div>
            </section>

            <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Order Timeline</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Live status overview for your request.
                  </p>
                </div>

                <div
                  className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                    order.status
                  )}`}
                >
                  {formatStatus(order.status)}
                </div>
              </div>

              <ProgressTimeline order={order} />

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                  <div>
                    <div className="text-sm font-black text-white">
                      Current step
                    </div>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      {completedFileReady
                        ? "Your modified file is ready. You can download it securely from this page."
                        : order.status === "customer_info_needed"
                        ? "MG AutoTech needs additional information from you to continue this request."
                        : order.status === "in_progress"
                        ? "Your file is currently being processed."
                        : order.status === "file_check"
                        ? "Your original file and vehicle data are being checked."
                        : "Your request has been received and is waiting for review."}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-5 text-2xl font-black">Support</h2>
              <p className="text-sm leading-6 text-zinc-400">
                For questions about this specific order, contact MG AutoTech and
                include the order number.
              </p>

              <a
                href={`mailto:info@mgautotech.de?subject=Order ${shortId(order.id)} Support`}
                className="mt-5 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </a>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-5 text-2xl font-black">Customer</h2>
              <Detail icon={<User />} label="Email" value={order.customer_email} />
            </section>
          </aside>
        </div>
      </section>
    </main>
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
    <div className="flex gap-3 rounded-2xl bg-white/[0.04] p-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-950/40 text-red-400">
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </div>
        <div className="mt-1 break-words font-bold text-white">{value || "-"}</div>
      </div>
    </div>
  );
}

function ProgressTimeline({ order }: { order: Order }) {
  const activeIndex = getTimelineIndex(order);

  return (
    <div className="space-y-3">
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-800 via-red-600 to-emerald-500 transition-all duration-700"
          style={{
            width: `${((activeIndex + 1) / timelineSteps.length) * 100}%`,
          }}
        />
      </div>

      {timelineSteps.map((step, index) => {
        const done = index <= activeIndex;
        const current = index === activeIndex;

        return (
          <TimelineItem
            key={step.key}
            done={done}
            current={current}
            label={step.label}
            description={step.description}
          />
        );
      })}
    </div>
  );
}

function TimelineItem({
  done,
  current,
  label,
  description,
}: {
  done: boolean;
  current: boolean;
  label: string;
  description: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
        current
          ? "border-red-800/50 bg-red-950/25"
          : done
          ? "border-emerald-700/30 bg-emerald-950/10"
          : "border-white/10 bg-black/30"
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
          done
            ? "border-emerald-700/40 bg-emerald-950/40 text-emerald-300"
            : "border-zinc-700/40 bg-zinc-900/40 text-zinc-500"
        }`}
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Clock3 className="h-4 w-4" />
        )}
      </div>

      <div>
        <div
          className={
            done ? "font-black text-white" : "font-black text-zinc-500"
          }
        >
          {label}
        </div>
        <div className="mt-1 text-sm leading-5 text-zinc-500">
          {description}
        </div>
      </div>
    </div>
  );
}
