"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowRight,
  Car,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Gauge,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Plus,
  ShieldCheck,
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

  if (value.includes("cancel")) {
    return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  }

  return "border-red-700/40 bg-red-950/30 text-red-300";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [inProgressCount, setInProgressCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/login");
        return;
      }

      const user = userData.user;
      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("id", user.id)
        .single();

      if (profile) {
        setCredits(Number(profile.credit_balance ?? 0));
      }

      const { data: recentOrders } = await supabase
        .from("orders")
        .select(
          "id, customer_id, customer_email, vehicle_brand, vehicle_model, vehicle_generation, vehicle_engine, service_type, credits_required, status, notes, modified_file_path, created_at"
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (recentOrders) {
        setOrders(recentOrders as Order[]);
      }

      const { count: allOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", user.id);

      const { count: completedOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", user.id)
        .eq("status", "completed");

      const { count: pendingOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", user.id)
        .in("status", ["new_request", "file_check"]);

      const { count: progressOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", user.id)
        .eq("status", "in_progress");

      setOrdersCount(allOrders ?? 0);
      setCompletedCount(completedOrders ?? 0);
      setPendingCount(pendingOrders ?? 0);
      setInProgressCount(progressOrders ?? 0);

      const active =
        (allOrders ?? 0) - (completedOrders ?? 0);

      setActiveCount(active < 0 ? 0 : active);
      setLoading(false);
    };

    loadDashboard();
  }, [router]);

  const creditHistory = useMemo(() => {
    return orders
      .filter((order) => Number(order.credits_required ?? 0) > 0)
      .slice(0, 6);
  }, [orders]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const downloadCompletedFile = async (filePath: string | null) => {
    if (!filePath) {
      alert("Completed file is not available yet.");
      return;
    }

    const { data, error } = await supabase.storage
      .from("customer-files")
      .createSignedUrl(filePath, 60);

    if (error) {
      alert(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-red-600" />
          <p className="text-sm text-zinc-400">Loading customer dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(160,18,28,0.24),transparent_32%),linear-gradient(135deg,#050505,#0d0d0f_48%,#160608)]" />

      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-black/70 lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-5 py-6">
            <Link href="/" className="mb-8 flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-red-800/50 bg-[#111] shadow-lg shadow-red-950/40">
                <div className="absolute -top-2 h-5 w-10 rounded-t-full border-t-2 border-red-700" />
                <Gauge className="h-7 w-7 text-red-600" />
              </div>

              <div>
                <div className="text-xl font-black tracking-wide">
                  MG <span className="text-red-600">AUTOTECH</span>
                </div>
                <div className="text-xs text-zinc-400">Customer Panel</div>
              </div>
            </Link>

            <nav className="space-y-2 text-sm">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-2xl bg-red-950/35 px-4 py-3 font-bold text-white"
              >
                <LayoutDashboard className="h-5 w-5 text-red-500" />
                Dashboard
              </Link>

              <Link
                href="/new-request"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Upload className="h-5 w-5" />
                New File Request
              </Link>

              <Link
                href="/dashboard/credits"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <CreditCard className="h-5 w-5" />
                Buy Credits
              </Link>

              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <History className="h-5 w-5" />
                Credit History
              </Link>

              <a
                href="mailto:info@mgautotech.de"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Wrench className="h-5 w-5" />
                Support
              </a>
            </nav>

            <div className="mt-auto rounded-3xl border border-red-900/40 bg-red-950/20 p-5">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">
                Current Balance
              </div>
              <div className="mt-2 text-4xl font-black">{credits}</div>
              <div className="mt-1 text-xs text-zinc-400">Available Credits</div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-black/75 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-8">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-red-600">
                  Customer Dashboard
                </div>
                <h1 className="mt-1 text-2xl font-black md:text-3xl">
                  File Service Panel
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 md:block">
                  <div className="text-xs text-zinc-500">Logged in as</div>
                  <div className="max-w-[220px] truncate text-sm font-bold">
                    {email}
                  </div>
                </div>

                <div className="rounded-2xl border border-red-900/40 bg-red-950/25 px-4 py-3">
                  <div className="text-xs text-zinc-500">Credits</div>
                  <div className="text-sm font-black text-white">{credits}</div>
                </div>

                <button
                  onClick={handleLogout}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <LogOut className="mr-2 inline h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <div className="px-4 py-8 lg:px-8">
            <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-3xl border border-red-900/50 bg-red-950/25 p-6 shadow-2xl shadow-black/20">
                <CreditCard className="mb-4 h-8 w-8 text-red-500" />
                <div className="text-sm text-zinc-400">Available Credits</div>
                <div className="mt-2 text-5xl font-black">{credits}</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-red-800/60">
                <Clock3 className="mb-4 h-8 w-8 text-blue-400" />
                <div className="text-sm text-zinc-400">Active Orders</div>
                <div className="mt-2 text-5xl font-black">{activeCount}</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-red-800/60">
                <FileText className="mb-4 h-8 w-8 text-amber-400" />
                <div className="text-sm text-zinc-400">Pending Requests</div>
                <div className="mt-2 text-5xl font-black">{pendingCount}</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-red-800/60">
                <Gauge className="mb-4 h-8 w-8 text-red-500" />
                <div className="text-sm text-zinc-400">In Progress</div>
                <div className="mt-2 text-5xl font-black">{inProgressCount}</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-emerald-700/60">
                <CheckCircle2 className="mb-4 h-8 w-8 text-emerald-400" />
                <div className="text-sm text-zinc-400">Completed</div>
                <div className="mt-2 text-5xl font-black">{completedCount}</div>
              </div>
            </div>

            {orders.some(
              (order) => order.status === "completed" && order.modified_file_path
            ) && (
              <div className="mb-8 rounded-[2rem] border border-emerald-700/30 bg-emerald-950/20 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Download className="h-7 w-7 text-emerald-400" />
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.25em] text-emerald-400">
                      Completed Files
                    </div>
                    <h2 className="mt-1 text-2xl font-black">
                      Your modified file is ready to download
                    </h2>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {orders
                    .filter(
                      (order) =>
                        order.status === "completed" && order.modified_file_path
                    )
                    .map((order) => (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-emerald-700/30 bg-black/30 p-4"
                      >
                        <div className="font-black">
                          {order.vehicle_brand || "Vehicle"}{" "}
                          {order.vehicle_model || ""}
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {order.service_type || "Service not set"}
                        </div>
                        <button
                          onClick={() =>
                            downloadCompletedFile(order.modified_file_path)
                          }
                          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-500"
                        >
                          <Download className="mr-2 inline h-4 w-4" />
                          Download Completed File
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="mb-8 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
                      Recent Requests
                    </div>
                    <h2 className="mt-2 text-3xl font-black">
                      Your latest file orders
                    </h2>
                  </div>

                  <Link
                    href="/new-request"
                    className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-1 hover:bg-[#c91824]"
                  >
                    <Plus className="mr-2 inline h-4 w-4" />
                    New Request
                  </Link>
                </div>

                {orders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-10 text-center">
                    <Upload className="mx-auto mb-4 h-10 w-10 text-red-600" />
                    <h3 className="text-xl font-black">No file request yet</h3>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
                      Create your first ECU/TCU file request and it will appear here.
                    </p>
                    <Link
                      href="/new-request"
                      className="mt-6 inline-flex rounded-xl bg-[#b1121b] px-5 py-3 font-black text-white transition hover:bg-[#c91824]"
                    >
                      Create File Request
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-white/10">
                    <div className="grid grid-cols-[1.4fr_.8fr_.7fr_.7fr_.9fr] gap-4 bg-black/40 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                      <div>Vehicle / Request</div>
                      <div>Status</div>
                      <div>Credit</div>
                      <div>Date</div>
                      <div className="text-right">Actions</div>
                    </div>

                    <div className="divide-y divide-white/10">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className="grid grid-cols-1 gap-4 bg-black/20 px-5 py-4 transition hover:bg-white/[0.04] md:grid-cols-[1.4fr_.8fr_.7fr_.7fr_.9fr] md:items-center"
                        >
                          <div>
                            <div className="font-black">
                              {order.vehicle_brand || "Vehicle"}{" "}
                              {order.vehicle_model || ""}
                            </div>
                            <div className="mt-1 text-sm text-zinc-400">
                              {order.vehicle_generation || "Generation not set"} ·{" "}
                              {order.vehicle_engine || "Engine not set"}
                            </div>
                            <div className="mt-2 text-xs font-bold text-red-400">
                              {order.service_type || "Service not set"}
                            </div>
                          </div>

                          <div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                                order.status
                              )}`}
                            >
                              {formatStatus(order.status)}
                            </span>
                          </div>

                          <div className="font-black">
                            {Number(order.credits_required ?? 0)}
                          </div>

                          <div className="text-left text-sm text-zinc-400">
                            {formatDate(order.created_at)}
                          </div>

                          <div className="flex flex-col gap-2 text-left md:items-end md:text-right">
                            {order.status === "completed" && order.modified_file_path ? (
                              <button
                                onClick={() => downloadCompletedFile(order.modified_file_path)}
                                className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-xs font-black text-emerald-300 transition hover:bg-emerald-900/40"
                              >
                                <Download className="mr-2 inline h-4 w-4" />
                                Download File
                              </button>
                            ) : (
                              <span className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-zinc-500">
                                Not Ready
                              </span>
                            )}

                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-white transition hover:bg-white/10"
                            >
                              <Eye className="mr-2 inline h-4 w-4" />
                              Details
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                  <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
                    Quick Actions
                  </div>

                  <div className="mt-5 grid gap-3">
                    <Link
                      href="/new-request"
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:-translate-y-1 hover:border-red-800/60"
                    >
                      <span className="flex items-center gap-3 font-black">
                        <Upload className="h-5 w-5 text-red-600" />
                        Upload New File
                      </span>
                      <ArrowRight className="h-5 w-5 text-zinc-500" />
                    </Link>

                    <Link
                      href="/dashboard/credits"
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:-translate-y-1 hover:border-red-800/60"
                    >
                      <span className="flex items-center gap-3 font-black">
                        <CreditCard className="h-5 w-5 text-red-600" />
                        Buy Credits
                      </span>
                      <ArrowRight className="h-5 w-5 text-zinc-500" />
                    </Link>

                    <a
                      href="mailto:info@mgautotech.de"
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:-translate-y-1 hover:border-red-800/60"
                    >
                      <span className="flex items-center gap-3 font-black">
                        <Wrench className="h-5 w-5 text-red-600" />
                        Technical Support
                      </span>
                      <ArrowRight className="h-5 w-5 text-zinc-500" />
                    </a>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-red-900/40 bg-red-950/20 p-6">
                  <ShieldCheck className="mb-5 h-10 w-10 text-red-500" />
                  <h3 className="text-2xl font-black">Secure File Workflow</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    Your orders, credits and file requests are connected to your
                    customer account and protected with database access rules.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-5 text-sm font-black uppercase tracking-[0.25em] text-red-600">
                  Credit History
                </div>

                {creditHistory.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-8 text-center text-sm text-zinc-400">
                    No credit usage yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {creditHistory.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-black/30 p-4"
                      >
                        <div>
                          <div className="font-bold">
                            {order.vehicle_brand || "Vehicle"}{" "}
                            {order.vehicle_model || ""}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {order.service_type || "Service"} ·{" "}
                            {formatDate(order.created_at)}
                          </div>
                        </div>

                        <div className="font-black text-red-500">
                          -{Number(order.credits_required ?? 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[#b1121b] p-7">
                <Car className="mb-5 h-10 w-10 text-white" />
                <h3 className="text-3xl font-black">
                  Need a new tuning file?
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-red-100">
                  Submit your vehicle data and original ECU/TCU file. MG AutoTech
                  will check your request and prepare the right software solution.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/new-request"
                    className="rounded-xl bg-white px-5 py-3 font-black text-[#b1121b] transition hover:bg-zinc-100"
                  >
                    Start Request
                  </Link>

                  <Link
                    href="/"
                    className="rounded-xl border border-white/30 px-5 py-3 font-black text-white transition hover:bg-white/10"
                  >
                    <Home className="mr-2 inline h-4 w-4" />
                    Back Home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}