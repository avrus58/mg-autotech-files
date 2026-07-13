"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getStableSession, signOutIfEmailUnverified, signOutStable } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowRight,
  AlertTriangle,
  BrainCircuit,
  Braces,
  Car,
  CheckCircle2,
  Clipboard,
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
  RefreshCw,
  Settings,
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

type CreditTransaction = {
  id: string;
  user_id: string;
  type: string | null;
  credits_delta: number | string;
  balance_after: number | string | null;
  description: string | null;
  created_at: string;
};

type DashboardProfile = {
  credit_balance: number | string | null;
  customer_id: string | null;
  full_name: string | null;
  account_type: string | null;
  company_name: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  invoice_email: string | null;
  preferred_contact: string | null;
};

const DASHBOARD_LOAD_ERROR_MESSAGE =
  "We could not load your dashboard data. Please try again.";
const DASHBOARD_SYNC_ERROR_MESSAGE =
  "Dashboard sync failed. Your last loaded data is still shown.";

function hasProfileValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function getProfileCompletionMissingItems(profile: DashboardProfile) {
  const missing: string[] = [];

  if (!hasProfileValue(profile.full_name)) missing.push("Full name");
  if (!hasProfileValue(profile.phone)) missing.push("Phone / WhatsApp contact");
  if (!hasProfileValue(profile.preferred_contact)) missing.push("Preferred contact method");
  if (!hasProfileValue(profile.invoice_email)) missing.push("Invoice e-mail");
  if (!hasProfileValue(profile.account_type)) missing.push("Account type");

  if (profile.account_type === "company" && !hasProfileValue(profile.company_name)) {
    missing.push("Company / workshop name");
  }

  if (
    !hasProfileValue(profile.street) ||
    !hasProfileValue(profile.postal_code) ||
    !hasProfileValue(profile.city) ||
    !hasProfileValue(profile.country)
  ) {
    missing.push("Billing address");
  }

  return missing;
}

function formatMissingProfileItems(items: string[]) {
  if (items.length <= 2) return items.join(" and ");

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function formatStatus(status: string | null) {
  if (!status) return "New Request";

  return status
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCreditTransactionType(type: string | null) {
  if (!type) return "Credit movement";

  return type
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

function formatCustomerReference(customerId: string | null) {
  if (!customerId) return "MGA-10001";

  const cleanId = customerId.trim().toUpperCase();
  if (/^MGA-\d{5,}$/.test(cleanId)) return cleanId;
  if (/^\d+$/.test(cleanId)) return `MGA-${cleanId.padStart(5, "0")}`;
  return "MGA-10001";
}

export function DashboardClient() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [needsResponseCount, setNeedsResponseCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [inProgressCount, setInProgressCount] = useState<number>(0);
  const [profileMissingItems, setProfileMissingItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [copiedReference, setCopiedReference] = useState(false);
  const hasLoadedDashboardRef = useRef(false);

  useEffect(() => {
    let currentUserId: string | null = null;

    const loadDashboard = async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      let keepLoadingForRedirect = false;

      if (silent) {
        setLiveRefreshing(true);
      } else {
        setLoading(true);
        setDashboardLoadError(null);
      }

      try {
        if (!currentUserId) {
          const { session } = await getStableSession();
          if (!session?.user) {
            if (!silent) {
              keepLoadingForRedirect = true;
              router.replace("/login");
            }
            return;
          }

          const user = session.user;
          currentUserId = user.id;

          if (await signOutIfEmailUnverified(user)) {
            keepLoadingForRedirect = true;
            router.replace("/login?verify_email=1");
            return;
          }

          setEmail(user.email ?? null);
        }

        const userId = currentUserId;
        if (!userId) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select(
            "credit_balance, customer_id, full_name, account_type, company_name, phone, street, postal_code, city, country, invoice_email, preferred_contact"
          )
          .eq("id", userId)
          .single();

        const { data: recentOrders, error: recentOrdersError } = await supabase
          .from("orders")
          .select(
            "id, customer_id, customer_email, vehicle_brand, vehicle_model, vehicle_generation, vehicle_engine, service_type, credits_required, status, notes, modified_file_path, created_at"
          )
          .eq("customer_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        const { data: transactionRows, error: transactionRowsError } = await supabase
          .from("credit_transactions")
          .select("id, user_id, type, credits_delta, balance_after, description, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(6);

        const { count: allOrders, error: allOrdersError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", userId);

        const { count: completedOrders, error: completedOrdersError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", userId)
          .eq("status", "completed");

        const { count: pendingOrders, error: pendingOrdersError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", userId)
          .in("status", ["new_request", "file_check"]);

        const { count: needsResponseOrders, error: needsResponseOrdersError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", userId)
          .eq("status", "customer_info_needed");

        const { count: progressOrders, error: progressOrdersError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", userId)
          .eq("status", "in_progress");

        const { count: cancelledOrders, error: cancelledOrdersError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", userId)
          .eq("status", "cancelled");

        const queryFailed =
          profileError ||
          recentOrdersError ||
          transactionRowsError ||
          allOrdersError ||
          completedOrdersError ||
          pendingOrdersError ||
          needsResponseOrdersError ||
          progressOrdersError ||
          cancelledOrdersError;

        if (queryFailed) {
          setDashboardLoadError(
            hasLoadedDashboardRef.current || silent
              ? DASHBOARD_SYNC_ERROR_MESSAGE
              : DASHBOARD_LOAD_ERROR_MESSAGE
          );
          return;
        }

        if (profile) {
          const dashboardProfile = profile as DashboardProfile;
          setCredits(Number(dashboardProfile.credit_balance ?? 0));
          setCustomerId(dashboardProfile.customer_id ?? null);
          setProfileMissingItems(getProfileCompletionMissingItems(dashboardProfile));
        } else {
          setCredits(0);
          setCustomerId(null);
          setProfileMissingItems([]);
        }

        setOrders((recentOrders ?? []) as Order[]);
        setCreditTransactions((transactionRows ?? []) as CreditTransaction[]);
        setCompletedCount(completedOrders ?? 0);
        setPendingCount(pendingOrders ?? 0);
        setNeedsResponseCount(needsResponseOrders ?? 0);
        setInProgressCount(progressOrders ?? 0);

        const active =
          (allOrders ?? 0) - (completedOrders ?? 0) - (cancelledOrders ?? 0);

        setActiveCount(active < 0 ? 0 : active);
        setDashboardLoadError(null);
        setDashboardReady(true);
        hasLoadedDashboardRef.current = true;
      } catch {
        setDashboardLoadError(
          hasLoadedDashboardRef.current || silent
            ? DASHBOARD_SYNC_ERROR_MESSAGE
            : DASHBOARD_LOAD_ERROR_MESSAGE
        );
      } finally {
        if (silent) {
          setLiveRefreshing(false);
        } else if (!keepLoadingForRedirect) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        currentUserId = session.user.id;
        setEmail(session.user.email ?? null);
      } else if (event === "SIGNED_OUT") {
        void getStableSession().then(({ session: recovered }) => {
          if (recovered?.user) {
            currentUserId = recovered.user.id;
            setEmail(recovered.user.email ?? null);
          } else {
            currentUserId = null;
            router.replace("/login");
          }
        });
      }
    });

    const interval = window.setInterval(() => {
      loadDashboard({ silent: true });
    }, 30000);

    const channel = supabase
      .channel("customer-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const row = (payload.new || payload.old) as
            | { customer_id?: string }
            | undefined;

          if (!currentUserId || row?.customer_id !== currentUserId) return;

          loadDashboard({ silent: true });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          const row = (payload.new || payload.old) as { id?: string } | undefined;

          if (!currentUserId || row?.id !== currentUserId) return;

          loadDashboard({ silent: true });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credit_transactions" },
        (payload) => {
          const row = (payload.new || payload.old) as
            | { user_id?: string }
            | undefined;

          if (!currentUserId || row?.user_id !== currentUserId) return;

          loadDashboard({ silent: true });
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [router, dashboardRefreshKey]);

  const creditHistory = useMemo(() => {
    return creditTransactions.slice(0, 6);
  }, [creditTransactions]);

  const customerReference = formatCustomerReference(customerId);
  const profileCompletionSummary = formatMissingProfileItems(profileMissingItems);

  const firstName =
    email?.split("@")[0]?.replace(/[._-]/g, " ").split(" ")[0] ?? "Customer";

  const copyReference = async () => {
    if (!customerReference) return;

    await navigator.clipboard.writeText(customerReference);
    setCopiedReference(true);

    window.setTimeout(() => {
      setCopiedReference(false);
    }, 1600);
  };

  const handleLogout = async () => {
    await signOutStable();
    router.push("/login");
  };

  const retryDashboardLoad = () => {
    setDashboardRefreshKey((current) => current + 1);
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

  if (dashboardLoadError && !dashboardReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div className="max-w-lg rounded-[2rem] border border-red-900/50 bg-red-950/20 p-7 text-center shadow-2xl shadow-black/30">
          <AlertTriangle className="mx-auto mb-5 h-10 w-10 text-red-400" />
          <div className="text-xs font-black uppercase tracking-[0.24em] text-red-300">
            Dashboard sync failed
          </div>
          <h1 className="mt-3 text-3xl font-black">Your dashboard could not be loaded</h1>
          <p role="alert" className="mt-4 text-sm leading-6 text-zinc-300">
            {dashboardLoadError}
          </p>
          <button
            type="button"
            onClick={retryDashboardLoad}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c91824]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mg-compact-ui min-h-screen bg-[#050505] text-white">
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
                href="/dashboard/file-expert"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <BrainCircuit className="h-5 w-5" />
                AI File Expert
              </Link>

              <Link
                href="/dashboard/widget"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Braces className="h-5 w-5" />
                Vehicle Widget
              </Link>

              <Link
                href="/dashboard/orders"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <FileText className="h-5 w-5" />
                Active Orders
              </Link>

              <Link
                href="/dashboard/orders?view=needs_response"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Clipboard className="h-5 w-5" />
                Needs Response
              </Link>

              <Link
                href="/dashboard/orders?view=completed"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <History className="h-5 w-5" />
                Order History
              </Link>

              <Link
                href="/dashboard/credits"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <CreditCard className="h-5 w-5" />
                Buy Credits
              </Link>

              <Link
                href="/dashboard/credits/history"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <History className="h-5 w-5" />
                Credit History
              </Link>

              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 font-bold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Settings className="h-5 w-5" />
                Settings
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
                <div className="hidden items-center gap-2 rounded-2xl border border-emerald-700/30 bg-emerald-950/20 px-4 py-3 text-xs font-black text-emerald-300 md:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {liveRefreshing ? "Syncing" : "Live sync"}
                </div>

                <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 md:block">
                  <div className="text-xs text-zinc-500">Logged in as</div>
                  <div className="max-w-[220px] truncate text-sm font-bold">
                    {email}
                  </div>
                  {customerId && (
                    <div className="mt-1 text-xs font-black text-red-400">
                      {customerId}
                    </div>
                  )}
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

          <nav className="flex gap-2 overflow-x-auto border-b border-white/10 bg-black/45 px-4 py-3 lg:hidden">
            <Link href="/dashboard" className="shrink-0 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-2.5 text-xs font-black">
              <Home className="mr-2 inline h-4 w-4" />Dashboard
            </Link>
            <Link href="/new-request" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black">
              <Upload className="mr-2 inline h-4 w-4" />New Request
            </Link>
            <Link href="/dashboard/orders" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black">
              <FileText className="mr-2 inline h-4 w-4" />Orders
            </Link>
            <Link href="/dashboard/orders?view=needs_response" className="shrink-0 rounded-xl border border-orange-700/40 bg-orange-950/25 px-4 py-2.5 text-xs font-black text-orange-100">
              <Clipboard className="mr-2 inline h-4 w-4" />Needs Response
            </Link>
            <Link href="/dashboard/credits" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black">
              <CreditCard className="mr-2 inline h-4 w-4" />Credits
            </Link>
          </nav>

          <div className="px-4 py-8 lg:px-8">
            {dashboardLoadError && dashboardReady && (
              <div
                role="alert"
                className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-amber-700/40 bg-amber-950/20 p-5 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Sync needs retry
                  </div>
                  <p className="mt-2 break-words text-sm leading-6 text-amber-100/90">
                    {dashboardLoadError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryDashboardLoad}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-black/25 px-5 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-900/30"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </button>
              </div>
            )}

            <div className="mb-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="relative overflow-hidden rounded-[2rem] border border-red-900/50 bg-gradient-to-br from-red-950/30 via-white/[0.04] to-black p-7 shadow-2xl shadow-black/30">
                <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-red-700/20 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-red-950/30 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

                <div className="relative">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-800/50 bg-red-950/30 px-4 py-2 text-sm font-bold text-red-100">
                    <ShieldCheck className="h-4 w-4 text-red-500" />
                    Secure MG AutoTech customer workspace
                  </div>

                  <h2 className="text-4xl font-black md:text-5xl">
                    Welcome back,{" "}
                    <span className="text-red-500">
                      {firstName.charAt(0).toUpperCase() + firstName.slice(1)}
                    </span>
                  </h2>

                  <p className="mt-4 max-w-3xl leading-8 text-zinc-400">
                    Manage file requests, credits, completed files and support
                    communication from your private MG AutoTech dashboard.
                  </p>

                  <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <Link
                      href="/new-request"
                      className="rounded-2xl bg-[#b1121b] px-5 py-4 text-center font-black text-white shadow-xl shadow-red-950/40 transition hover:-translate-y-1 hover:bg-[#c91824]"
                    >
                      <Upload className="mr-2 inline h-5 w-5" />
                      New Request
                    </Link>

                    <Link
                      href="/dashboard/credits"
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center font-black text-white transition hover:-translate-y-1 hover:bg-white/10"
                    >
                      <CreditCard className="mr-2 inline h-5 w-5" />
                      Buy Credits
                    </Link>

                    <Link
                      href="/dashboard/file-expert"
                      className="rounded-2xl border border-red-800/50 bg-red-950/25 px-5 py-4 text-center font-black text-white transition hover:-translate-y-1 hover:bg-red-950/40"
                    >
                      <BrainCircuit className="mr-2 inline h-5 w-5" />
                      AI File Expert
                    </Link>

                    <Link
                      href="/dashboard/settings"
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center font-black text-white transition hover:-translate-y-1 hover:bg-white/10"
                    >
                      <Settings className="mr-2 inline h-5 w-5" />
                      Settings
                    </Link>

                    <a
                      href="mailto:info@mgautotech.de"
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center font-black text-white transition hover:-translate-y-1 hover:bg-white/10"
                    >
                      <Wrench className="mr-2 inline h-5 w-5" />
                      Support
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.22em] text-red-600">
                      Customer ID
                    </div>
                    <h3 className="mt-2 text-2xl font-black">
                      Payment / Support Reference
                    </h3>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/40 bg-red-950/25">
                    <User className="h-6 w-6 text-red-500" />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                    Bank Transfer Reference
                  </div>
                  <div className="mt-2 break-words text-lg font-black">
                    {customerReference}
                  </div>
                </div>

                <button
                  onClick={copyReference}
                  className="mt-4 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  <Clipboard className="mr-2 h-4 w-4" />
                  {copiedReference ? "Copied" : "Copy Reference"}
                </button>

                <p className="mt-4 text-xs leading-5 text-zinc-500">
                  Use this Customer ID as payment reference for bank transfer
                  top-ups and support messages.
                </p>
              </div>
            </div>

            {profileMissingItems.length > 0 && (
              <div className="mb-8 rounded-[2rem] border border-amber-700/40 bg-amber-950/20 p-5 shadow-2xl shadow-black/20">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                      <User className="h-4 w-4 shrink-0" />
                      Profile completion
                    </div>

                    <h2 className="mt-2 break-words text-2xl font-black">
                      Complete your customer profile
                    </h2>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/80">
                      Add {profileCompletionSummary} so support and billing can
                      use your saved account details.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {profileMissingItems.map((item) => (
                        <span
                          key={item}
                          className="max-w-full break-words rounded-full border border-amber-600/30 bg-black/25 px-3 py-1 text-xs font-bold text-amber-100"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Link
                    href="/dashboard/settings"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-black transition hover:bg-amber-200 lg:w-auto"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Update Settings
                  </Link>
                </div>
              </div>
            )}

            <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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

              <Link
                href="/dashboard/orders?view=needs_response"
                className="min-w-0 rounded-3xl border border-orange-700/40 bg-orange-950/20 p-6 transition hover:-translate-y-1 hover:border-orange-500/70"
              >
                <Clipboard className="mb-4 h-8 w-8 text-orange-300" />
                <div className="break-words text-sm text-orange-100">
                  Needs Response
                </div>
                <div className="mt-2 text-5xl font-black">{needsResponseCount}</div>
                <div className="mt-2 break-words text-xs font-bold text-orange-200/80">
                  Waiting for your information
                </div>
              </Link>

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

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/dashboard/orders"
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
                    >
                      <History className="mr-2 inline h-4 w-4" />
                      View All Orders
                    </Link>
                    <Link
                      href="/new-request"
                      className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-1 hover:bg-[#c91824]"
                    >
                      <Plus className="mr-2 inline h-4 w-4" />
                      New Request
                    </Link>
                  </div>
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
                  <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10">
                    <div className="hidden grid-cols-[1.4fr_.8fr_.7fr_.7fr_.9fr] gap-4 bg-black/40 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500 md:grid">
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
                          className="grid min-w-0 grid-cols-1 gap-4 bg-black/20 px-4 py-5 transition hover:bg-white/[0.04] md:grid-cols-[1.4fr_.8fr_.7fr_.7fr_.9fr] md:items-center md:px-5 md:py-4"
                        >
                          <div className="min-w-0">
                            <div className="break-words font-black">
                              {order.vehicle_brand || "Vehicle"}{" "}
                              {order.vehicle_model || ""}
                            </div>
                            <div className="mt-1 break-words text-sm text-zinc-400">
                              {order.vehicle_generation || "Generation not set"} ·{" "}
                              {order.vehicle_engine || "Engine not set"}
                            </div>
                            <div className="mt-2 break-words text-xs font-bold text-red-400">
                              {order.service_type || "Service not set"}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 md:block">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-600 md:hidden">
                              Status
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusStyle(
                                order.status
                              )}`}
                            >
                              {formatStatus(order.status)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 md:block md:border-0 md:bg-transparent md:px-0 md:py-0">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-600 md:hidden">
                              Credit
                            </span>
                            <span className="font-black">
                              {Number(order.credits_required ?? 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-400 md:block md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-left">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-600 md:hidden">
                              Date
                            </span>
                            <span>{formatDate(order.created_at)}</span>
                          </div>

                          <div className="flex min-w-0 flex-col gap-2 text-left md:items-end md:text-right">
                            {order.status === "completed" && order.modified_file_path ? (
                              <button
                                onClick={() => downloadCompletedFile(order.modified_file_path)}
                                className="w-full rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-xs font-black text-emerald-300 transition hover:bg-emerald-900/40 md:w-auto"
                              >
                                <Download className="mr-2 inline h-4 w-4" />
                                Download File
                              </button>
                            ) : (
                              <span className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs font-bold text-zinc-500 md:w-auto">
                                Not Ready
                              </span>
                            )}

                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs font-black text-white transition hover:bg-white/10 md:w-auto"
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

                    <Link
                      href="/dashboard/file-expert"
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:-translate-y-1 hover:border-red-800/60"
                    >
                      <span className="flex items-center gap-3 font-black">
                        <BrainCircuit className="h-5 w-5 text-red-600" />
                        AI File Expert
                      </span>
                      <ArrowRight className="h-5 w-5 text-zinc-500" />
                    </Link>

                    <Link
                      href="/dashboard/settings"
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:-translate-y-1 hover:border-red-800/60"
                    >
                      <span className="flex items-center gap-3 font-black">
                        <Settings className="h-5 w-5 text-red-600" />
                        Account Settings
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
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="text-sm font-black uppercase tracking-[0.25em] text-red-600">
                    Credit History
                  </div>
                  <Link
                    href="/dashboard/credits/history"
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white transition hover:bg-white/10"
                  >
                    View All
                  </Link>
                </div>

                {creditHistory.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-8 text-center">
                    <CreditCard className="mx-auto mb-4 h-9 w-9 text-red-500" />
                    <h3 className="text-lg font-black text-white">
                      No credit ledger movements yet
                    </h3>
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-400">
                      Credit purchases, admin top-ups and file usage will appear here
                      once they are recorded in your ledger.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <Link
                        href="/dashboard/credits"
                        className="rounded-xl bg-[#b1121b] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#c91824]"
                      >
                        Buy Credits
                      </Link>
                      <Link
                        href="/dashboard/credits/history"
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/10"
                      >
                        Full Ledger
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {creditHistory.map((item) => {
                      const delta = Number(item.credits_delta ?? 0);
                      const isPositive = delta >= 0;
                      const typeLabel = formatCreditTransactionType(item.type);

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col gap-4 rounded-2xl bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="break-words font-bold">
                              {item.description || typeLabel}
                            </div>
                            <div className="mt-1 break-words text-xs text-zinc-500">
                              {typeLabel} - {formatDate(item.created_at)}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
                            {item.balance_after !== null && item.balance_after !== undefined && (
                              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-300">
                                Balance {item.balance_after}
                              </div>
                            )}

                            <div
                              className={`text-xl font-black ${
                                isPositive ? "text-emerald-400" : "text-red-500"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {delta}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
